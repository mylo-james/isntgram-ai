#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, "docs", "assets");
const PERF_DIR = path.join(ROOT, "docs", "perf");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  return child;
}

async function waitForHealthy(url, { timeoutMs = 120_000 } = {}) {
  const startAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok) return;
    } catch {
      // ignore until timeout
    }
    if (Date.now() - startAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await delay(500);
  }
}

function toCookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function safeSlug(input) {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const runDir = path.join(PERF_DIR, `lighthouse-${date}`);

  await mkdir(ASSETS_DIR, { recursive: true });
  await rm(runDir, { recursive: true, force: true });
  await mkdir(runDir, { recursive: true });

  console.log("🧱 Building apps…");
  await run("pnpm", ["run", "build:all"], { cwd: ROOT });

  console.log("🧹 Ensuring ports are free…");
  await run("bash", ["scripts/kill-ports.sh", "3000", "3001"], { cwd: ROOT });

  const jwtSecret = "portfolio_local_jwt_secret_do_not_use_in_production";
  const nextAuthSecret = "portfolio_local_nextauth_secret_do_not_use_in_production";

  console.log("🚀 Starting API (sqlite, test env) …");
  const api = start("node", ["dist/main"], {
    cwd: path.join(ROOT, "apps", "api"),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: "3001",
      HOST: "0.0.0.0",
      JWT_SECRET: jwtSecret,
      THROTTLE_TTL: "60000",
      THROTTLE_LIMIT: "1000",
    },
  });

  console.log("🚀 Starting Web (production server) …");
  const webCmd =
    "rm -rf .next/standalone/apps/web/.next/static && mkdir -p .next/standalone/apps/web/.next && cp -R .next/static .next/standalone/apps/web/.next/ && PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/apps/web/server.js";
  const web = start("bash", ["-lc", webCmd], {
    cwd: path.join(ROOT, "apps", "web"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: nextAuthSecret,
      AUTH_SECRET: nextAuthSecret,
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
      INTERNAL_API_URL: "http://localhost:3001",
      NEXT_PUBLIC_DEMO_EMAIL: "demo@isntgram.ai",
      NEXT_PUBLIC_DEMO_PASSWORD: "changeme",
    },
  });

  const shutdown = async () => {
    for (const child of [web, api]) {
      if (!child.pid) continue;
      child.kill("SIGTERM");
    }
    await delay(500);
  };

  /** @type {string | null} */
  let tempHeadersDir = null;

  try {
    await waitForHealthy("http://localhost:3001/api/health");
    await waitForHealthy("http://localhost:3000/health");

    console.log("🧪 Seeding + capturing screenshots/video (Playwright) …");
    const browser = await chromium.launch({ headless: true });
    const videoTempDir = path.join(ASSETS_DIR, ".tmp-video");
    await rm(videoTempDir, { recursive: true, force: true });
    await mkdir(videoTempDir, { recursive: true });

    const unique = `${Date.now()}`;
    const user = {
      email: `portfolio_${unique}@example.com`,
      username: `portfolio_${unique}`,
      fullName: "Portfolio User",
      password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
    };

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: videoTempDir, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();

    const register = await fetch("http://localhost:3001/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (register.status !== 201) {
      const text = await register.text().catch(() => "");
      throw new Error(`Failed to register user (status ${register.status}): ${text}`);
    }

    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/feed$/, { timeout: 20_000 });

    // Feed screenshot (empty or with content)
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.join(ASSETS_DIR, "screenshot-feed.png"), fullPage: true });

    // Create a post and open detail
    const postContent = `Portfolio post ${unique}`;
    await page.getByLabel("Create a post").fill(postContent);
    await page.getByRole("button", { name: /^Post$/ }).click();
    await page.getByText(postContent).first().waitFor({ timeout: 20_000 });

    const card = page.locator("article", { hasText: postContent });
    await card.getByRole("link", { name: "Open" }).first().click();
    await page.waitForURL(/\/posts\/.+/, { timeout: 20_000 });
    const postUrl = page.url();
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.join(ASSETS_DIR, "screenshot-post-detail.png"), fullPage: true });

    // Explore screenshot
    await page.goto("http://localhost:3000/explore", { waitUntil: "networkidle" });
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.join(ASSETS_DIR, "screenshot-explore.png"), fullPage: true });

    // Profile screenshot
    await page.goto(`http://localhost:3000/${user.username}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(750);
    await page.screenshot({ path: path.join(ASSETS_DIR, "screenshot-profile.png"), fullPage: true });

    const cookieHeader = toCookieHeader(await context.cookies());

    await context.close();
    await browser.close();

    const videos = (await readdir(videoTempDir)).filter((f) => f.endsWith(".webm"));
    if (videos.length) {
      await rm(path.join(ASSETS_DIR, "demo.webm"), { force: true });
      await rename(path.join(videoTempDir, videos[0]), path.join(ASSETS_DIR, "demo.webm"));
    }
    await rm(videoTempDir, { recursive: true, force: true });

    console.log("📊 Running Lighthouse (mobile) …");
    const chromePath = chromium.executablePath();
    tempHeadersDir = await mkdtemp(path.join(os.tmpdir(), "isntgram-lighthouse-"));
    const extraHeadersPath = path.join(tempHeadersDir, "extra-headers.json");
    await writeFile(extraHeadersPath, JSON.stringify({ Cookie: cookieHeader }, null, 2));

    const urls = [
      { label: "home", url: "http://localhost:3000/" },
      { label: "login", url: "http://localhost:3000/login" },
      { label: "feed", url: "http://localhost:3000/feed" },
      { label: "explore", url: "http://localhost:3000/explore" },
      { label: "search", url: "http://localhost:3000/search" },
      { label: "post-detail", url: postUrl },
      { label: "profile", url: `http://localhost:3000/${user.username}` },
    ];

    const results = [];
    for (const { label, url } of urls) {
      const jsonPath = path.join(runDir, `lh-${safeSlug(label)}.json`);

      console.log(`  - ${label}: ${url}`);
      await run(
        "pnpm",
        [
          "dlx",
          "lighthouse@13.0.1",
          url,
          "--quiet",
          "--output=json",
          `--output-path=${jsonPath}`,
          "--form-factor=mobile",
          `--extra-headers=${extraHeadersPath}`,
          "--chrome-flags=--headless --no-sandbox --disable-gpu",
        ],
        {
          cwd: ROOT,
          env: {
            ...process.env,
            CHROME_PATH: chromePath,
          },
        },
      );

      const report = JSON.parse(await readFile(jsonPath, "utf8"));
      const categories = report.categories || {};
      const audits = report.audits || {};

      const score = (key) => {
        const v = categories[key]?.score;
        return typeof v === "number" ? Math.round(v * 100) : null;
      };

      results.push({
        label,
        url,
        jsonPath: path.relative(ROOT, jsonPath),
        scores: {
          performance: score("performance"),
          accessibility: score("accessibility"),
          bestPractices: score("best-practices"),
          seo: score("seo"),
        },
        metrics: {
          fcp: audits["first-contentful-paint"]?.displayValue,
          lcp: audits["largest-contentful-paint"]?.displayValue,
          tbt: audits["total-blocking-time"]?.displayValue,
          cls: audits["cumulative-layout-shift"]?.displayValue,
          si: audits["speed-index"]?.displayValue,
        },
      });
    }

    const mdLines = [
      `# Lighthouse Results (${date})`,
      "",
      "_Notes:_",
      "",
      "- Local run against `http://localhost:3000` using Playwright Chromium with mobile emulation.",
      "- Authenticated routes were tested by reusing the NextAuth session cookie via `--extra-headers`.",
      "",
      "| Route | Performance | A11y | Best Practices | SEO | FCP | LCP | TBT | CLS | Speed Index | Report |",
      "| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |",
      ...results.map((r) => {
        const s = r.scores;
        const m = r.metrics;
        return `| \`${r.label}\` | ${s.performance ?? ""} | ${s.accessibility ?? ""} | ${s.bestPractices ?? ""} | ${s.seo ?? ""} | ${m.fcp ?? ""} | ${m.lcp ?? ""} | ${m.tbt ?? ""} | ${m.cls ?? ""} | ${m.si ?? ""} | \`${r.jsonPath}\` |`;
      }),
      "",
    ];

    await mkdir(PERF_DIR, { recursive: true });
    await writeFile(path.join(PERF_DIR, `lighthouse-${date}.md`), mdLines.join("\n"));

    console.log("✅ Done");
    console.log(`- Screenshots/video: ${path.relative(ROOT, ASSETS_DIR)}`);
    console.log(`- Lighthouse summary: docs/perf/lighthouse-${date}.md`);
  } finally {
    if (tempHeadersDir) {
      await rm(tempHeadersDir, { recursive: true, force: true });
    }
    await shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

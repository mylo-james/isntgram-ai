import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { AxeResults, RunOptions } from "axe-core";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const config = require("../apps/api/scripts/v1/config.cjs") as {
  ROOT: string;
  STATE: string;
  statePath: (candidate: string) => string;
  privateFile: (candidate: string) => void;
  hashFile: (file: string) => string;
  load: () => {
    nodeBin: string;
    secrets: { ISNTGRAM_V1_FIXTURE_PASSWORD: string };
    webOrigin: string;
    apiOrigin: string;
    phoneView?: { webOrigin: string; s3Origin: string };
  };
  nativeEnv: () => NodeJS.ProcessEnv;
};
const preflight = require("../apps/api/scripts/v1/preflight.cjs") as {
  preflight: (mode: "running") => Promise<unknown>;
  connect: (runtime: ReturnType<typeof config.load>, target: "app" | "test") => Promise<{
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
    end: () => Promise<void>;
  }>;
};
const fixture = require("../apps/api/scripts/v1/fixture.cjs") as {
  retainedTestRecords: (runtime: ReturnType<typeof config.load>) => Promise<number>;
};
const curatedProof = require("../apps/api/v1-test/curated-demo.cjs") as {
  snapshotSchema: (client: { query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }, schema: string) => Promise<Record<string, Record<string, string>>>;
};
type Corpus = {
  actors: Array<{ id: string; username: string; email: string }>;
  photos: Array<{ postId: string; caption: string;
    original: { fileName: string; sha256: string };
    validated: { sha256: string; bytes: number } }>;
  textPost: { id: string; content: string };
  demoSeeds: Array<{ id: string; username: string; posts: Array<{ id: string }> }>;
};

const runtime = config.load();
const corpusPath = path.join(config.ROOT, "fixtures/v1/content.json");
const corpusBytes = readFileSync(corpusPath);
const corpus = JSON.parse(corpusBytes.toString("utf8")) as Corpus;
const corpusSha256 = createHash("sha256").update(corpusBytes).digest("hex");
const author = (() => {
  const found = corpus.actors.find((actor) => actor.username === "v1_author");
  if (!found) throw new Error("PB-01 author fixture is missing");
  return found;
})();
const demoPostIds = corpus.demoSeeds.flatMap((seed) => seed.posts.map((post) => post.id));
const demoUsernames = new Set(corpus.demoSeeds.map((seed) => seed.username));

type CreatedPost = {
  id: string;
  content: string;
  author: { id: string; username: string };
  mediaUrl?: string;
};

function pageErrorCounter(page: Page) {
  let count = 0;
  page.on("pageerror", () => {
    count += 1;
  });
  return () => count;
}

function treeHashes(directory: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("PB runtime source is indirect");
      if (entry.isDirectory()) return Object.entries(treeHashes(file));
      if (!entry.isFile() || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
      return [[path.relative(config.ROOT, file), config.hashFile(file)]];
    }),
  );
}

function runtimeInventory() {
  return {
    api: treeHashes(path.join(config.ROOT, "apps/api/src")),
    web: {
      app: treeHashes(path.join(config.ROOT, "apps/web/app")),
      components: treeHashes(path.join(config.ROOT, "apps/web/components")),
      lib: treeHashes(path.join(config.ROOT, "apps/web/lib")),
      nextConfig: config.hashFile(path.join(config.ROOT, "apps/web/next.config.mjs")),
      proxy: config.hashFile(path.join(config.ROOT, "apps/web/proxy.ts")),
      defaultAvatar: config.hashFile(path.join(config.ROOT, "apps/web/public/assets/default-avatar.svg")),
    },
    corpusSha256: config.hashFile(corpusPath),
    browserSpecSha256: config.hashFile(fileURLToPath(import.meta.url)),
  };
}

function writePrivateReceipt(name: string, value: object) {
  const file = config.statePath(path.join(config.STATE, "evidence", `v1-e2e-${name}-${randomUUID()}.json`));
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return file;
}

function screenshotEvidence(files: string[]) {
  return files.map((file) => ({ path: file, sha256: config.hashFile(file) }));
}

function opaqueRgbContrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color)?.slice(1).map(Number);
    if (!channels || channels.some((value) => value < 0 || value > 255)) throw new Error("Contrast evidence requires opaque RGB colors");
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function appSnapshot() {
  const client = await preflight.connect(runtime, "app");
  try {
    return await curatedProof.snapshotSchema(client, "public");
  } finally {
    await client.end();
  }
}

function assertRetainedRows(before: Record<string, Record<string, string>>, after: Record<string, Record<string, string>>) {
  for (const [table, rows] of Object.entries(before)) {
    for (const [id, rowHash] of Object.entries(rows)) {
      expect(after[table]?.[id]).toBe(rowHash);
    }
  }
}

function onlyNewVisitor(before: Record<string, Record<string, string>>, after: Record<string, Record<string, string>>) {
  assertRetainedRows(before, after);
  let visitorId: string | undefined;
  for (const [table, rows] of Object.entries(after)) {
    const additions = Object.keys(rows).filter((id) => !Object.hasOwn(before[table] ?? {}, id));
    if (table === "users") {
      expect(additions).toHaveLength(1);
      visitorId = additions[0];
    } else {
      expect(additions).toEqual([]);
    }
  }
  if (!visitorId) throw new Error("PB demo visitor was not retained");
  return visitorId;
}

async function assertVisitorStartsEmpty(visitorId: string) {
  const client = await preflight.connect(runtime, "app");
  try {
    const user = await client.query(
      'SELECT "postsCount", "followerCount", "followingCount", "isDemoUser", "isDemoSeed", "profilePictureUrl" FROM users WHERE id = $1',
      [visitorId],
    );
    expect(user.rows).toEqual([{
      postsCount: 0,
      followerCount: 0,
      followingCount: 0,
      isDemoUser: true,
      isDemoSeed: false,
      profilePictureUrl: null,
    }]);
    const follows = await client.query(
      'SELECT count(*)::int AS count FROM follows WHERE "followerId" = $1 OR "followingId" = $1',
      [visitorId],
    );
    expect(follows.rows[0]?.count).toBe(0);
  } finally {
    await client.end();
  }
}

async function guardedReservation(reservedRows = 2) {
  await preflight.preflight("running");
  const testRows = await fixture.retainedTestRecords(runtime);
  const client = await preflight.connect(runtime, "app");
  try {
    const tables = ["users", "posts", "likes", "comments", "comment_likes", "follows", "notifications", "media_uploads"];
    let appRows = 0;
    for (const table of tables) {
      const result = await client.query(`SELECT count(*)::int AS count FROM "${table}"`);
      const count = Number(result.rows[0]?.count);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("PB retained-row count is invalid");
      appRows += count;
    }
    if (!Number.isSafeInteger(reservedRows) || reservedRows < 0 || !Number.isSafeInteger(appRows) || appRows + testRows + reservedRows > 1000)
      throw new Error("PB retained-row reserve cannot admit the requested bounded effects");
  } finally {
    await client.end();
  }
}

async function login(page: Page, account = author) {
  const authResponses: Array<{ path: string; status: number }> = [];
  const observe = (response: import("@playwright/test").Response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.startsWith("/api/auth/")) authResponses.push({ path: pathname, status: response.status() });
  };
  page.on("response", observe);
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(runtime.secrets.ISNTGRAM_V1_FIXTURE_PASSWORD);
    await page.getByRole("button", { name: "Log In" }).click();
    await page.waitForURL(/\/feed$/, { timeout: 15_000 });
  } catch (error) {
    // Record form state without credentials, cookies, response bodies, or private origins.
    const form = await page.evaluate(() => ({
      path: window.location.pathname,
      emailPresent: Boolean(document.querySelector<HTMLInputElement>('input[type="email"]')?.value),
      passwordPresent: Boolean(document.querySelector<HTMLInputElement>('input[type="password"]')?.value),
      invalidFields: Array.from(document.querySelectorAll('[aria-invalid="true"]')).map((node) => node.id),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((node) => node.textContent),
    }));
    writePrivateReceipt("login-failure", { form, authResponses });
    throw error;
  } finally { page.off("response", observe); }
}

async function verifyPost(postId: string, mediaVerified = false) {
  const node = `${runtime.nodeBin}/node`;
  const script = `${config.ROOT}/apps/api/scripts/v1/verify.cjs`;
  const { stdout } = await execFileAsync(node, [script, postId], {
    cwd: config.ROOT,
    env: config.nativeEnv(),
    timeout: 15_000,
    maxBuffer: 8_192,
  });
  const result = JSON.parse(stdout) as { postId?: string; mediaVerified?: boolean; receipt?: string };
  expect(result.postId).toBe(postId);
  expect(result.mediaVerified).toBe(mediaVerified);
  expect(typeof result.receipt).toBe("string");
  return result as { postId: string; mediaVerified: boolean; receipt: string };
}

async function freshLogin(browser: Browser) {
  const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = pageErrorCounter(page);
  await login(page);
  return { context, page, errors };
}

test.describe("v1 core browser journey", () => {
  let sourceBefore: ReturnType<typeof runtimeInventory>;

  test.beforeAll(async () => {
    sourceBefore = runtimeInventory();
    if (sourceBefore.corpusSha256 !== corpusSha256) throw new Error("PB corpus changed before browser requests");
  });

  test.beforeEach(async () => {
    await guardedReservation();
  });

  test.afterAll(() => {
    expect(runtimeInventory()).toEqual(sourceBefore);
  });

  test("T27 login waits for JavaScript before accepting input", async ({ browser }) => {
    const before = await appSnapshot();
    const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
    const page = await context.newPage();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let heldScripts = 0;
    let authWrites = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/auth/")) authWrites += 1;
    });
    await page.route("**/_next/static/**/*.js*", async (route) => {
      heldScripts += 1;
      await held;
      await route.continue();
    });
    try {
      await page.goto("/login", { waitUntil: "commit" });
      const email = page.getByLabel("Email", { exact: true });
      const password = page.getByLabel("Password", { exact: true });
      const submit = page.getByRole("button", { name: "Log In", exact: true });
      await expect(email).toBeVisible();
      await expect.poll(() => heldScripts).toBeGreaterThan(0);
      const beforeJavaScript = { emailDisabled: await email.isDisabled(), passwordDisabled: await password.isDisabled(), submitDisabled: await submit.isDisabled() };
      release();
      await page.waitForLoadState("load");
      await expect(email).toBeEnabled();
      await expect(password).toBeEnabled();
      await expect(submit).toBeEnabled();
      await email.fill("invalid-email");
      await email.press("Tab");
      await expect(page.getByRole("alert").filter({ hasText: "Please enter a valid email address" })).toBeVisible();
      const after = await appSnapshot();
      expect(after).toEqual(before);
      writePrivateReceipt("login-hydration", { beforeJavaScript, heldScripts, authWrites, validationAfterHydration: true, appBefore: before, appAfter: after, source: sourceBefore });
      expect(authWrites).toBe(0);
      expect(beforeJavaScript).toEqual({ emailDisabled: true, passwordDisabled: true, submitDisabled: true });
    } finally { release(); await context.close(); }
  });

  test("T27 search waits for JavaScript before accepting input", async ({ browser }) => {
    const before = await appSnapshot();
    const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
    const page = await context.newPage();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let heldScripts = 0;
    try {
      await login(page);
      await page.route("**/_next/static/**/*.js*", async (route) => {
        heldScripts += 1;
        await held;
        await route.continue();
      });
      await page.goto("/explore", { waitUntil: "commit" });
      const search = page.getByRole("textbox", { name: "Search users", exact: true });
      await expect(search).toBeVisible();
      await expect.poll(() => heldScripts).toBeGreaterThan(0);
      const disabledBeforeJavaScript = await search.isDisabled();
      release();
      await page.waitForLoadState("load");
      await expect(search).toBeEnabled();
      await search.fill(author.username);
      const result = page.getByRole("main").locator('li a[href="/' + author.username + '"]');
      await expect(result).toHaveCount(1);
      const after = await appSnapshot();
      expect(after).toEqual(before);
      writePrivateReceipt("search-hydration", { disabledBeforeJavaScript, heldScripts, resultAfterHydration: true, appBefore: before, appAfter: after, source: sourceBefore });
      expect(disabledBeforeJavaScript).toBe(true);
    } finally { release?.(); await context.close(); }
  });

  test("T27 read-only desktop and narrow accessibility and keyboard audit", async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    await guardedReservation(0);
    const before = await appSnapshot();
    const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
    const page = await context.newPage();
    const pageErrors = pageErrorCounter(page);
    const axePath = require.resolve("axe-core/axe.min.js");
    const scans: Array<{ label: string; width: number; axeVersion: string; overflow: boolean;
      violations: unknown[]; incomplete: unknown[]; passCount: number }> = [];
    const checks: Record<string, unknown> = {};
    const screenshots: string[] = [];
    const scan = async (label: string) => {
      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (context: Document, options: RunOptions) => Promise<AxeResults> } }).axe;
        return axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
      });
      const summarize = (items: AxeResults["violations"]) => items.map(({ id, impact, help, helpUrl, nodes }) => ({
        id, impact, help, helpUrl, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      }));
      scans.push({ label, width: page.viewportSize()!.width, axeVersion: result.testEngine.version,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        violations: summarize(result.violations), incomplete: summarize(result.incomplete), passCount: result.passes.length });
    };
    const bothWidths = async (label: string) => {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await scan(label);
        if (["profile", "profile-dialog", "composer"].includes(label)) {
          const shot = testInfo.outputPath(`t27-${label}-${width}.png`);
          await page.screenshot({ path: shot }); screenshots.push(shot);
        }
        if (label === "composer") {
          const colors = await page.locator("#post-content").evaluate((node) => {
            const bounds = node.getBoundingClientRect();
            return {
              foreground: getComputedStyle(node).color,
              background: getComputedStyle(node).backgroundColor,
              placeholder: getComputedStyle(node, "::placeholder").color,
              sampledElements: [0.1, 0.5, 0.9].map((fraction) => {
                const element = document.elementFromPoint(bounds.x + bounds.width * fraction, bounds.y + bounds.height * fraction);
                return { tag: element?.tagName, id: element?.id };
              }),
            };
          });
          checks[`composerColors${width}`] = { ...colors, textContrast: opaqueRgbContrast(colors.foreground, colors.background), placeholderContrast: opaqueRgbContrast(colors.placeholder, colors.background) };
        }
      }
    };
    try {
      await page.goto("/register");
      await page.getByLabel("Email", { exact: true }).fill("invalid-email");
      await page.getByLabel("Email", { exact: true }).press("Tab");
      await expect(page.getByRole("alert").filter({ hasText: "Please enter a valid email address" })).toBeVisible();
      await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-describedby", "register-email-error");
      await bothWidths("registration-local-error");
      checks.registrationErrorAssociation = true;
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill("invalid-email");
      await page.getByLabel("Email", { exact: true }).press("Tab");
      await expect(page.getByRole("alert").filter({ hasText: "Please enter a valid email address" })).toBeVisible();
      await bothWidths("login-local-error");
      await login(page);
      await bothWidths("feed");

      await page.goto("/" + author.username);
      await bothWidths("profile");
      await page.setViewportSize({ width: 1280, height: 900 });
      const edit = page.getByRole("button", { name: "Edit Profile", exact: true });
      await edit.focus();
      await edit.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Edit Profile", exact: true });
      const close = dialog.getByRole("button", { name: "Close edit profile", exact: true });
      const save = dialog.getByRole("button", { name: "Save", exact: true });
      await expect(close).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(save).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await bothWidths("profile-dialog");
      checks.profileCloseControlColors = await close.evaluate((node) => ({
        foreground: getComputedStyle(node).color,
        backgrounds: [node, node.parentElement, node.parentElement?.parentElement].flatMap((element) => element ? [getComputedStyle(element).backgroundColor] : []),
        accessibleLabel: node.getAttribute("aria-label"),
      }));
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(edit).toBeFocused();
      checks.profileKeyboardWrapEscapeRestore = true;

      await page.goto("/explore");
      const search = page.getByRole("textbox", { name: "Search users", exact: true });
      await search.fill(author.username);
      checks.searchValueImmediatelyAfterFill = await search.inputValue() === author.username;
      const searchResult = page.getByRole("main").locator('li a[href="/' + author.username + '"]');
      await expect(searchResult).toHaveCount(1);
      await search.focus();
      await search.press("Tab");
      await expect(searchResult).toBeFocused();
      await bothWidths("search-results");
      checks.searchResultKeyboardReachable = true;

      await page.goto("/post/" + corpus.photos[0].postId);
      const comment = page.getByRole("textbox", { name: "Add a comment", exact: true });
      const draft = "Read-only accessibility failure check";
      const commentPath = "/api/bff/posts/" + corpus.photos[0].postId + "/comments";
      let injectedCommentFailures = 0;
      await page.route("**" + commentPath, (route) => {
        if (route.request().method() !== "POST") return route.continue();
        injectedCommentFailures += 1;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Comment temporarily unavailable" }) });
      });
      await comment.fill(draft);
      await comment.press("Tab");
      const post = page.getByRole("button", { name: "Post", exact: true });
      await expect(post).toBeFocused();
      await post.press("Enter");
      await expect(page.getByRole("alert").filter({ hasText: "Comment temporarily unavailable" })).toBeVisible();
      await expect(comment).toHaveValue(draft);
      await expect(comment).toHaveAttribute("aria-invalid", "true");
      await expect(comment).toHaveAttribute("aria-describedby", "comment-error");
      await expect(post).toBeEnabled();
      expect(injectedCommentFailures).toBe(1);
      await bothWidths("post-comment-failure");
      const shot = testInfo.outputPath("t27-comment-failure-narrow.png");
      await page.screenshot({ path: shot }); screenshots.push(shot);
      checks.injectedCommentFailureRetainsDraft = true;
      await page.unroute("**" + commentPath);

      await page.goto("/notifications");
      await expect(page.getByRole("list", { name: "Notifications", exact: true })).toBeVisible();
      await bothWidths("notifications");
      await page.goto("/upload");
      await expect(page.getByRole("textbox", { name: "Post content", exact: true })).toBeEnabled();
      await bothWidths("composer");
      const after = await appSnapshot();
      expect(after).toEqual(before);
      expect(pageErrors()).toBe(0);
      writePrivateReceipt("t27-accessibility", { scans, checks, appBefore: before, appAfter: after,
        pageErrors: 0, axeSourceSha256: config.hashFile(axePath), screenshots: screenshotEvidence(screenshots), source: sourceBefore });
      // Retain every scan, including inconclusive checks, before applying this bounded automated gate.
      expect(scans.filter((result) => result.violations.length > 0 || result.overflow)).toEqual([]);
      for (const width of [1280, 390]) {
        const colors = checks[`composerColors${width}`] as { textContrast: number; placeholderContrast: number };
        expect(colors.textContrast).toBeGreaterThanOrEqual(4.5);
        expect(colors.placeholderContrast).toBeGreaterThanOrEqual(4.5);
      }
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Preserve the original failure. */ }
      checks.failureState = await page.evaluate(() => ({
        path: window.location.pathname,
        searchValue: document.querySelector<HTMLInputElement>('input[name="search"]')?.value,
        resultPaths: Array.from(document.querySelectorAll('main li a')).map((node) => new URL((node as HTMLAnchorElement).href).pathname),
        alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((node) => node.textContent),
      }));
      writePrivateReceipt("t27-accessibility-partial", { scans, checks, appBefore: before, appAfter: after, source: sourceBefore });
      throw error;
    } finally { await context.close(); }
  });

  test("Demo disclosure remains visible when browser storage is denied", async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const errors = pageErrorCounter(page);
    const before = await appSnapshot();
    let injectedSessions = 0;
    try {
      await login(page);
      await context.route("**/api/auth/session", async (route) => {
        const response = await route.fetch();
        const session = await response.json();
        if (!session.user?.id) throw new Error("Expected a real authenticated session before UI injection");
        injectedSessions += 1;
        await route.fulfill({ response, json: {
          ...session,
          user: { ...session.user, isDemoUser: true, demoExpiresAt: new Date(Date.now() + 60_000).toISOString() },
        } });
      });
      await context.addInitScript(() => {
        const originalGet = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key: string) {
          if (key === "isntgram.demoBannerDismissed.v1") throw new DOMException("Storage denied", "SecurityError");
          return originalGet.call(this, key);
        };
      });
      await page.reload();
      await expect(page).toHaveURL(/\/feed$/);
      await expect(page.getByText(/fictional profiles and credited photographs/i)).toBeVisible();
      await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toBeEnabled();
      expect(injectedSessions).toBeGreaterThan(0);
      const layout = await page.evaluate(() => {
        let denied = false;
        try { localStorage.getItem("isntgram.demoBannerDismissed.v1"); } catch { denied = true; }
        return { denied, height: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--demo-banner-height")) };
      });
      expect(layout.denied).toBe(true);
      expect(layout.height).toBeGreaterThan(0);
      const screenshot = testInfo.outputPath("demo-disclosure-storage-denied.png");
      await page.screenshot({ path: screenshot, fullPage: false });
      await page.getByRole("button", { name: "Dismiss", exact: true }).click();
      await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toHaveCount(0);
      const after = await appSnapshot();
      expect(after).toEqual(before);
      expect(errors()).toBe(0);
      writePrivateReceipt("demo-disclosure", {
        injectedDemoSession: true, injectedStorageReadDenial: true, actualDemoAuthenticationProven: false,
        noSubmit: true, appBefore: before, appAfter: after, layoutHeight: layout.height,
        pageErrors: errors(), screenshots: screenshotEvidence([screenshot]), source: sourceBefore,
      });
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Keep the original failure. */ }
      writePrivateReceipt("demo-disclosure-partial", {
        injectedDemoSession: true, noSubmit: true, appBefore: before, appAfter: after,
        reason: "disclosure_browser_check_incomplete", source: sourceBefore,
      });
      throw error;
    } finally { await context.close(); }
  });

  test("PB-02 ordinary social actions persist and notify their recipient", async ({ browser }, testInfo) => {
    await guardedReservation(7);
    const reader = corpus.actors.find((actor) => actor.username === "v1_reader");
    if (!reader) throw new Error("PB-02 reader fixture missing");
    const postId = corpus.photos[0].postId;
    const content = "PB-02 retained comment " + randomUUID();
    const contexts: BrowserContext[] = [];
    const before = await appSnapshot();
    const effects: Array<{ method: string; status: number; requestId?: string }> = [];
    let commentId: string | undefined;
    const query = async (sql: string, values: unknown[] = []) => {
      const client = await preflight.connect(runtime, "app");
      try { return (await client.query(sql, values)).rows; } finally { await client.end(); }
    };
    const counters = () => query(
      'SELECT id, "followerCount", "followingCount", md5((to_jsonb(u) - ARRAY[\'followerCount\',\'followingCount\',\'updatedAt\'])::text) AS preserved FROM users u WHERE id = ANY($1::uuid[]) ORDER BY id',
      [ [reader.id, author.id] ],
    );
    const postState = () => query(
      'SELECT "likeCount", "commentCount", md5((to_jsonb(p) - ARRAY[\'likeCount\',\'commentCount\',\'updatedAt\'])::text) AS preserved FROM posts p WHERE id=$1', [postId],
    );
    const userBefore = await counters();
    const postBefore = (await postState())[0];
    const mutation = async (page: Page, method: string, suffix: string, action: () => Promise<unknown>) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname === suffix),
        action(),
      ]);
      effects.push({ method, status: response.status(), requestId: response.headers()["x-request-id"] });
      expect(response.ok()).toBe(true);
      expect(response.headers()["x-request-id"]).toBeTruthy();
      return response.json();
    };
    try {
      expect(await query('SELECT id FROM follows WHERE "followerId"=$1 AND "followingId"=$2', [reader.id, author.id])).toEqual([]);
      expect(await query('SELECT id FROM likes WHERE "userId"=$1 AND "postId"=$2', [reader.id, postId])).toEqual([]);
      expect(await query('SELECT id FROM comments WHERE "authorId"=$1 AND "postId"=$2', [reader.id, postId])).toEqual([]);
      const actorContext = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
      contexts.push(actorContext);
      const actorPage = await actorContext.newPage();
      const actorErrors = pageErrorCounter(actorPage);
      await login(actorPage, reader);
      await actorPage.goto("/explore");
      await actorPage.route("**/api/bff/users/search?*", (route) => route.fulfill({
        status: 503, contentType: "application/json", body: JSON.stringify({ message: "Injected search unavailable" }),
      }));
      await actorPage.getByRole("textbox", { name: "Search users" }).fill(author.username);
      await expect(actorPage.getByRole("alert").filter({ hasText: "Search failed. Please try again." })).toBeVisible();
      expect(await appSnapshot()).toEqual(before);
      await actorPage.unroute("**/api/bff/users/search?*");
      await actorPage.getByRole("textbox", { name: "Search users" }).fill("");
      await actorPage.getByRole("textbox", { name: "Search users" }).fill(author.username);
      const result = actorPage.locator('li a[href="/' + author.username + '"]');
      await expect(result).toHaveCount(1);
      await result.click();
      await expect(actorPage).toHaveURL(new RegExp("/" + author.username + "$"));
      const follow = actorPage.getByRole("button", { name: "Follow", exact: true });
      await expect(follow).toBeEnabled();
      await mutation(actorPage, "POST", "/api/bff/follows/" + author.username, () => follow.press("Enter"));
      await expect(actorPage.getByRole("button", { name: "Following", exact: true })).toBeEnabled();
      const initialFollowers = Number(userBefore.find((row) => row.id === author.id)?.followerCount);
      await expect(actorPage.getByText(new RegExp("^" + (initialFollowers + 1) + " followers$"))).toBeVisible();
      await actorPage.reload();
      await expect(actorPage.getByRole("button", { name: "Following", exact: true })).toBeEnabled();

      const confirmedFollow = await appSnapshot();
      await actorPage.route("**/api/bff/follows/" + author.username, (route) =>
        route.request().method() === "DELETE"
          ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Injected follow unavailable" }) })
          : route.continue());
      await actorPage.getByRole("button", { name: "Following", exact: true }).click();
      await expect(actorPage.getByRole("alert").filter({ hasText: "We couldn't update this follow. Please try again." })).toBeVisible();
      await expect(actorPage.getByRole("button", { name: "Following", exact: true })).toBeEnabled();
      expect(await appSnapshot()).toEqual(confirmedFollow);
      await actorPage.unroute("**/api/bff/follows/" + author.username);

      await actorPage.goto("/post/" + postId);
      await mutation(actorPage, "POST", "/api/bff/posts/" + postId + "/like",
        () => actorPage.getByRole("button", { name: "Like", exact: true }).click());
      await actorPage.getByPlaceholder("Add a comment...").fill(content);
      const created = await mutation(actorPage, "POST", "/api/bff/posts/" + postId + "/comments",
        () => actorPage.getByRole("button", { name: "Post", exact: true }).click());
      commentId = created.id;
      expect(typeof commentId).toBe("string");
      const comment = actorPage.locator("li").filter({ hasText: content });
      await mutation(actorPage, "POST", "/api/bff/posts/" + postId + "/comments/" + commentId + "/like",
        () => comment.getByRole("button", { name: "Like comment", exact: true }).click());
      await actorPage.reload();
      await expect(actorPage.getByRole("button", { name: "Unlike", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(comment.getByRole("button", { name: "Unlike comment", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(comment.getByRole("link", { name: reader.username, exact: true })).toBeVisible();

      const recipientContext = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
      contexts.push(recipientContext);
      const recipientPage = await recipientContext.newPage();
      const recipientErrors = pageErrorCounter(recipientPage);
      await login(recipientPage);
      const targets = [
        ["started following you.", "/" + reader.username],
        ["liked your post.", "/post/" + postId],
        ["commented on your post.", "/post/" + postId],
      ];
      for (const [action, target] of targets) {
        await recipientPage.goto("/notifications");
        const link = recipientPage.getByRole("list", { name: "Notifications" }).locator("li").filter({ hasText: reader.username }).filter({ hasText: action }).getByRole("link");
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute("href", target);
        await link.click();
        await expect(recipientPage).toHaveURL(new RegExp(target + "$"));
      }
      await recipientPage.goto("/notifications");
      const desktop = testInfo.outputPath("pb02-notifications-desktop.png");
      await recipientPage.screenshot({ path: desktop, fullPage: false });
      await recipientPage.setViewportSize({ width: 390, height: 844 });
      const narrow = testInfo.outputPath("pb02-notifications-narrow.png");
      await recipientPage.screenshot({ path: narrow, fullPage: false });

      const follows = await query('SELECT id FROM follows WHERE "followerId"=$1 AND "followingId"=$2', [reader.id, author.id]);
      const likes = await query('SELECT id FROM likes WHERE "userId"=$1 AND "postId"=$2', [reader.id, postId]);
      const comments = await query('SELECT id, content, "authorId", "likeCount" FROM comments WHERE id=$1 AND "postId"=$2', [commentId, postId]);
      const commentLikes = await query('SELECT id FROM comment_likes WHERE "userId"=$1 AND "commentId"=$2', [reader.id, commentId]);
      expect(follows).toHaveLength(1); expect(likes).toHaveLength(1); expect(commentLikes).toHaveLength(1);
      expect(comments).toEqual([{ id: commentId, content, authorId: reader.id, likeCount: 1 }]);
      const notifications = await query('SELECT id, type, "recipientId", "postId", "commentId" FROM notifications WHERE "actorId"=$1 ORDER BY type', [reader.id]);
      expect(notifications).toHaveLength(3);
      expect(notifications.map(({ type, recipientId, postId, commentId }) => ({ type, recipientId, postId, commentId }))).toEqual([
        { type: "comment", recipientId: author.id, postId, commentId },
        { type: "follow", recipientId: author.id, postId: null, commentId: null },
        { type: "like", recipientId: author.id, postId, commentId: null },
      ]);
      const userAfter = await counters();
      expect(userAfter).toEqual(userBefore.map((row) => ({
        ...row, followerCount: Number(row.followerCount) + (row.id === author.id ? 1 : 0),
        followingCount: Number(row.followingCount) + (row.id === reader.id ? 1 : 0),
      })));
      expect(await postState()).toEqual([{ ...postBefore, likeCount: Number(postBefore.likeCount) + 1, commentCount: Number(postBefore.commentCount) + 1 }]);
      const after = await appSnapshot();
      const additions: Record<string, string[]> = {
        follows: follows.map((row) => String(row.id)), likes: likes.map((row) => String(row.id)),
        comments: [commentId!], comment_likes: commentLikes.map((row) => String(row.id)),
        notifications: notifications.map((row) => String(row.id)),
      };
      for (const [table, rows] of Object.entries(after)) {
        expect(Object.keys(rows).filter((id) => !Object.hasOwn(before[table], id)).sort()).toEqual((additions[table] ?? []).sort());
        for (const [id, hash] of Object.entries(before[table])) {
          if (table === "users" && [reader.id, author.id].includes(id)) continue;
          if (table === "posts" && id === postId) continue;
          expect(rows[id]).toBe(hash);
        }
      }
      expect(actorErrors() + recipientErrors()).toBe(0);
      writePrivateReceipt("pb02", {
        readerId: reader.id, authorId: author.id, postId, commentId, effects, additions,
        injectedSearchFailure: true, injectedUnfollowFailure: true, userBefore, userAfter,
        appBefore: before, appAfter: after, screenshots: screenshotEvidence([desktop, narrow]),
        pageErrors: 0, source: sourceBefore,
      });
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Preserve original failure and known effects. */ }
      writePrivateReceipt("pb02-partial", { readerId: reader.id, postId, commentId, effects,
        appBefore: before, appAfter: after, reason: "social_browser_proof_incomplete", source: sourceBefore });
      throw error;
    } finally { for (const context of contexts) await context.close(); }
  });

  test("PB-03 registration profile recovery rename and logout preserve account ownership", async ({ browser }, testInfo) => {
    await guardedReservation(1);
    const resumePath = process.env.PB03_RESUME_RECEIPT;
    let resume: { accountId: string; usernameBefore: string; usernameAfter: string;
      appBefore: Record<string, Record<string, string>>; appAfter: Record<string, Record<string, string>> } | undefined;
    if (resumePath) {
      const file = config.statePath(resumePath);
      config.privateFile(file);
      if (path.dirname(file) !== path.join(config.STATE, "evidence") ||
        !/^v1-e2e-pb03-partial-[a-f0-9-]{36}\.json$/.test(path.basename(file))) {
        throw new Error("PB03 continuation requires a retained private partial receipt");
      }
      resume = JSON.parse(readFileSync(file, "utf8"));
      if (!resume || !/^[a-f0-9-]{36}$/.test(resume.accountId) ||
        !/^pb03_[a-f0-9]{12}$/.test(resume.usernameBefore) || resume.usernameAfter !== resume.usernameBefore + "_new") {
        throw new Error("PB03 continuation identity is incomplete");
      }
      expect(await appSnapshot()).toEqual(resume.appAfter);
      expect(onlyNewVisitor(resume.appBefore, resume.appAfter)).toBe(resume.accountId);
    }
    const runId = randomUUID();
    const username = resume?.usernameBefore ?? "pb03_" + runId.replaceAll("-", "").slice(0, 12);
    const renamed = username + "_new";
    const email = username + "@example.invalid";
    const fullName = "PB03 Fictional Visitor";
    const updatedName = "PB03 Updated Visitor";
    const contexts: BrowserContext[] = [];
    const before = resume?.appBefore ?? await appSnapshot();
    const effects: Array<{ method: string; path: string; status: number; requestId?: string }> = [];
    const checks: Record<string, unknown> = {};
    let accountId: string | undefined = resume?.accountId;
    const query = async (sql: string, values: unknown[] = []) => {
      const client = await preflight.connect(runtime, "app");
      try { return (await client.query(sql, values)).rows; } finally { await client.end(); }
    };
    const request = async (page: Page, method: string, suffix: string, action: () => Promise<unknown>) => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname === suffix),
        action(),
      ]);
      effects.push({ method, path: suffix, status: response.status(), requestId: response.headers()["x-request-id"] });
      return response;
    };
    try {
      if (resume) {
        expect(await query('SELECT id, username, "fullName", "tokenVersion" FROM users WHERE username = ANY($1::text[]) OR email=$2', [[username, renamed], email]))
          .toEqual([{ id: accountId, username, fullName, tokenVersion: 0 }]);
        checks.registrationFromPriorReceipt = { sha256: config.hashFile(resumePath!), accountId };
      } else {
        expect(await query('SELECT id FROM users WHERE username = ANY($1::text[]) OR email=$2', [[username, renamed], email])).toEqual([]);
      }
      const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
      contexts.push(context);
      const page = await context.newPage();
      const pageErrors = pageErrorCounter(page);
      if (!resume) {
      await page.goto("/register");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Full Name", { exact: true }).fill(fullName);
      await page.getByLabel("Username", { exact: true }).fill(author.username);
      await page.getByLabel("Password", { exact: true }).fill(runtime.secrets.ISNTGRAM_V1_FIXTURE_PASSWORD);
      const duplicate = await request(page, "POST", "/api/bff/auth/register",
        () => page.getByRole("button", { name: "Sign Up", exact: true }).click());
      expect(duplicate.status()).toBe(409);
      await expect(page.getByLabel("Username", { exact: true })).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("alert").filter({ hasText: /username/i })).toBeVisible();
      await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
      await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(fullName);
      await expect(page.getByRole("button", { name: "Sign Up", exact: true })).toBeEnabled();
      expect(await appSnapshot()).toEqual(before);
      await page.getByLabel("Username", { exact: true }).fill(username);
      const registration = await request(page, "POST", "/api/bff/auth/register",
        () => page.getByRole("button", { name: "Sign Up", exact: true }).click());
      expect(registration.status()).toBe(201);
      accountId = (await registration.json()).user.id;
      expect(typeof accountId).toBe("string");
      await expect(page.getByRole("status").filter({ hasText: "Registration successful!" })).toBeVisible();
      await page.waitForURL(/\/login\?message=/);
      }
      await login(page, { id: accountId!, username, email });
      await page.getByRole("link", { name: "Profile", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/" + username + "$"));
      const registered = await appSnapshot();
      expect(onlyNewVisitor(before, registered)).toBe(accountId);
      const initial = await query('SELECT username, "fullName", "tokenVersion", "isDemoUser", "isDemoSeed" FROM users WHERE id=$1', [accountId]);
      expect(initial).toEqual([{ username, fullName, tokenVersion: 0, isDemoUser: false, isDemoSeed: false }]);
      const edit = page.getByRole("button", { name: "Edit Profile", exact: true });
      await edit.click();
      const dialog = page.getByRole("dialog", { name: "Edit Profile", exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Full Name", { exact: true }).fill(updatedName);
      const handle = dialog.getByLabel("Username", { exact: true });
      await handle.fill(author.username);
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(dialog.getByRole("alert").filter({ hasText: "Username already taken" })).toBeVisible();
      await expect(handle).toBeFocused();
      await expect(handle).toHaveAttribute("aria-invalid", "true");
      await expect(dialog.getByLabel("Full Name", { exact: true })).toHaveValue(updatedName);
      expect(await appSnapshot()).toEqual(registered);
      const errorShot = testInfo.outputPath("pb03-edit-duplicate-desktop.png");
      await page.screenshot({ path: errorShot });

      const failureMessage = "We couldn't save your profile. Your changes are still here. Please try again.";
      for (const pattern of ["**/api/bff/users/check-username/*", "**/api/bff/users/profile"]) {
        await handle.fill(renamed);
        await page.route(pattern, (route) => route.fulfill({ status: 503, contentType: "application/json",
          body: JSON.stringify({ message: "Injected PB03 dependency failure" }) }));
        await dialog.getByRole("button", { name: "Save", exact: true }).click();
        await expect(dialog.getByRole("alert").filter({ hasText: failureMessage })).toBeVisible();
        await expect(handle).toBeFocused();
        await expect(handle).toHaveValue(renamed);
        await expect(dialog.getByLabel("Full Name", { exact: true })).toHaveValue(updatedName);
        await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
        expect(await appSnapshot()).toEqual(registered);
        await page.unroute(pattern);
      }
      checks.injectedAvailabilityAndSaveFailures = true;
      await page.setViewportSize({ width: 390, height: 844 });
      const narrowShot = testInfo.outputPath("pb03-edit-recovery-narrow.png");
      await page.screenshot({ path: narrowShot });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(edit).toBeFocused();
      await edit.press("Enter");
      await dialog.getByLabel("Full Name", { exact: true }).fill(updatedName);
      await handle.fill(renamed);
      const saved = await request(page, "PUT", "/api/bff/users/profile",
        () => dialog.getByRole("button", { name: "Save", exact: true }).click());
      expect(saved.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp("/" + renamed + "$"));
      await expect(dialog).not.toBeVisible();
      await expect(page.getByText(updatedName, { exact: true })).toBeVisible();
      checks.profileHrefAfterRename = await page.getByRole("link", { name: "Profile", exact: true }).getAttribute("href");
      const successShot = testInfo.outputPath("pb03-renamed-profile-narrow.png");
      await page.screenshot({ path: successShot });
      await page.goto("/feed");
      checks.feedProfileHrefAfterRename = await page.getByRole("link", { name: "Profile", exact: true }).getAttribute("href");
      await page.goto("/" + username);
      await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
      await page.goto("/" + renamed);
      await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeEnabled();

      // Copy the already-issued session only in memory. Never persist cookies or tokens in evidence.
      const oldSession = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
      contexts.push(oldSession);
      await oldSession.addCookies(await context.cookies());
      const preLogout = await oldSession.request.get("/api/bff/users/me");
      expect(preLogout.status()).toBe(200);
      expect((await preLogout.json()).id).toBe(accountId);
      const logout = await request(page, "POST", "/api/bff/auth/logout",
        () => page.getByRole("button", { name: "Log out", exact: true }).click());
      expect(logout.ok()).toBe(true);
      await page.waitForURL(/\/login$/);
      await page.goto("/feed");
      await expect(page).toHaveURL(/\/login$/);
      const denied = await oldSession.request.get("/api/bff/users/me");
      expect(denied.status()).toBe(401);
      checks.priorSessionStatusAfterLogout = denied.status();
      const finalUser = await query('SELECT username, "fullName", "tokenVersion", "isDemoUser", "isDemoSeed" FROM users WHERE id=$1', [accountId]);
      expect(finalUser).toEqual([{ username: renamed, fullName: updatedName, tokenVersion: 1, isDemoUser: false, isDemoSeed: false }]);
      const after = await appSnapshot();
      expect(onlyNewVisitor(before, after)).toBe(accountId);
      expect(pageErrors()).toBe(0);
      const receipt = { accountId, usernameBefore: username, usernameAfter: renamed, effects, checks,
        appBefore: before, appAfter: after, finalUser, screenshots: screenshotEvidence([errorShot, narrowShot, successShot]),
        pageErrors: 0, source: sourceBefore };
      writePrivateReceipt("pb03-observations", receipt);
      // Check navigation last so a stale link cannot hide the independent logout-revocation result.
      expect(checks.profileHrefAfterRename).toBe("/" + renamed);
      expect(checks.feedProfileHrefAfterRename).toBe("/" + renamed);
      writePrivateReceipt("pb03", receipt);
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Preserve the original failure. */ }
      writePrivateReceipt("pb03-partial", { accountId, usernameBefore: username, usernameAfter: renamed,
        effects, checks, appBefore: before, appAfter: after, reason: "account_browser_proof_incomplete", source: sourceBefore });
      throw error;
    } finally { for (const context of contexts) await context.close(); }
  });

  test("PB-03 retained account navigation uses its verified renamed identity", async ({ browser }, testInfo) => {
    await guardedReservation(0);
    const input = process.env.PB03_RENAME_RECEIPT;
    if (!input) throw new Error("PB03 rename verification requires the retained observations receipt");
    const inputPath = config.statePath(input);
    config.privateFile(inputPath);
    if (path.dirname(inputPath) !== path.join(config.STATE, "evidence") ||
      !/^v1-e2e-pb03-observations-[a-f0-9-]{36}\.json$/.test(path.basename(inputPath))) {
      throw new Error("PB03 rename receipt must be an owned observations receipt");
    }
    const prior = JSON.parse(readFileSync(inputPath, "utf8")) as {
      accountId: string; usernameBefore: string; usernameAfter: string;
      appAfter: Record<string, Record<string, string>>;
    };
    if (!/^[a-f0-9-]{36}$/.test(prior.accountId) || !/^pb03_[a-f0-9]{12}$/.test(prior.usernameBefore) ||
      prior.usernameAfter !== prior.usernameBefore + "_new") throw new Error("PB03 rename identity differs");
    const before = await appSnapshot();
    expect(before).toEqual(prior.appAfter);
    const query = async (sql: string, values: unknown[] = []) => {
      const client = await preflight.connect(runtime, "app");
      try { return (await client.query(sql, values)).rows; } finally { await client.end(); }
    };
    const accountState = () => query('SELECT username, "tokenVersion", md5((to_jsonb(u) - ARRAY[\'username\',\'tokenVersion\',\'updatedAt\'])::text) AS preserved FROM users u WHERE id=$1', [prior.accountId]);
    const initial = await accountState();
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ username: prior.usernameAfter, tokenVersion: 1 });
    const username = prior.usernameBefore + "_v2";
    expect(await query('SELECT id FROM users WHERE username=$1', [username])).toEqual([]);
    const contexts: BrowserContext[] = [];
    const navigation: Array<{ route: string; href: string | null }> = [];
    const effects: Array<{ method: string; status: number; requestId?: string }> = [];
    try {
      const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
      contexts.push(context);
      const page = await context.newPage();
      const errors = pageErrorCounter(page);
      await login(page, { id: prior.accountId, username: prior.usernameAfter, email: prior.usernameBefore + "@example.invalid" });
      await page.getByRole("link", { name: "Profile", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/" + prior.usernameAfter + "$"));
      const oldSession = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin });
      contexts.push(oldSession);
      await oldSession.addCookies(await context.cookies());
      const meBefore = await oldSession.request.get("/api/bff/users/me");
      expect(meBefore.status()).toBe(200);
      expect((await meBefore.json()).id).toBe(prior.accountId);
      await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Edit Profile", exact: true });
      await dialog.getByLabel("Username", { exact: true }).fill(username);
      const [saved] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === "PUT" && new URL(r.url()).pathname === "/api/bff/users/profile"),
        dialog.getByRole("button", { name: "Save", exact: true }).click(),
      ]);
      effects.push({ method: "PUT", status: saved.status(), requestId: saved.headers()["x-request-id"] });
      expect(saved.status()).toBe(200);
      expect(saved.headers()["x-request-id"]).toBeTruthy();
      await expect(page).toHaveURL(new RegExp("/" + username + "$"));
      await expect(dialog).not.toBeVisible();
      for (const route of ["/" + username, "/feed", "/explore", "/upload", "/notifications", "/post/" + corpus.photos[0].postId]) {
        await page.goto(route);
        const profile = page.getByRole("link", { name: "Profile", exact: true });
        await expect(profile).toHaveAttribute("href", "/" + username);
        navigation.push({ route, href: await profile.getAttribute("href") });
      }
      await page.getByRole("link", { name: "Profile", exact: true }).click();
      await expect(page).toHaveURL(new RegExp("/" + username + "$"));
      await expect(page.getByRole("button", { name: "Edit Profile", exact: true })).toBeEnabled();
      const desktop = testInfo.outputPath("pb03-profile-navigation-desktop.png");
      await page.screenshot({ path: desktop });
      await page.setViewportSize({ width: 390, height: 844 });
      const narrow = testInfo.outputPath("pb03-profile-navigation-narrow.png");
      await page.screenshot({ path: narrow });
      await page.goto("/" + prior.usernameAfter);
      await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
      await page.goto("/" + username);
      const [logout] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/bff/auth/logout"),
        page.getByRole("button", { name: "Log out", exact: true }).click(),
      ]);
      effects.push({ method: "POST", status: logout.status(), requestId: logout.headers()["x-request-id"] });
      expect(logout.status()).toBe(200);
      await page.waitForURL(/\/login$/);
      const denied = await oldSession.request.get("/api/bff/users/me");
      expect(denied.status()).toBe(401);
      expect(await accountState()).toEqual([{ ...initial[0], username, tokenVersion: 2 }]);
      const after = await appSnapshot();
      for (const [table, rows] of Object.entries(before)) {
        expect(Object.keys(after[table]).sort()).toEqual(Object.keys(rows).sort());
        for (const [id, hash] of Object.entries(rows)) {
          if (table !== "users" || id !== prior.accountId) expect(after[table][id]).toBe(hash);
        }
      }
      expect(errors()).toBe(0);
      writePrivateReceipt("pb03-navigation", { accountId: prior.accountId, usernameBefore: prior.usernameAfter,
        usernameAfter: username, priorReceiptSha256: config.hashFile(inputPath), navigation, effects,
        priorSessionStatusAfterLogout: denied.status(), appBefore: before, appAfter: after,
        screenshots: screenshotEvidence([desktop, narrow]), pageErrors: 0, source: sourceBefore });
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Preserve known effects without retry. */ }
      writePrivateReceipt("pb03-navigation-partial", { accountId: prior.accountId,
        usernameBefore: prior.usernameAfter, usernameAfter: username, effects, navigation,
        appBefore: before, appAfter: after, source: sourceBefore });
      throw error;
    } finally { for (const context of contexts) await context.close(); }
  });

  for (const width of [1280, 390]) {
    test(`PB-01 keyboard publication at ${width}px persists across sessions`, async ({ browser, page }, testInfo) => {
      await guardedReservation(1);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const errors = pageErrorCounter(page);
      const before = await appSnapshot();
      const content = `ta07-keyboard-${width}-${randomUUID()}`;
      let created: CreatedPost | undefined;
      let writes = 0;
      const observe = (request: import("@playwright/test").Request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/bff/posts") writes += 1;
      };
      writePrivateReceipt("ta07-keyboard-start", { width, content, reserve: { posts: 1 }, appBefore: before, source: sourceBefore });
      try {
        await login(page);
        await expect(page.locator("article").filter({ hasText: corpus.textPost.content }).first()).toBeVisible();
        for (const photo of corpus.photos) {
          const image = page.locator("article").filter({ has: page.locator(`a[href="/post/${photo.postId}"]`) }).getByAltText("Post media");
          await expect(image).toHaveCount(1);
          await expect.poll(() => image.evaluate((element: HTMLImageElement) => {
            element.scrollIntoView();
            return element.naturalWidth > 0;
          }).catch(() => false), { timeout: 10_000 }).toBe(true);
        }
        await page.goto("/upload");
        const draft = page.getByLabel("Post content");
        await draft.fill(content);
        await draft.focus();
        const post = page.getByRole("button", { name: "Post", exact: true });
        const tabStops: string[] = [];
        for (let step = 0; step < 12; step += 1) {
          await page.keyboard.press("Tab");
          tabStops.push(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || document.activeElement?.tagName || "none"));
          if (await post.evaluate(element => element === document.activeElement)) break;
        }
        await expect(post).toBeFocused();
        await expect(draft).toHaveValue(content);
        const focusShot = testInfo.outputPath(`pb01-keyboard-focus-${width}.png`);
        await page.screenshot({ path: focusShot, fullPage: true });
        page.on("request", observe);
        const responsePromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/posts");
        await page.keyboard.press("Enter");
        const response = await responsePromise;
        expect(response.status()).toBe(201);
        expect(response.headers()["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
        created = await response.json() as CreatedPost;
        expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
        expect(created.author).toMatchObject({ id: author.id, username: author.username });
        expect(created.content).toBe(content);
        await page.waitForURL(/\/feed$/);
        await page.reload();
        await expect(page.locator("article", { hasText: content })).toHaveCount(1);
        expect(writes).toBe(1);
        const persistedShot = testInfo.outputPath(`pb01-keyboard-persisted-${width}.png`);
        await page.screenshot({ path: persistedShot, fullPage: true });
        const fresh = await freshLogin(browser);
        try {
          await expect(fresh.page.locator("article", { hasText: content })).toHaveCount(1);
          const verification = await verifyPost(created.id);
          const after = await appSnapshot();
          for (const [table, rows] of Object.entries(after)) {
            const added = Object.keys(rows).filter(id => !Object.hasOwn(before[table] ?? {}, id));
            expect(added).toEqual(table === "posts" ? [created.id] : []);
          }
          expect(errors()).toBe(0);
          expect(fresh.errors()).toBe(0);
          writePrivateReceipt("ta07-keyboard-complete", { playbook: "PB-01", width, tabStops, writes,
            createdPost: created, requestId: response.headers()["x-request-id"], verification,
            appBefore: before, appAfter: after, screenshots: screenshotEvidence([focusShot, persistedShot]),
            assertions: ["tab-and-enter", "same-draft", "one-bff-201", "one-persisted-post", "reload", "fresh-session", "readonly-sql-verification"], source: sourceBefore });
        } finally { await fresh.context.close(); }
      } catch (error) {
        const after = await appSnapshot().catch(() => undefined);
        writePrivateReceipt("ta07-keyboard-partial", { width, content, created, writes, appBefore: before, appAfter: after, source: sourceBefore });
        throw error;
      } finally { page.off("request", observe); }
    });
  }

  test("TA07 notification-pagination preserves the first page through failure and real retry", async ({ page, request }, testInfo) => {
    const resumePath = process.env.TA07_NOTIFICATION_RESUME_RECEIPT;
    type PartialProof = {
      actors: Array<{ id: string; username: string; email: string }>;
      postId: string; commentIds: string[]; expectedIds: string[];
      appBefore: Awaited<ReturnType<typeof appSnapshot>>;
      appAfter: Awaited<ReturnType<typeof appSnapshot>>;
      source: ReturnType<typeof runtimeInventory>;
    };
    let resume: PartialProof | undefined;
    if (resumePath) {
      const selected = config.statePath(path.resolve(resumePath));
      if (path.dirname(selected) !== path.join(config.STATE, "evidence") ||
        !/^v1-e2e-ta07-notification-pagination-partial-[a-f0-9-]{36}\.json$/.test(path.basename(selected))) {
        throw new Error("TA07 resume receipt path differs");
      }
      config.privateFile(selected);
      resume = JSON.parse(readFileSync(selected, "utf8")) as PartialProof;
      expect(resume.actors).toHaveLength(2);
      expect(resume.commentIds).toHaveLength(21);
      expect(resume.expectedIds).toHaveLength(21);
      for (const id of [resume.postId, ...resume.actors.map(actor => actor.id), ...resume.commentIds, ...resume.expectedIds]) {
        expect(id).toMatch(/^[a-f0-9-]{36}$/);
      }
      expect({ ...resume.source, browserSpecSha256: sourceBefore.browserSpecSha256 }).toEqual(sourceBefore);
    }
    await guardedReservation(resume ? 0 : 45);
    const resumeBefore = await appSnapshot();
    if (resume) expect(resumeBefore).toEqual(resume.appAfter);
    const before = resume?.appBefore ?? resumeBefore;
    const label = resume ? resume.actors[0].username.match(/^ta07_recipient_([a-f0-9]{14})$/)?.[1]
      : randomUUID().replaceAll("-", "").slice(0, 14);
    if (!label) throw new Error("TA07 resume actor label differs");
    const actors = resume?.actors ?? ["recipient", "commenter"].map(role => ({
      id: "", username: `ta07_${role}_${label}`, email: `ta07_${role}_${label}@example.invalid`,
    }));
    for (const [index, role] of ["recipient", "commenter"].entries()) {
      expect(actors[index].username).toBe(`ta07_${role}_${label}`);
      expect(actors[index].email).toBe(`ta07_${role}_${label}@example.invalid`);
    }
    if (resume) {
      const client = await preflight.connect(runtime, "app");
      try {
        const users = await client.query('SELECT id, username, email FROM users WHERE id = ANY($1::uuid[]) ORDER BY id', [actors.map(actor => actor.id)]);
        expect(users.rows).toEqual([...actors].sort((a, b) => a.id.localeCompare(b.id)));
        const post = await client.query('SELECT id, "authorId", content FROM posts WHERE id = $1', [resume.postId]);
        expect(post.rows).toEqual([{ id: resume.postId, authorId: actors[0].id, content: `TA07 notification target ${label}` }]);
        const comments = await client.query('SELECT id, "authorId", "postId", content FROM comments WHERE "postId" = $1', [resume.postId]);
        expect(comments.rows.map(row => row.id).sort()).toEqual([...resume.commentIds].sort());
        expect(comments.rows.map(row => row.content).sort()).toEqual(Array.from({ length: 21 }, (_, index) => `TA07 comment ${label} ${index}`).sort());
        for (const row of comments.rows) expect(row).toMatchObject({ authorId: actors[1].id, postId: resume.postId });
        const notifications = await client.query('SELECT id, "actorId", "postId", type FROM notifications WHERE "recipientId" = $1 ORDER BY "createdAt" DESC, id DESC', [actors[0].id]);
        expect(notifications.rows.map(row => row.id)).toEqual(resume.expectedIds);
        for (const row of notifications.rows) expect(row).toMatchObject({ actorId: actors[1].id, postId: resume.postId, type: "comment" });
      } finally { await client.end(); }
    }
    const resumedFrom = resumePath ? { path: resumePath, sha256: config.hashFile(resumePath) } : undefined;
    const tokens: string[] = [];
    let postId: string | undefined = resume?.postId;
    const commentIds: string[] = [...(resume?.commentIds ?? [])];
    const cursors: string[] = [];
    const expectedIds: string[] = [];
    let injectedFailures = 0;
    const errors = pageErrorCounter(page);
    writePrivateReceipt("ta07-notification-pagination-start", { actors, reserve: resume ? { rows: 0 } : { users: 2, posts: 1, comments: 21, notifications: 21 }, resumedFrom, resumeBefore, appBefore: before, source: sourceBefore });
    try {
      for (const actor of resume ? [actors[0]] : actors) {
        if (!resume) {
          const response = await request.post(`${runtime.apiOrigin}/api/auth/register`, {
            data: { ...actor, id: undefined, fullName: "Notification proof actor", password: runtime.secrets.ISNTGRAM_V1_FIXTURE_PASSWORD },
          });
          expect(response.status()).toBe(201);
          actor.id = (await response.json()).user.id;
          writePrivateReceipt("ta07-notification-pagination-progress", { actors, postId, commentIds, source: sourceBefore });
        }
        const session = await request.post(`${runtime.apiOrigin}/api/auth/login`, {
          data: { email: actor.email, password: runtime.secrets.ISNTGRAM_V1_FIXTURE_PASSWORD },
        });
        expect(session.status()).toBe(200);
        tokens.push((await session.json()).accessToken);
      }
      const targetContent = `TA07 notification target ${label}`;
      if (!resume) {
        const post = await request.post(`${runtime.apiOrigin}/api/posts`, {
          headers: { Authorization: `Bearer ${tokens[0]}` }, data: { content: targetContent },
        });
        expect(post.status()).toBe(201);
        postId = (await post.json()).id;
        expect(postId).toMatch(/^[0-9a-f-]{36}$/i);
        writePrivateReceipt("ta07-notification-pagination-progress", { actors, postId, commentIds, source: sourceBefore });
        for (let index = 0; index < 21; index += 1) {
          const comment = await request.post(`${runtime.apiOrigin}/api/posts/${postId}/comments`, {
            headers: { Authorization: `Bearer ${tokens[1]}` }, data: { content: `TA07 comment ${label} ${index}` },
          });
          expect(comment.status()).toBe(201);
          commentIds.push((await comment.json()).id);
          writePrivateReceipt("ta07-notification-pagination-progress", { actors, postId, commentIds, source: sourceBefore });
        }
      }
      const firstResponse = await request.get(`${runtime.apiOrigin}/api/notifications`, { headers: { Authorization: `Bearer ${tokens[0]}` } });
      expect(firstResponse.status()).toBe(200);
      const first = await firstResponse.json() as { items: Array<{ id: string }>; nextCursor: string };
      expect(first.items).toHaveLength(20);
      expect(typeof first.nextCursor).toBe("string");
      const secondResponse = await request.get(`${runtime.apiOrigin}/api/notifications?cursor=${encodeURIComponent(first.nextCursor)}`, { headers: { Authorization: `Bearer ${tokens[0]}` } });
      expect(secondResponse.status()).toBe(200);
      const second = await secondResponse.json() as { items: Array<{ id: string }>; nextCursor?: string };
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeFalsy();
      expectedIds.push(...first.items.map(item => item.id), ...second.items.map(item => item.id));
      expect(new Set(expectedIds).size).toBe(21);
      if (resume) expect(expectedIds).toEqual(resume.expectedIds);
      const client = await preflight.connect(runtime, "app");
      try {
        const rows = await client.query('SELECT id FROM notifications WHERE "recipientId" = $1 ORDER BY "createdAt" DESC, id DESC', [actors[0].id]);
        expect(rows.rows.map(row => row.id)).toEqual(expectedIds);
      } finally { await client.end(); }
      writePrivateReceipt("ta07-notification-pagination-fixture", { actors, postId, targetContent, commentIds, expectedIds, firstCursor: first.nextCursor, appBefore: before, source: sourceBefore });
      await login(page, actors[0]);
      await page.route("**/api/bff/notifications?*", route => {
        const cursor = new URL(route.request().url()).searchParams.get("cursor");
        if (!cursor) return route.continue();
        cursors.push(cursor);
        if (injectedFailures === 0) {
          injectedFailures += 1;
          return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Temporary notification failure" }) });
        }
        return route.continue();
      });
      const navigation = await page.goto("/notifications");
      expect(navigation?.status()).toBe(200);
      const serverHtml = await navigation!.text();
      // Notification IDs are serialized by the real server render, not exposed as UI copy.
      const positions = first.items.map(item => serverHtml.indexOf(item.id));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      const items = page.getByRole("list", { name: "Notifications", exact: true }).getByRole("listitem");
      await expect(items).toHaveCount(20);
      const firstLabels = await items.allTextContents();
      await page.getByRole("button", { name: "Load more", exact: true }).click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText("Your earlier notifications are still here");
      await expect(items).toHaveCount(20);
      expect((await items.allTextContents()).map(text => text.replace(/\d+[smhd]\s*$/, ""))).toEqual(firstLabels.map(text => text.replace(/\d+[smhd]\s*$/, "")));
      await expect(page.getByText("No notifications yet.", { exact: true })).toHaveCount(0);
      const realPageTwo = page.waitForResponse(response => new URL(response.url()).pathname === "/api/bff/notifications" && response.status() === 200);
      await page.getByRole("button", { name: "Retry load more", exact: true }).click();
      const retried = await realPageTwo;
      expect((await retried.json()).items.map((item: { id: string }) => item.id)).toEqual(second.items.map(item => item.id));
      expect(cursors).toEqual([first.nextCursor, first.nextCursor]);
      await expect(items).toHaveCount(21);
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Load more", exact: true })).toHaveCount(0);
      const shot = testInfo.outputPath("ta07-notification-pagination.png");
      await page.screenshot({ path: shot, fullPage: true });
      await items.last().getByRole("link").click();
      await expect(page).toHaveURL(new RegExp(`/post/${postId}$`));
      await expect(page.getByRole("article")).toContainText(targetContent);
      const after = await appSnapshot();
      if (resume) expect(after).toEqual(resumeBefore);
      assertRetainedRows(before, after);
      const counts: Record<string, number> = { users: 2, posts: 1, comments: 21, notifications: 21 };
      for (const [table, rows] of Object.entries(after)) expect(Object.keys(rows).filter(id => !Object.hasOwn(before[table] ?? {}, id))).toHaveLength(counts[table] ?? 0);
      expect(errors()).toBe(0);
      writePrivateReceipt("ta07-notification-pagination-complete", { actors, postId, commentIds, expectedIds, firstPageSerializedOrder: positions, cursors, injectedFailures, renderedCount: 21, resumedFrom, resumeBefore, appBefore: before, appAfter: after, screenshots: screenshotEvidence([shot]), source: sourceBefore });
    } catch (error) {
      const after = await appSnapshot().catch(() => undefined);
      writePrivateReceipt("ta07-notification-pagination-partial", { actors, postId, commentIds, expectedIds, cursors, injectedFailures, resumedFrom, resumeBefore, appBefore: before, appAfter: after, source: sourceBefore });
      throw error;
    } finally { await page.unroute("**/api/bff/notifications?*"); }
  });

  test("PB04 read-only photo preview and presign failure retain the draft", async ({ browser }, testInfo) => {
    await guardedReservation(0);
    const photo = corpus.photos[0];
    const original = path.join(config.ROOT, "fixtures/v1/images", photo.original.fileName);
    expect(config.hashFile(original)).toBe(photo.original.sha256);
    const before = await appSnapshot();
    const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = pageErrorCounter(page);
    const requests = { presign: 0, put: 0, publish: 0 };
    let injectedFailures = 0;
    let blockedUnexpectedWrites = 0;
    const checks: Record<string, boolean> = {};
    page.on("request", (request) => {
      const pathname = new URL(request.url()).pathname;
      if (request.method() === "PUT") requests.put += 1;
      if (request.method() === "POST" && pathname === "/api/bff/posts") requests.publish += 1;
      if (request.method() === "POST" && pathname === "/api/bff/media/presign") requests.presign += 1;
    });
    await context.route("**/*", (route) => {
      const method = route.request().method();
      const pathname = new URL(route.request().url()).pathname;
      if (["PUT", "PATCH", "DELETE"].includes(method) || (method === "POST" && !pathname.startsWith("/api/auth/"))) {
        blockedUnexpectedWrites += 1;
        return route.abort("blockedbyclient");
      }
      return route.fallback();
    });
    // This browser-local failure prevents a media intent from reaching the API.
    await page.route("**/api/bff/media/presign", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      injectedFailures += 1;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Photo upload temporarily unavailable" }) });
    });
    try {
      await login(page);
      await page.goto("/upload");
      const draft = "A retained draft for the photo recovery check.";
      const content = page.getByRole("textbox", { name: "Post content", exact: true });
      const file = page.getByLabel("Upload image", { exact: true });
      const preview = page.getByAltText("Selected image preview", { exact: true });
      await content.fill(draft);
      await content.press("Tab");
      await expect(file).toBeFocused();
      checks.fileControlKeyboardReachable = true;
      // The native picker is replaced by Playwright's file selection; no OS-dialog proof is claimed.
      await file.setInputFiles(original);
      await expect(page.getByText(photo.original.fileName, { exact: true })).toBeVisible();
      await expect(preview).toBeVisible();
      await expect.poll(() => preview.evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(true);
      await file.press("Tab");
      const remove = page.getByRole("button", { name: "Remove", exact: true });
      await expect(remove).toBeFocused();
      await remove.press("Enter");
      await expect(preview).toHaveCount(0);
      await expect(page.getByText("No photo selected", { exact: true })).toBeVisible();
      expect(await file.evaluate((node: HTMLInputElement) => node.files?.length)).toBe(0);
      await expect(content).toHaveValue(draft);
      checks.removeRetainsDraft = true;
      await file.setInputFiles(original);
      await expect(preview).toBeVisible();
      await expect.poll(() => preview.evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(true);
      checks.reselectionRenders = true;
      const post = page.getByRole("button", { name: "Post", exact: true });
      await post.focus();
      await post.press("Enter");
      await expect(page.getByRole("alert").filter({ hasText: "Photo upload temporarily unavailable" })).toBeVisible();
      await expect(content).toHaveValue(draft);
      await expect(preview).toBeVisible();
      await expect(page.getByText(photo.original.fileName, { exact: true })).toBeVisible();
      await expect(file).toBeEnabled();
      await expect(remove).toBeEnabled();
      await expect(post).toBeEnabled();
      checks.failedPresignRetainsDraftAndPhoto = true;
      expect(requests).toEqual({ presign: 1, put: 0, publish: 0 });
      expect(injectedFailures).toBe(1);
      expect(blockedUnexpectedWrites).toBe(0);
      expect(errors()).toBe(0);
      const after = await appSnapshot();
      expect(after).toEqual(before);
      const shot = testInfo.outputPath("pb04-presign-failure-narrow.png");
      await page.screenshot({ path: shot, fullPage: true });
      writePrivateReceipt("pb04-readonly-failure", { photoFile: photo.original.fileName, photoSha256: photo.original.sha256,
        checks, requests, injectedFailures, blockedUnexpectedWrites, appBefore: before, appAfter: after, pageErrors: 0,
        screenshots: screenshotEvidence([shot]), source: sourceBefore });
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Retain the original failure. */ }
      writePrivateReceipt("pb04-readonly-failure-partial", { checks, requests, injectedFailures, blockedUnexpectedWrites, appBefore: before, appAfter: after, source: sourceBefore });
      throw error;
    } finally { await context.close(); }
  });

  test("PB04 invalid photo and direct media post requests are refused", async ({ browser }, testInfo) => {
    await guardedReservation(3);
    const before = await appSnapshot();
    const missingUploadId = randomUUID();
    expect(Object.hasOwn(before.media_uploads, missingUploadId)).toBe(false);
    const client = await preflight.connect(runtime, "app");
    let existingMediaUrl: string;
    try {
      const known = await client.query('SELECT "mediaUrl" FROM posts WHERE id = $1', [corpus.photos[0].postId]);
      if (typeof known.rows[0]?.mediaUrl !== "string") throw new Error("Known photo URL is missing");
      existingMediaUrl = known.rows[0].mediaUrl;
    } finally { await client.end(); }
    const context = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = pageErrorCounter(page);
    let presignRequests = 0;
    let blockedPutRequests = 0;
    const responses: Array<{ scenario: string; status: number; requestId?: string; message: unknown }> = [];
    await context.route("**/*", (route) => {
      if (route.request().method() === "PUT") { blockedPutRequests += 1; return route.abort("blockedbyclient"); }
      return route.fallback();
    });
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/bff/media/presign") presignRequests += 1;
    });
    try {
      await login(page);
      await page.goto("/upload");
      const draft = "A retained draft for invalid-photo checks.";
      const content = page.getByRole("textbox", { name: "Post content", exact: true });
      const file = page.getByLabel("Upload image", { exact: true });
      const post = page.getByRole("button", { name: "Post", exact: true });
      await content.fill(draft);
      await file.setInputFiles({ name: "invalid-photo.txt", mimeType: "text/plain", buffer: Buffer.from("This is deliberately not an image.") });
      const rejectedPresign = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/media/presign");
      await post.click();
      const rejected = await rejectedPresign;
      responses.push({ scenario: "unsupported-photo-type", status: rejected.status(), requestId: rejected.headers()["x-request-id"], message: (await rejected.json()).message });
      expect(rejected.status()).toBe(400);
      expect(rejected.headers()["x-request-id"]).toBeTruthy();
      await expect(page.getByRole("alert").filter({ hasText: "Unsupported media type" })).toBeVisible();
      await expect(content).toHaveValue(draft);
      await expect(file).toBeEnabled();
      await expect(post).toBeEnabled();
      expect(await appSnapshot()).toEqual(before);

      await file.setInputFiles({ name: "too-large.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
      await post.click();
      await expect(page.getByRole("alert").filter({ hasText: "Image is too large" })).toBeVisible();
      await expect(content).toHaveValue(draft);
      await expect(file).toBeEnabled();
      await expect(post).toBeEnabled();
      expect(presignRequests).toBe(1);

      for (const candidate of [
        { scenario: "bare-existing-media-url", body: { content: "Rejected bare media URL", mediaUrl: existingMediaUrl } },
        { scenario: "missing-upload-intent", body: { content: "Rejected missing upload", mediaUploadId: missingUploadId } },
      ]) {
        const result = await page.evaluate(async ({ body }) => {
          const cookie = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("isntgram-csrf="));
          if (!cookie) throw new Error("Browser CSRF token is missing");
          const csrf = decodeURIComponent(cookie.slice("isntgram-csrf=".length));
          const response = await fetch("/api/bff/posts", { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify(body) });
          const data = await response.json();
          return { status: response.status, requestId: response.headers.get("x-request-id") ?? undefined, message: data.message };
        }, { body: candidate.body });
        responses.push({ scenario: candidate.scenario, ...result });
        expect(result.status).toBe(candidate.scenario === "bare-existing-media-url" ? 400 : 404);
        expect(result.requestId).toBeTruthy();
        expect(await appSnapshot()).toEqual(before);
      }
      expect(blockedPutRequests).toBe(0);
      expect(errors()).toBe(0);
      const after = await appSnapshot();
      expect(after).toEqual(before);
      const shot = testInfo.outputPath("pb04-invalid-photo-narrow.png");
      await page.screenshot({ path: shot, fullPage: true });
      writePrivateReceipt("pb04-invalid-media", { responses, presignRequests, blockedPutRequests, appBefore: before, appAfter: after, pageErrors: 0,
        screenshots: screenshotEvidence([shot]), source: sourceBefore });
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Preserve the original failure and retained effects. */ }
      writePrivateReceipt("pb04-invalid-media-partial", { responses, presignRequests, blockedPutRequests, appBefore: before, appAfter: after, source: sourceBefore });
      throw error;
    } finally { await context.close(); }
  });

  test("T23 browser publishes one real photo with private pending and verified public bytes", async ({ page }, testInfo) => {
    const errors = pageErrorCounter(page);
    const photo = corpus.photos[0];
    const original = path.join(config.ROOT, "fixtures/v1/images", photo.original.fileName);
    expect(config.hashFile(original)).toBe(photo.original.sha256);
    const before = await appSnapshot();
    if (Object.keys(before.media_uploads).length + 1 > 100) throw new Error("Upload-intent limit reached");
    let postId: string | undefined;
    let uploadId: string | undefined;
    try {
      await login(page);
      await page.goto("/upload");
      const content = `v1-photo-${Date.now()}: ${photo.caption}`;
      await page.getByLabel("Post content").fill(content);
      await page.getByLabel("Upload image").setInputFiles(original);
      const presignPromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/media/presign");
      const putPromise = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).origin === "http://127.0.0.1:48333");
      const publishPromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/posts");
      await page.getByRole("button", { name: "Post", exact: true }).click();
      const presignResponse = await presignPromise;
      expect(presignResponse.status()).toBe(201);
      const presign = await presignResponse.json() as { uploadId: string; publicUrl: string };
      uploadId = presign.uploadId;
      expect(uploadId).toMatch(/^[0-9a-f-]{36}$/);
      const putResponse = await putPromise;
      expect(putResponse.status()).toBe(200);
      const published = await publishPromise;
      expect(published.status()).toBe(201);
      const post = await published.json() as CreatedPost;
      postId = post.id;
      expect(post.content).toBe(content);
      expect(post.author.id).toBe(author.id);
      expect(post.mediaUrl).toMatch(/^http:\/\/127\.0\.0\.1:48333\/isntgram-v1-media\/published\//);
      await page.waitForURL(/\/feed$/);
      await page.reload();
      const image = page.locator("article").filter({ hasText: content }).getByAltText("Post media");
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth > 0)).toBe(true);
      const publicRead = await fetch(post.mediaUrl!, { signal: AbortSignal.timeout(5000), redirect: "error" });
      expect(publicRead.status).toBe(200);
      expect(Number(publicRead.headers.get("content-length"))).toBe(photo.validated.bytes);
      const bytes = Buffer.from(await publicRead.arrayBuffer());
      expect(bytes.length).toBe(photo.validated.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(photo.validated.sha256);
      expect(presign.publicUrl).toBe(`http://127.0.0.1:48333/isntgram-v1-media/pending/${author.id}/${uploadId}`);
      const pendingRead = await fetch(presign.publicUrl, { signal: AbortSignal.timeout(5000), redirect: "error" });
      expect(pendingRead.status).toBe(403);
      const verification = await verifyPost(post.id, true);
      const after = await appSnapshot();
      expect(Object.keys(after.posts).filter(id => !Object.hasOwn(before.posts, id))).toEqual([post.id]);
      expect(Object.keys(after.media_uploads).filter(id => !Object.hasOwn(before.media_uploads, id))).toEqual([uploadId]);
      for (const table of Object.keys(before)) {
        for (const [id, hash] of Object.entries(before[table])) {
          if (table === "users" && id === author.id) continue; // Confirmed publication increments this actor's postsCount.
          expect(after[table][id]).toBe(hash);
        }
      }
      const screenshot = testInfo.outputPath("t23-published-photo.png");
      await page.screenshot({ path: screenshot, fullPage: true });
      expect(errors()).toBe(0);
      writePrivateReceipt("t23-photo", { postId, uploadId, requestId: published.headers()["x-request-id"],
        content, publicChecksum: photo.validated.sha256, bytes: bytes.length,
        pendingAnonymousStatus: 403, publicAnonymousStatus: 200, verify: verification,
        appBefore: before, appAfter: after, screenshots: screenshotEvidence([screenshot]),
        pageErrors: errors(), source: sourceBefore });
    } catch (error) {
      let appAfter: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { appAfter = await appSnapshot(); } catch { /* Retain the original failure if the dependency is unavailable. */ }
      writePrivateReceipt("t23-photo-partial", { postId, uploadId, reason: "browser_photo_proof_incomplete",
        appBefore: before, appAfter, snapshotAvailable: Boolean(appAfter), source: sourceBefore });
      throw error;
    }
  });

  for (const outcome of ["upload-timeout", "uncertain-publication"] as const) {
    test(`TA08 ${outcome} retains the original photo attempt`, async ({ page, browser }, testInfo) => {
      test.setTimeout(120_000);
      await guardedReservation(outcome === "upload-timeout" ? 1 : 2);
      const before = await appSnapshot();
      if (Object.keys(before.media_uploads).length + 1 > 100) throw new Error("Upload-intent limit reached");
      const photo = corpus.photos[0];
      const original = path.join(config.ROOT, "fixtures/v1/images", photo.original.fileName);
      expect(config.hashFile(original)).toBe(photo.original.sha256);
      const content = `ta08-${outcome}-${randomUUID()}: ${photo.caption}`;
      const apiRequire = createRequire(path.join(config.ROOT, "apps/api/package.json"));
      const { ListObjectsV2Command } = apiRequire("@aws-sdk/client-s3");
      const { createClient } = require("../apps/api/scripts/v1/storage-capabilities.cjs");
      const objectClient = createClient(runtime);
      const bucket = "isntgram-v1-media";
      const objectKeys = async () => {
        const result = await objectClient.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000 }),
          { abortSignal: AbortSignal.timeout(5000) }) as { IsTruncated?: boolean; Contents?: Array<{ Key?: string }> };
        if (result.IsTruncated) throw new Error("Object inventory exceeds bounded proof");
        return (result.Contents ?? []).map(object => object.Key).sort();
      };
      const objectsBefore = await objectKeys();
      const attempts: Array<{ content: string; mediaUploadId: string }> = [];
      let presigns = 0;
      let putRequests = 0;
      let uploadId: string | undefined;
      let committed: CreatedPost | undefined;
      let heldRoute: import("@playwright/test").Route | undefined;
      let release: (() => void) | undefined;
      let heldFinished: Promise<void> | undefined;
      let requestStarted = 0;
      let actionStarted = 0;
      const errors = pageErrorCounter(page);
      const observe = (request: import("@playwright/test").Request) => {
        const pathname = new URL(request.url()).pathname;
        if (request.method() === "POST" && pathname === "/api/bff/media/presign") presigns += 1;
        if (request.method() === "POST" && pathname === "/api/bff/posts") attempts.push(request.postDataJSON());
        if (request.method() === "PUT") putRequests += 1;
      };
      writePrivateReceipt(`ta08-${outcome}-start`, { content, reserve: { uploads: 1, posts: outcome === "upload-timeout" ? 0 : 1 }, appBefore: before, objectsBefore, source: sourceBefore });
      try {
        await login(page);
        await page.goto("/upload");
        await page.getByLabel("Post content").fill(content);
        await page.getByLabel("Upload image").setInputFiles(original);
        page.on("request", observe);
        if (outcome === "upload-timeout") {
          await page.route("**/*", route => {
            if (route.request().method() !== "PUT") return route.continue();
            requestStarted = Date.now();
            heldRoute = route;
            heldFinished = new Promise<void>(resolve => { release = resolve; });
            return heldFinished;
          });
        } else {
          await page.route("**/api/bff/posts", async route => {
            if (route.request().method() !== "POST" || heldRoute) return route.continue();
            heldRoute = route;
            requestStarted = Date.now();
            // The application commits once; only its response is withheld from this browser.
            const response = await route.fetch({ timeout: 20_000, maxRetries: 0 });
            expect(response.status()).toBe(201);
            committed = await response.json() as CreatedPost;
            writePrivateReceipt("ta08-uncertain-publication-committed", { uploadId, committed, content, source: sourceBefore });
            heldFinished = new Promise<void>(resolve => { release = resolve; });
            await heldFinished;
          });
        }
        const presignPromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/media/presign");
        actionStarted = Date.now();
        await page.getByRole("button", { name: "Post", exact: true }).click();
        const presignResponse = await presignPromise;
        expect(presignResponse.status()).toBe(201);
        uploadId = (await presignResponse.json()).uploadId;
        expect(uploadId).toMatch(/^[0-9a-f-]{36}$/i);
        writePrivateReceipt(`ta08-${outcome}-intent`, { uploadId, content, source: sourceBefore });
        const message = outcome === "upload-timeout" ? "Upload timed out" : "We could not confirm publication";
        await expect(page.getByRole("main").getByRole("alert")).toContainText(message, { timeout: 40_000 });
        const elapsedMs = Date.now() - actionStarted;
        expect(requestStarted).toBeGreaterThan(0);
        expect(elapsedMs).toBeGreaterThanOrEqual(outcome === "upload-timeout" ? 15_000 : 30_000);
        await expect(page.getByLabel("Post content")).toHaveValue(content);
        expect(await page.getByLabel("Upload image").evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe(photo.original.fileName);
        const shot = testInfo.outputPath(`ta08-${outcome}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        if (outcome === "upload-timeout") {
          expect(attempts).toEqual([]);
          await expect(page.getByRole("button", { name: "Post", exact: true })).toBeEnabled();
          expect(await objectKeys()).toEqual(objectsBefore);
        } else {
          expect(committed?.id).toMatch(/^[0-9a-f-]{36}$/i);
          expect(committed?.content).toBe(content);
          expect(attempts).toEqual([{ content, mediaUploadId: uploadId }]);
          await expect(page.getByLabel("Post content")).toBeDisabled();
          const responsePromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/posts" && response.status() === 201);
          await page.getByRole("button", { name: "Retry original photo post", exact: true }).click();
          expect((await (await responsePromise).json()).id).toBe(committed!.id);
          await page.waitForURL(/\/feed$/);
          expect(attempts).toEqual([{ content, mediaUploadId: uploadId }, { content, mediaUploadId: uploadId }]);
          const verification = await verifyPost(committed!.id, true);
          const fresh = await freshLogin(browser);
          try {
            await fresh.page.goto(`/post/${committed!.id}`);
            await expect(fresh.page.getByRole("article")).toContainText(content);
            const image = fresh.page.getByAltText("Post media");
            await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth > 0)).toBe(true);
            expect(fresh.errors()).toBe(0);
          } finally { await fresh.context.close(); }
          const response = await fetch(committed!.mediaUrl!, { signal: AbortSignal.timeout(5000), redirect: "error" });
          expect(response.status).toBe(200);
          const bytes = Buffer.from(await response.arrayBuffer());
          expect(bytes.length).toBe(photo.validated.bytes);
          expect(createHash("sha256").update(bytes).digest("hex")).toBe(photo.validated.sha256);
          const keysAfter = await objectKeys();
          const added = keysAfter.filter(key => !objectsBefore.includes(key));
          expect(added).toHaveLength(2);
          expect(added).toContain(`pending/${author.id}/${uploadId}`);
          expect(added.filter(key => key?.startsWith(`published/${author.id}/`))).toHaveLength(1);
          writePrivateReceipt("ta08-uncertain-publication-verified", { uploadId, committed, verification, objectsBefore, objectsAfter: keysAfter, checksum: photo.validated.sha256, source: sourceBefore });
        }
        expect(presigns).toBe(1);
        expect(putRequests).toBe(1);
        const after = await appSnapshot();
        for (const [table, rows] of Object.entries(after)) {
          const added = Object.keys(rows).filter(id => !Object.hasOwn(before[table] ?? {}, id));
          expect(added).toEqual(table === "media_uploads" ? [uploadId] : table === "posts" && committed ? [committed.id] : []);
        }
        for (const [table, rows] of Object.entries(before)) for (const [id, hash] of Object.entries(rows)) {
          if (committed && table === "users" && id === author.id) continue;
          expect(after[table][id]).toBe(hash);
        }
        expect(errors()).toBe(0);
        writePrivateReceipt(`ta08-${outcome}-complete`, { uploadId, committed, content, elapsedMs, presigns, putRequests, attempts, appBefore: before, appAfter: after, screenshots: screenshotEvidence([shot]), source: sourceBefore });
      } catch (error) {
        const after = await appSnapshot().catch(() => undefined);
        const keys = await objectKeys().catch(() => undefined);
        writePrivateReceipt(`ta08-${outcome}-partial`, { uploadId, committed, content, presigns, putRequests, attempts, appBefore: before, appAfter: after, objectsBefore, objectsAfter: keys, source: sourceBefore });
        throw error;
      } finally {
        // Settle the intercepted request without another mutation, even after an assertion failure.
        await heldRoute?.abort("aborted").catch(() => undefined);
        release?.();
        await heldFinished;
        await page.unrouteAll({ behavior: "wait" });
        page.off("request", observe);
        objectClient.destroy();
      }
    });
  }

  test("Curated demo session shows exactly the six credited fictional seed posts", async ({ browser }, testInfo) => {
    const context: BrowserContext = await browser.newContext({ baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin, viewport: { width: 1280, height: 900 } });
    const appBefore = await appSnapshot();
    let visitorId: string | undefined;
    try {
      const page = await context.newPage();
      const errors = pageErrorCounter(page);
      await page.goto("/login");
      let demoSignInRequests = 0;
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/auth/callback/credentials") demoSignInRequests += 1;
      });
      await page.getByRole("button", { name: "Try Our Demo" }).click();
      await page.waitForURL(/\/feed$/, { timeout: 15_000 });
      const appAfterVisitor = await appSnapshot();
      visitorId = onlyNewVisitor(appBefore, appAfterVisitor);
      await assertVisitorStartsEmpty(visitorId);
      await expect(page.getByText(/Demo session expires in/)).toBeVisible();
      await expect(page.getByText("Curated examples use fictional profiles and credited photographs. Session access expires; demo data is retained for review.")).toBeVisible();
      // /api/auth/demo is server-to-server inside NextAuth. One browser
      // credentials callback is the observable upper bound on this click.
      expect(demoSignInRequests).toBe(1);
      await expect(page.locator("article")).toHaveCount(6);
      const postLinks = await page.locator('article a[href^="/post/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(new Set(postLinks.map((href) => href?.slice("/post/".length)))).toEqual(new Set(demoPostIds));
      const authors = await page.locator("article header a").evaluateAll((links) => links.map((link) => link.getAttribute("href")?.slice(1)));
      expect(authors.every((username) => username !== undefined && demoUsernames.has(username))).toBe(true);
      expect(authors).not.toContain(author.username);
      const demoImages = page.locator("article").getByAltText("Post media");
      await expect(demoImages).toHaveCount(6);
      for (const image of await demoImages.all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth > 0)).toBe(true);
      }
      await page.getByRole("heading", { name: "Feed", exact: true }).evaluate(() => window.scrollTo(0, 0));
      const desktopScreenshot = testInfo.outputPath("pb04-demo-desktop.png");
      await page.screenshot({ path: desktopScreenshot, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      const narrowScreenshot = testInfo.outputPath("pb04-demo-narrow.png");
      await page.screenshot({ path: narrowScreenshot, fullPage: true });
      expect(errors()).toBe(0);
      const appAfter = await appSnapshot();
      expect(appAfter).toEqual(appAfterVisitor);
      const receipt = writePrivateReceipt("curated-demo", {
        check: "curated-demo-session",
        assertions: ["one-browser-demo-signin", "fictional-credited-expiry-banner", "six-demo-seed-posts", "no-ordinary-author"],
        demoSignInRequests,
        visitorId,
        postIds: demoPostIds,
        appBefore,
        appAfterVisitor,
        appAfter,
        screenshots: screenshotEvidence([desktopScreenshot, narrowScreenshot]),
        pageErrors: { demo: errors() },
        source: sourceBefore,
      });
      expect(typeof receipt).toBe("string");
    } catch (error) {
      if (visitorId) {
        writePrivateReceipt("curated-demo-partial", {
          check: "curated-demo-session",
          reason: "ui_assertion_refused_or_incomplete",
          visitorId,
          appBefore,
          appAfter: await appSnapshot(),
          source: sourceBefore,
        });
      }
      throw error;
    } finally {
      await context.close();
    }
  });

  test("Phone composer protects early input while client scripts are delayed", async ({ browser }) => {
    const phone = runtime.phoneView;
    if (!phone) throw new Error("Phone view has not been configured");
    const before = await appSnapshot();
    const context = await browser.newContext({ baseURL: phone.webOrigin, viewport: { width: 390, height: 844 } });
    let releaseScripts: () => void = () => {};
    const scriptGate = new Promise<void>(resolve => { releaseScripts = resolve; });
    try {
      const page = await context.newPage();
      await login(page);
      let delayedScripts = 0;
      await page.route("**/_next/static/**", async route => {
        if (new URL(route.request().url()).pathname.endsWith(".js")) {
          delayedScripts += 1;
          await scriptGate;
        }
        await route.continue();
      });
      await page.goto("/upload", { waitUntil: "commit" });
      const input = page.getByLabel("Post content");
      await expect(input).toBeVisible();
      const initiallyDisabled = await input.isDisabled();
      let earlyValue: string | undefined;
      if (!initiallyDisabled) {
        await input.fill("Draft entered before hydration");
        earlyValue = await input.inputValue();
      }
      releaseScripts();
      await expect(page.getByText("Demo text formatter", { exact: true })).toBeVisible();
      const afterHydration = await input.inputValue();
      const after = await appSnapshot();
      writePrivateReceipt("phone-composer-hydration", { initiallyDisabled, delayedScripts, earlyValue,
        afterHydration, appBefore: before, appAfter: after, source: sourceBefore, noSubmit: true });
      expect(after).toEqual(before);
      expect(delayedScripts).toBeGreaterThan(0);
      expect(initiallyDisabled).toBe(true);
      await expect(input).toBeEnabled();
    } finally { releaseScripts(); await context.close(); }
  });

  test("Phone HTTPS sign-in and one photo publication preserve canonical data", async ({ browser }, testInfo) => {
    const phone = runtime.phoneView;
    if (!phone) throw new Error("Phone view has not been configured");
    const before = await appSnapshot();
    if (Object.keys(before.media_uploads).length + 1 > 100) throw new Error("Upload-intent limit reached");
    const context = await browser.newContext({ baseURL: phone.webOrigin, viewport: { width: 390, height: 844 } });
    let uploadId: string | undefined;
    let postId: string | undefined;
    try {
      const page = await context.newPage();
      const errors = pageErrorCounter(page);
      await login(page);
      expect(new URL(page.url()).origin).toBe(phone.webOrigin);
      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(cookie => cookie.name.startsWith("__Secure-next-auth.session-token"));
      expect(sessionCookies.length).toBeGreaterThan(0);
      for (const cookie of sessionCookies) {
        expect(cookie.secure).toBe(true);
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toBe("Lax");
      }
      for (const photo of corpus.photos) {
        const image = page.locator("article").filter({ hasText: photo.caption }).getByAltText("Post media").last();
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth > 0)).toBe(true);
        expect(new URL((await image.getAttribute("src"))!).origin).toBe(phone.s3Origin);
      }
      const csrf = cookies.find(cookie => cookie.name === "isntgram-csrf");
      expect(csrf).toBeDefined();
      const foreign = await context.request.post(`${phone.webOrigin}/api/bff/posts`, {
        headers: { origin: "https://foreign.invalid", "x-csrf-token": decodeURIComponent(csrf!.value) },
        data: { content: "Rejected foreign-origin phone proof" },
      });
      expect(foreign.status()).toBe(403);
      expect(await foreign.json()).toEqual({ message: "Invalid origin" });
      expect(await appSnapshot()).toEqual(before);

      const photo = corpus.photos[0];
      const original = path.join(config.ROOT, "fixtures/v1/images", photo.original.fileName);
      expect(config.hashFile(original)).toBe(photo.original.sha256);
      const content = `v1-phone-${Date.now()}: ${photo.caption}`;
      await page.goto("/upload");
      await page.getByLabel("Post content").fill(content);
      await page.getByLabel("Upload image").setInputFiles(original);
      const presignPromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/media/presign");
      const putPromise = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).origin === phone.s3Origin);
      const publishPromise = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/posts");
      await page.getByRole("button", { name: "Post", exact: true }).click();
      const presignResponse = await presignPromise;
      expect(presignResponse.status()).toBe(201);
      const presign = await presignResponse.json() as { uploadId: string; uploadUrl: string };
      uploadId = presign.uploadId;
      expect(new URL(presign.uploadUrl).origin).toBe(phone.s3Origin);
      expect((await putPromise).status()).toBe(200);
      const published = await publishPromise;
      expect(published.status()).toBe(201);
      const post = await published.json() as CreatedPost;
      postId = post.id;
      expect(post.author.id).toBe(author.id);
      expect(post.content).toBe(content);
      expect(new URL(post.mediaUrl!).origin).toBe(phone.s3Origin);
      await page.waitForURL(/\/feed$/);
      await page.reload();
      await page.goto(`/post/${post.id}`);
      const image = page.getByAltText("Post media");
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth > 0)).toBe(true);
      const screenshot = testInfo.outputPath("phone-photo-detail.png");
      await page.screenshot({ path: screenshot, fullPage: true });
      const fresh = await browser.newContext({ baseURL: phone.webOrigin, viewport: { width: 390, height: 844 } });
      try {
        const freshPage = await fresh.newPage();
        await login(freshPage);
        await expect(freshPage.locator("article").filter({ hasText: content })).toHaveCount(1);
      } finally { await fresh.close(); }
      const verification = await verifyPost(post.id, true);
      const after = await appSnapshot();
      for (const [table, rows] of Object.entries(after)) {
        const additions = Object.keys(rows).filter(id => !Object.hasOwn(before[table], id));
        expect(additions).toEqual(table === "posts" ? [post.id] : table === "media_uploads" ? [uploadId] : []);
      }
      for (const [table, rows] of Object.entries(before)) for (const [id, hash] of Object.entries(rows)) {
        if (table !== "users" || id !== author.id) expect(after[table][id]).toBe(hash);
      }
      expect(errors()).toBe(0);
      writePrivateReceipt("phone-photo", { postId, uploadId, requestId: published.headers()["x-request-id"],
        secureSessionCookies: true, foreignBffStatus: 403, externalPutStatus: 200, publicationStatus: 201,
        creditedFixtureImagesLoaded: 3, freshSessionPostVisible: true, verify: verification,
        appBefore: before, appAfter: after, screenshots: screenshotEvidence([screenshot]), pageErrors: errors(), source: sourceBefore });
    } catch (error) {
      let after: Awaited<ReturnType<typeof appSnapshot>> | undefined;
      try { after = await appSnapshot(); } catch { /* Preserve original failure and retained write identifiers. */ }
      writePrivateReceipt("phone-photo-partial", { postId, uploadId, appBefore: before, appAfter: after,
        snapshotAvailable: Boolean(after), reason: "phone_browser_proof_incomplete", source: sourceBefore });
      throw error;
    } finally { await context.close(); }
  });
});

import { test, expect, type Page } from "@playwright/test";
import axe from "axe-core";
import type { RunOptions } from "axe-core";
import { randomUUID } from "node:crypto";

const apiOrigin = "http://127.0.0.1:4011";
const runId = randomUUID();
const account = {
  username: `a11y_${runId.replaceAll("-", "").slice(0, 16)}`,
  email: `a11y_${runId}@example.invalid`,
  fullName: "Accessibility fixture",
  password: `A11y-${runId}`,
};
const content = `TA06 required detail ${runId}`;
let postId: string;
type Diagnostic = { message: string; url: string };
const diagnostics = new WeakMap<Page, Diagnostic[]>();
const expectedFailures = new WeakMap<Page, Set<string>>();
const blockedRequests = new WeakMap<Page, Set<string>>();

const axeOptions: RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
};

async function expectNoA11yViolations(page: Page, label: string) {
  await page.addScriptTag({ content: axe.source });

  const results = await page.evaluate(async (options) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axeGlobal = (window as any).axe as typeof axe | undefined;
    if (!axeGlobal) throw new Error("axe not found on window");
    return axeGlobal.run(document, options);
  }, axeOptions);

  const violationSummary = results.violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  - ${node.target.join(" ")}: ${node.failureSummary ?? ""}`.trimEnd())
        .join("\n");
      return `${violation.id} (${violation.impact ?? "unknown"}) — ${violation.help}\n${nodes}`;
    })
    .join("\n\n");

  expect(results.violations, `A11y violations on ${label}:\n${violationSummary}`).toEqual([]);
}

test.describe("Accessibility (axe-core)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async ({ request }) => {
    const ready = await request.get(`${apiOrigin}/api/ready`);
    expect(ready.status()).toBe(200);
    expect(await ready.json()).toEqual({ status: "ok", database: "connected" });
    const registration = await request.post(`${apiOrigin}/api/auth/register`, { data: account });
    expect(registration.status()).toBe(201);
    const login = await request.post(`${apiOrigin}/api/auth/login`, {
      data: { email: account.email, password: account.password },
    });
    expect(login.status()).toBe(200);
    const session = (await login.json()) as { accessToken: string };
    expect(typeof session.accessToken).toBe("string");
    const post = await request.post(`${apiOrigin}/api/posts`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      data: { content },
    });
    expect(post.status()).toBe(201);
    const created = (await post.json()) as { id: string; content: string };
    expect(created.content).toBe(content);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    postId = created.id;
  });

  test.beforeEach(async ({ page }) => {
    const errors: Diagnostic[] = [];
    const blocked = new Set<string>();
    diagnostics.set(page, errors);
    blockedRequests.set(page, blocked);
    expectedFailures.set(page, new Set());
    page.on("pageerror", (error) => errors.push({ message: `pageerror: ${error.name}`, url: page.url() }));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push({ message: message.text(), url: message.location().url });
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") return route.continue();
      blocked.add(url.href);
      return route.abort("blockedbyclient");
    });
  });
  test.afterEach(async ({ page }, testInfo) => {
    const errors = diagnostics.get(page) ?? [];
    const blocked = blockedRequests.get(page) ?? new Set<string>();
    const unexpected = errors.filter(
      (error) =>
        !(blocked.has(error.url) && error.message.includes("net::ERR_BLOCKED_BY_CLIENT")) &&
        !(expectedFailures.get(page)?.has(error.url) && error.message.includes("503")),
    );
    await testInfo.attach("browser-errors", {
      body: JSON.stringify({
        errors,
        deliberatelyBlocked: [...blocked],
        simulatedFailures: [...(expectedFailures.get(page) ?? [])],
        unexpected,
      }),
      contentType: "application/json",
    });
    for (const error of testInfo.errors) console.log(error.message);
    if (testInfo.status === testInfo.expectedStatus) expect(unexpected).toEqual([]);
  });

  test("login page has no WCAG A/AA violations", async ({ page }, testInfo) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
    await expectNoA11yViolations(page, "/login");
    await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  });

  test("core authed pages and the required ordinary post detail have no WCAG A/AA violations", async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.name));
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await page.waitForURL(/\/feed$/, { timeout: 15000 });
    await expect(page.getByRole("navigation")).toBeVisible();

    await expectNoA11yViolations(page, "/feed");

    await page.goto("/explore");
    await expect(page.getByRole("textbox", { name: /search users/i })).toBeVisible();
    await expectNoA11yViolations(page, "/explore");

    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expectNoA11yViolations(page, "/notifications");

    // TA06: missing fixture or detail readiness must fail, never silently skip axe.
    expect(postId).toMatch(/^[0-9a-f-]{36}$/i);
    await page.goto(`/post/${postId}`);
    await expect(page).toHaveURL(new RegExp(`/post/${postId}$`));
    await expect(page.getByRole("article")).toContainText(content);
    await expect(page.getByPlaceholder(/add a comment/i)).toHaveCount(1);
    await expect(page.getByPlaceholder(/add a comment/i)).toBeVisible();
    await expect(page.getByPlaceholder(/add a comment/i)).toBeEnabled();
    await expectNoA11yViolations(page, "/post/[postId]");
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("required-post-detail.png"), fullPage: true });
  });

  async function logIn(page: Page) {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Log In", exact: true }).click();
    await page.waitForURL(/\/feed$/);
  }

  // These cases run after the serial fixture suite above and use its isolated account.
  test("cleanup reflows at 320px and supports native modal keyboard recovery", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/register");
    await expectNoA11yViolations(page, "register 320px");
    await page.getByLabel("Password", { exact: true }).fill("Password123");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.screenshot({ path: testInfo.outputPath("register-mobile.png"), fullPage: true });
    await logIn(page);
    for (const path of ["/feed", "/explore", "/notifications", "/upload", `/${account.username}`, `/post/${postId}`]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoA11yViolations(page, `${path} 320px`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const nav = page.getByRole("navigation");
      await expect(nav).toBeVisible();
      const targets = await nav.getByRole("link").evaluateAll((links) =>
        links.map((link) => ({
          width: link.getBoundingClientRect().width,
          height: link.getBoundingClientRect().height,
        })),
      );
      expect(targets.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${path.replaceAll("/", "_")}-mobile.png`), fullPage: true });
    }
    await page.getByRole("button", { name: "More options" }).click();
    const options = page.getByRole("dialog");
    await expect(options).toBeVisible();
    expect(await options.evaluate((node) => node.matches(":modal"))).toBe(true);
    await expectNoA11yViolations(page, "post options");
    await page.keyboard.press("Shift+Tab");
    await expect(options.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(options.getByRole("button", { name: "Copy link" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "More options" })).toBeFocused();
    await page.goto(`/${account.username}`);
    await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Edit Profile" })).toBeVisible();
    await expectNoA11yViolations(page, "edit profile");
    await page.getByLabel("Full Name", { exact: true }).fill("Unsubmitted changes");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Edit Profile", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Log out?" })).toBeVisible();
    await page.getByRole("button", { name: "Stay logged in" }).click();
    await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeFocused();
  });

  test("cleanup preserves drafts and original photo payload through visible recoveries", async ({ page }, testInfo) => {
    await logIn(page);
    await page.goto(`/post/${postId}`);
    let failComment = true;
    expectedFailures.get(page)?.add(`http://127.0.0.1:3100/api/bff/posts/${postId}/comments`);
    expectedFailures.get(page)?.add("http://127.0.0.1:3100/api/bff/posts");
    await page.route(`**/api/bff/posts/${postId}/comments`, (route) =>
      failComment && route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ message: "Synthetic outage" }),
          })
        : route.continue(),
    );
    const draft = page.getByLabel("Add a comment", { exact: true });
    await draft.fill("Keep this comment through the outage");
    await page.getByRole("button", { name: "Post comment", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Your comment wasn’t added");
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await expect(draft).toHaveValue("Keep this comment through the outage");
    failComment = false;
    await page.getByRole("button", { name: "Try posting comment again" }).click();
    await expect(draft).toHaveValue("");
    await expect(page.getByRole("list").filter({ hasText: "Keep this comment through the outage" })).toBeVisible();
    await page.goto("/upload");
    await page.getByLabel("Post text (required)", { exact: true }).fill("A day outside");
    await page.getByLabel("Photo (optional)", { exact: true }).setInputFiles({
      name: "boat.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page.getByRole("button", { name: "Publish post", exact: true }).click();
    const description = page.getByLabel("Photo description (required with a photo)", { exact: true });
    await expect(description).toBeFocused();
    await expect(description).toHaveAttribute("aria-invalid", "true");
    await description.fill("A red boat on a lake");
    let presigns = 0;
    const attempts: unknown[] = [];
    await page.route("**/api/bff/media/presign", (route) => {
      presigns++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uploadId: "99999999-9999-4999-8999-999999999999",
          uploadUrl: "http://127.0.0.1:3100/test-photo-put",
          expiresIn: 60,
          key: "test",
          publicUrl: "http://127.0.0.1:3100/test-photo",
        }),
      });
    });
    await page.route("**/test-photo-put", (route) => route.fulfill({ status: 200, body: "" }));
    let releaseFirst!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    await page.route("**/api/bff/posts", async (route) => {
      attempts.push(route.request().postDataJSON());
      if (attempts.length === 1) await held;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Synthetic unconfirmed reply" }),
      });
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Publish post", exact: true }).click();
    try {
      await expect(page.locator(".circle-loader-arm")).toHaveCount(8);
      const animations = await page
        .locator(".circle-loader-arm, .circle-loader-dot")
        .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
      expect(animations.every((value) => value === "none")).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("loader-publishing.png"), fullPage: true });
    } finally {
      releaseFirst();
    }
    await expect(page.getByRole("button", { name: "Retry original photo post" })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await expect(description).toBeDisabled();
    await expect(description).toHaveValue("A red boat on a lake");
    await page.getByRole("button", { name: "Retry original photo post" }).click();
    await expect.poll(() => attempts.length).toBe(2);
    expect(attempts).toEqual(
      Array(2).fill({
        content: "A day outside",
        mediaUploadId: "99999999-9999-4999-8999-999999999999",
        mediaAltText: "A red boat on a lake",
      }),
    );
    expect(presigns).toBe(1);
    await expect(description).toBeDisabled();
    await expectNoA11yViolations(page, "unconfirmed photo recovery");
    await page.screenshot({ path: testInfo.outputPath("photo-recovery.png"), fullPage: true });
  });
});

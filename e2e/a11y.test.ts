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
    const session = await login.json() as { accessToken: string };
    expect(typeof session.accessToken).toBe("string");
    const post = await request.post(`${apiOrigin}/api/posts`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }, data: { content },
    });
    expect(post.status()).toBe(201);
    const created = await post.json() as { id: string; content: string };
    expect(created.content).toBe(content);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    postId = created.id;
  });

  test.beforeEach(async ({ page }) => {
    const errors: Diagnostic[] = [];
    const blocked = new Set<string>();
    diagnostics.set(page, errors);
    blockedRequests.set(page, blocked);
    page.on("pageerror", error => errors.push({ message: `pageerror: ${error.name}`, url: page.url() }));
    page.on("console", message => {
      if (message.type() === "error") errors.push({ message: message.text(), url: message.location().url });
    });
    await page.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") return route.continue();
      blocked.add(url.href);
      return route.abort("blockedbyclient");
    });
  });
  test.afterEach(async ({ page }, testInfo) => {
    const errors = diagnostics.get(page) ?? [];
    const blocked = blockedRequests.get(page) ?? new Set<string>();
    const unexpected = errors.filter(error => !(blocked.has(error.url) && error.message.includes("net::ERR_BLOCKED_BY_CLIENT")));
    await testInfo.attach("browser-errors", { body: JSON.stringify({ errors, deliberatelyBlocked: [...blocked], unexpected }), contentType: "application/json" });
    if (testInfo.status === testInfo.expectedStatus) expect(unexpected).toEqual([]);
  });

  test("login page has no WCAG A/AA violations", async ({ page }, testInfo) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
    await expectNoA11yViolations(page, "/login");
    await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  });

  test("core authed pages and the required ordinary post detail have no WCAG A/AA violations", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.name));
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
    await expect(page.getByPlaceholder(/add a comment/i)).toBeVisible();
    await expect(page.getByPlaceholder(/add a comment/i)).toBeEnabled();
    await expectNoA11yViolations(page, "/post/[postId]");
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("required-post-detail.png"), fullPage: true });
  });
});

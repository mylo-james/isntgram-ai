import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { makeUniqueId } from "./test-helpers";

async function expectNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();

  // If this fails, print a compact summary to make it easy to fix locally.
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
  }));

  expect(summary, `a11y violations on ${label}`).toEqual([]);
}

test.describe("Accessibility smoke checks", () => {
  const unique = makeUniqueId();
  const user = {
    email: `a11y_${unique}@example.com`,
    username: `a11y_${unique}`,
    fullName: "A11y User",
    password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
  };

  test("feed, post detail, and search have no axe violations", async ({ page }) => {
    await page.context().clearCookies();

    const baseApi = process.env.E2E_API_URL || "http://localhost:3001";
    const res = await page.request.post(`${baseApi}/api/auth/register`, { data: user });
    expect(res.status()).toBe(201);

    // Log in via NextAuth UI
    await page.goto("/login");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForResponse(
      (r) => r.url().includes("/auth/callback/credentials") && [200, 302].includes(r.status()),
      { timeout: 20000 },
    );
    await page.waitForURL(/\/feed$/, { timeout: 20000 });
    await expect(page.getByTestId("nav-authenticated")).toBeVisible({ timeout: 20000 });

    // Feed
    await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible({ timeout: 20000 });
    const emptyState = page.getByText("No posts yet. Create one to get started.");
    await expect(page.locator("article").first().or(emptyState)).toBeVisible({ timeout: 20000 });
    await expectNoA11yViolations(page, "/feed");

    // Create a post and open detail page
    const content = `A11y post ${unique}`;
    await page.getByLabel("Create a post").fill(content);
    const postBtn = page.getByRole("button", { name: /^Post$/ });
    await expect(postBtn).toBeEnabled({ timeout: 20000 });
    await postBtn.click();
    await expect(page.getByText(content)).toBeVisible({ timeout: 20000 });

    const card = page.locator("article", { hasText: content });
    await card.getByRole("link", { name: "Open" }).first().click();
    await page.waitForURL(/\/posts\/.+/, { timeout: 20000 });
    await expect(page.getByText(content)).toBeVisible({ timeout: 20000 });
    await expectNoA11yViolations(page, "/posts/[id]");

    // Search
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible({ timeout: 20000 });
    await expectNoA11yViolations(page, "/search");
  });
});

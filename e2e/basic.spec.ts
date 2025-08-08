import { test, expect } from "@playwright/test";

test.skip(!!process.env.CI, "Skip external-network tests on CI");

test.describe("Basic E2E Tests", () => {
  test("should verify Playwright is working", async ({ page }) => {
    // Simple test to verify Playwright configuration
    await page.goto("https://playwright.dev");
    await expect(page).toHaveTitle(/Playwright/);

    // This test ensures our E2E setup is working
    // More comprehensive tests will be added as the application develops
  });

  test("should handle basic browser interactions", async ({ page }) => {
    // Use local app instead of external network to avoid flakiness
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Isntgram");

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toBeEnabled();
  });
});

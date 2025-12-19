import { test, expect } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_URL || "http://127.0.0.1:3001";

test.describe("Basic Application Flow", () => {
  test("should load the homepage", async ({ page }) => {
    await page.goto("/");

    // Check that the page loads successfully
    await expect(page).toHaveTitle(/Isntgram/i);

    // Verify main content is present
    await expect(page.locator("text=Build a signal-first social feed.")).toBeVisible();
    await expect(page.locator("text=Isntgram AI")).toBeVisible();
    await expect(page.locator('a:has-text("Create account")')).toBeVisible();
    await expect(page.locator('a:has-text("Sign in")')).toBeVisible();
  });

  test("should navigate and display content correctly", async ({ page }) => {
    await page.goto("/");

    // Check for key UI elements that exist in our current page
    await expect(page.locator("text=Curated feed")).toBeVisible();
    await expect(page.locator("text=Instant posting")).toBeVisible();
    await expect(page.locator("text=Profile clarity")).toBeVisible();

    // Verify the CTA navigation links exist
    await expect(page.locator('a:has-text("Create account")')).toBeVisible();
    await expect(page.locator('a:has-text("Sign in")')).toBeVisible();
  });

  test("should handle responsive design", async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.locator("text=Build a signal-first social feed.")).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.locator("text=Build a signal-first social feed.")).toBeVisible();
  });
});

test.describe("API Integration", () => {
  test("should connect to backend API", async ({ page }) => {
    // Verify backend is running by checking the root API response
    const response = await page.request.get(`${apiBaseUrl}/api`);
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toBe("Isntgram API");
  });

  test("should handle API errors gracefully", async ({ page }) => {
    // Our NestJS sets global prefix 'api', so use a path that returns 404
    const response = await page.request.get(`${apiBaseUrl}/api/non-existent-endpoint`);
    expect(response.status()).toBe(404);
  });
});

test.describe("Performance", () => {
  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await expect(page.locator("text=Build a signal-first social feed.")).toBeVisible();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });
});

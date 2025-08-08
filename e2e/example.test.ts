import { test, expect } from "@playwright/test";

test.describe("Basic Application Flow", () => {
  test("should load the homepage", async ({ page }) => {
    await page.goto("/");

    // Check that the page loads successfully
    await expect(page).toHaveTitle(/Isntgram/i);

    // Verify main content is present
    await expect(page.locator("text=Welcome to")).toBeVisible();
    await expect(page.locator("text=Isntgram")).toBeVisible();
    await expect(page.locator("text=Get Started")).toBeVisible();
    await expect(page.locator("text=Create Account")).toBeVisible();
  });

  test("should navigate and display content correctly", async ({ page }) => {
    await page.goto("/");

    // Check for key UI elements that exist in our current page
    await expect(page.locator("text=AI-Powered Feed")).toBeVisible();
    await expect(page.locator("text=Smart Connections")).toBeVisible();
    await expect(page.locator("text=Privacy First")).toBeVisible();

    // Verify the CTA navigation links exist
    await expect(page.locator('a:has-text("Get Started")')).toBeVisible();
    await expect(page.locator('a:has-text("Create Account")')).toBeVisible();
  });

  test("should handle responsive design", async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.locator("text=Welcome to")).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.locator("text=Welcome to")).toBeVisible();
  });
});

test.describe("API Integration", () => {
  test("should connect to backend API", async ({ page }) => {
    // Verify backend is running by checking the root API response
    const response = await page.request.get("http://localhost:3001/api");
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toBe("Hello World!");
  });

  test("should handle API errors gracefully", async ({ page }) => {
    // Our NestJS sets global prefix 'api', so use a path that returns 404
    const response = await page.request.get("http://localhost:3001/api/non-existent-endpoint");
    expect(response.status()).toBe(404);
  });
});

test.describe("Performance", () => {
  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await expect(page.locator("text=Welcome to")).toBeVisible();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });
});

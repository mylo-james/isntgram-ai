import { test, expect } from "@playwright/test";

test.describe("Basic E2E Tests", () => {
  test("should load the home page", async ({ page }) => {
    await page.goto("/");
    
    // Check that the page loads with expected content
    await expect(page.locator("h1")).toContainText("Isntgram");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("should have working navigation to auth pages", async ({ page }) => {
    await page.goto("/");
    
    // Test that navigation links work
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL("/login");
    
    await page.click('a[href="/register"]');
    await expect(page).toHaveURL("/register");
  });

  test("should have proper registration form structure", async ({ page }) => {
    await page.goto("/register");
    
    // Check that registration form has all required fields
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should have proper login form structure", async ({ page }) => {
    await page.goto("/login");
    
    // Check that login form has required fields
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

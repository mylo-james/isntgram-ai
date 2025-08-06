import { test, expect } from '@playwright/test';

test.describe('Basic Application Flow', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads successfully
    await expect(page).toHaveTitle(/Next.js/);

    // Verify main content is present
    await expect(page.locator('text=Get started by editing')).toBeVisible();
  });

  test('should navigate and display content correctly', async ({ page }) => {
    await page.goto('/');

    // Check for key UI elements
    await expect(page.locator('text=Deploy now')).toBeVisible();
    await expect(page.locator('text=Read our docs')).toBeVisible();

    // Verify the page is interactive
    const deployButton = page.locator('text=Deploy now');
    await expect(deployButton).toBeEnabled();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('text=Get started by editing')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.locator('text=Get started by editing')).toBeVisible();
  });
});

test.describe('API Integration', () => {
  test('should connect to backend API', async ({ page }) => {
    // This test will verify that the frontend can communicate with the backend
    // For now, we'll just verify the backend is running by checking the response

    const response = await page.request.get('http://localhost:3001');
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toBe('Hello World!');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Test how the application handles API errors
    const response = await page.request.get(
      'http://localhost:3001/non-existent-endpoint'
    );
    expect(response.status()).toBe(404);
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await expect(page.locator('text=Get started by editing')).toBeVisible();

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });
});

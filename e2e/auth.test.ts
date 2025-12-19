import { test, expect } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_URL || "http://127.0.0.1:3001";

test.describe("Auth E2E", () => {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const user = {
    email: `e2euser+${unique}@example.com`,
    username: `e2euser_${unique}`,
    fullName: "E2E User",
    password: "Password123!",
  };

  test("seeds user via API and logs in successfully via UI", async ({ page }) => {
    // Seed user via API (in-memory SQLite when NODE_ENV=test)
    const res = await page.request.post(`${apiBaseUrl}/api/auth/register`, {
      data: {
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        password: user.password,
      },
    });
    expect(res.status()).toBe(201);

    // Login via UI
    await page.goto("/login");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');

    // Expect redirect away from login (home redirects logged-in users to /feed)
    await page.waitForURL(/\/(feed)?$/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', "WrongPass123!");
    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid credentials|login failed/i)).toBeVisible({ timeout: 5000 });
  });
});

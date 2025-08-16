import { test, expect } from "@playwright/test";

test.describe("Auth E2E", () => {
  // Generate more unique IDs by including process ID and a larger random component
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${process.pid || Math.floor(Math.random() * 10000)}`;
  const user = {
    email: `e2euser+${unique}@example.com`,
    username: `e2euser_${unique}`,
    fullName: "E2E User",
    password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
  };

  test("seeds user via API and logs in successfully via UI", async ({ page }) => {
    await page.context().clearCookies();

    // Seed user via API (in-memory SQLite when NODE_ENV=test)
    const res = await page.request.post("http://localhost:3001/api/auth/register", {
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

    // Wait for NextAuth credentials callback to complete
    await page.waitForResponse(
      (r) => r.url().includes("/api/auth/callback/credentials") && [200, 302].includes(r.status()),
      { timeout: 20000 },
    );

    // Assert authenticated UI by header state
    await expect(page.getByTestId("nav-authenticated")).toBeVisible({ timeout: 20000 });
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto("/login");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', "WrongPass123!");
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Invalid credentials")).toBeVisible({ timeout: 10000 });
  });

  test("demo sign-in button logs in and shows demo banner (or authenticated state)", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto("/login");
    await page.click('button:has-text("Try our demo")');

    // After demo, NextAuth signs in with credentials. Wait for credentials callback
    await page.waitForResponse(
      (r) => r.url().includes("/api/auth/callback/credentials") && [200, 302].includes(r.status()),
      { timeout: 20000 },
    );

    // Prefer banner if present, else header state
    const banner = page.locator("text=Demo mode: this account is read-only");
    if (await banner.count()) {
      await expect(banner).toBeVisible({ timeout: 20000 });
    } else {
      await expect(page.getByTestId("nav-authenticated")).toBeVisible({ timeout: 20000 });
    }
  });
});

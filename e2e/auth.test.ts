import { test, expect } from "@playwright/test";
import { createTestUser, expectOnFeed, loginViaUi, registerViaApi, registerViaUi } from "./helpers/test-utils";

test.describe("Auth E2E", () => {
  test("registers via UI and logs in", async ({ page }) => {
    const user = createTestUser("register");

    await page.goto("/");
    await page.getByRole("link", { name: /create account/i }).click();
    await page.waitForURL(/\/register$/, { timeout: 5000 });

    await registerViaUi(page, user, { navigate: false });
    await expect(page.getByText(/registration successful/i)).toBeVisible({ timeout: 10000 });
    await page.waitForURL(/\/login\?message=/, { timeout: 15000 });
    await expect(page.getByText(/registration successful/i)).toBeVisible();

    await loginViaUi(page, user, { navigate: false });
    await expectOnFeed(page);
  });

  test("shows error on invalid credentials", async ({ page, request }) => {
    const user = await registerViaApi(request, createTestUser("bad-login"));

    await page.goto("/");
    await page.getByRole("link", { name: /sign in/i }).click();
    await page.waitForURL(/\/login$/, { timeout: 5000 });

    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill("WrongPass123!");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page.getByText(/invalid credentials|login failed/i)).toBeVisible({ timeout: 5000 });
  });
});

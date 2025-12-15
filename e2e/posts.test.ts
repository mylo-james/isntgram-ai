import { test, expect } from "@playwright/test";
import { makeUniqueId } from "./test-helpers";

test.describe("Posts E2E", () => {
  const unique = makeUniqueId();
  const user = {
    email: `post_${unique}@example.com`,
    username: `post_${unique}`,
    fullName: "Post User",
    password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
  };

  test("user can create a post from upload and open the detail page", async ({ page }) => {
    await page.context().clearCookies();

    const baseApi = process.env.E2E_API_URL || "http://localhost:3001";
    const res = await page.request.post(`${baseApi}/api/auth/register`, { data: user });
    expect(res.status()).toBe(201);

    await page.goto("/login");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');

    await page.waitForResponse(
      (r) => r.url().includes("/auth/callback/credentials") && [200, 302].includes(r.status()),
      { timeout: 20000 },
    );

    await page.waitForURL(/\/feed$/, { timeout: 20000 });

    const content = `Hello from Playwright ${unique}`;
    await page.getByRole("link", { name: "Upload" }).click();
    await page.waitForURL(/\/upload$/, { timeout: 20000 });

    await page.getByLabel(/Add a Caption/i).fill(content);
    await page.getByRole("button", { name: /^Upload$/ }).click();

    await expect(page.getByText(content)).toBeVisible({ timeout: 20000 });

    const likeBtn = page.getByRole("button", { name: "Like post" });
    await expect(likeBtn).toBeVisible({ timeout: 20000 });
    await likeBtn.click();
    await expect(page.getByRole("button", { name: "Unlike post" })).toBeVisible({ timeout: 20000 });

    const comment = `Nice post! ${unique}`;
    await page.getByLabel("Add a comment").fill(comment);
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText(comment)).toBeVisible({ timeout: 20000 });
  });
});

import { test, expect } from "@playwright/test";
import { makeUniqueId } from "./test-helpers";

test.describe("Explore/Search E2E", () => {
  const unique = makeUniqueId();
  const tag = `pw${unique}`;
  const user = {
    email: `explore_${unique}@example.com`,
    username: `explore_${unique}`,
    fullName: "Explore User",
    password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
  };

  test("user can navigate via hashtag to search and find the post", async ({ page }) => {
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

    const content = `Hello from Explore/Search #${tag}`;
    await page.getByLabel("Create a post").fill(content);
    await page.getByRole("button", { name: /^Post$/ }).click();

    // Hashtag link should be rendered and navigable
    await expect(page.getByRole("link", { name: `#${tag}` })).toBeVisible({ timeout: 20000 });
    await page.getByRole("link", { name: `#${tag}` }).click();

    await expect(page).toHaveURL(new RegExp(`/search\\?q=%23${tag}`));
    await expect(page.getByText("Posts")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(`#${tag}`)).toBeVisible({ timeout: 20000 });

    // Explore page should show the post too
    await page.goto("/explore");
    await expect(page.getByRole("link", { name: `#${tag}` })).toBeVisible({ timeout: 20000 });
  });
});

import { test, expect } from "@playwright/test";

function uniqueId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("Follow/Unfollow E2E", () => {
  const unique = uniqueId();
  const userA = {
    email: `fua_${unique}@example.com`,
    username: `fua_${unique}`,
    fullName: "Follow User A",
    password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
  };
  const userB = {
    email: `fub_${unique}@example.com`,
    username: `fub_${unique}`,
    fullName: "Follow User B",
    password: process.env.E2E_TEST_PASSWORD || "TestPassword123!",
  };

  test("user A can follow and unfollow user B from profile page", async ({ page }) => {
    await page.context().clearCookies();

    // Seed users via API
    const baseApi = process.env.E2E_API_URL || "http://localhost:3001";
    const resA = await page.request.post(`${baseApi}/api/auth/register`, {
      data: userA,
    });
    expect(resA.status()).toBe(201);

    const resB = await page.request.post(`${baseApi}/api/auth/register`, {
      data: userB,
    });
    expect(resB.status()).toBe(201);

    // Login as A via UI
    await page.goto("/login");
    await page.fill('input[name="email"]', userA.email);
    await page.fill('input[name="password"]', userA.password);
    await page.click('button[type="submit"]');

    // Wait for NextAuth credentials callback to complete
    await page.waitForResponse(
      (r) => r.url().includes("/api/auth/callback/credentials") && [200, 302].includes(r.status()),
      {
        timeout: 20000,
      },
    );
    await page.waitForURL(/\/$/, { timeout: 20000 });

    // Go to B's profile page
    await page.goto(`/${userB.username}`);

    // Wait for profile header H1 to contain the username
    await expect(page.getByRole("heading", { level: 1 })).toContainText(userB.username, { timeout: 20000 });

    // Wait for Follow button by aria-label or text
    const followByAria = page.getByRole("button", {
      name: new RegExp(`^(Follow ${userB.username}|Unfollow ${userB.username})$`, "i"),
    });
    const followByText = page.getByRole("button", { name: /^(Follow|Following)$/i });
    await expect(followByAria.or(followByText)).toBeVisible({ timeout: 20000 });

    // Determine the current button
    const btn = followByAria.or(followByText);

    // Click to follow
    await btn.click();

    // Expect state to turn to Following (visible text)
    await expect(page.getByRole("button", { name: /^(Following|Unfollow)/i })).toBeVisible({ timeout: 20000 });

    // Click to unfollow (target by aria-label Unfollow or visible Following)
    const unfollowBtn = page.getByRole("button", { name: new RegExp(`^(Unfollow ${userB.username}|Following)$`, "i") });
    await unfollowBtn.click();

    // Expect state to return to Follow
    await expect(page.getByRole("button", { name: /^(Follow|Follow .*?)$/i })).toBeVisible({ timeout: 20000 });
  });
});

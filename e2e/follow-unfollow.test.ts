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
    password: "Password123!",
  };
  const userB = {
    email: `fub_${unique}@example.com`,
    username: `fub_${unique}`,
    fullName: "Follow User B",
    password: "Password123!",
  };

  test("user A can follow and unfollow user B from profile page", async ({ page }) => {
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
    await page.waitForURL(/\/$/, { timeout: 15000 });

    // Go to B's profile page
    await page.goto(`/${userB.username}`);

    // Wait for Follow button
    const followBtn = page.getByRole("button", { name: new RegExp(`^(Follow|Unfollow ${userB.username}|Following)$`, "i") });
    await expect(followBtn).toBeVisible({ timeout: 15000 });

    // Ensure initial state is Follow (may briefly load)
    const labelLocator = page.getByRole("button", { name: new RegExp(`^(Follow|Unfollow ${userB.username}|Following)$`, "i") });

    // Click to follow
    await followBtn.click();

    // Expect state to turn to Following
    await expect(labelLocator).toHaveText(/Following/i, { timeout: 10000 });

    // Click to unfollow
    await labelLocator.click();

    // Expect state to return to Follow
    await expect(labelLocator).toHaveText(/Follow/i, { timeout: 10000 });
  });
});

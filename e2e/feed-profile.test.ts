import { test, expect } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_URL || "http://127.0.0.1:3001";

test.describe("Feed + Profile smoke", () => {
  test("user can follow, post, and see updates across feed and profile", async ({ page }) => {
    const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const userA = {
      email: `e2e_a_${unique}@example.com`,
      username: `e2e_a_${unique}`,
      fullName: "E2E User A",
      password: "Password123!",
    };
    const userB = {
      email: `e2e_b_${unique}@example.com`,
      username: `e2e_b_${unique}`,
      fullName: "E2E User B",
      password: "Password123!",
    };

    const postA = `E2E post A ${unique}`;
    const postB = `E2E post B ${unique}`;

    const registerUser = async (user: typeof userA) => {
      const res = await page.request.post(`${apiBaseUrl}/api/auth/register`, {
        data: {
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          password: user.password,
        },
      });
      expect(res.status()).toBe(201);
    };

    const loginUser = async (user: typeof userA) => {
      const res = await page.request.post(`${apiBaseUrl}/api/auth/login`, {
        data: {
          email: user.email,
          password: user.password,
        },
      });
      expect(res.status()).toBe(200);
      return res.json();
    };

    await registerUser(userA);
    await registerUser(userB);

    const loginB = await loginUser(userB);
    const tokenB = loginB.accessToken as string;

    const createPostRes = await page.request.post(`${apiBaseUrl}/api/posts`, {
      data: { content: postB },
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    expect(createPostRes.status()).toBe(201);

    // Login as user A via UI
    await page.goto("/login");
    await page.fill('input[name="email"]', userA.email);
    await page.fill('input[name="password"]', userA.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/(feed)?$/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Your curated feed" })).toBeVisible();

    // Create a post via feed composer
    const composer = page.getByPlaceholder("Share your latest idea, update, or insight...");
    await composer.fill(postA);
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText(postA)).toBeVisible();

    // Follow user B from their profile
    await page.goto(`/${userB.username}`);
    const followButton = page.getByRole("button", { name: "Follow" });
    await expect(followButton).toBeVisible();
    await followButton.click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible();

    // Feed should now include user B post
    await page.goto("/feed");
    await expect(page.getByText(postB)).toBeVisible();

    // Own profile should show own post
    await page.goto(`/${userA.username}`);
    await expect(page.getByText(postA)).toBeVisible();
  });
});

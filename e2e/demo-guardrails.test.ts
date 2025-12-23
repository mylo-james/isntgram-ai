import { test, expect } from "@playwright/test";
import { createTestUser, expectOnFeed, registerViaApi } from "./helpers/test-utils";

test.describe("Demo experience", () => {
  test("demo user is full-access, seeded, and isolated", async ({ page, request }) => {
    const otherUser = await registerViaApi(request, createTestUser("demo-isolation"));

    await page.goto("/login");
    await page.getByRole("button", { name: /try our demo/i }).click();
    await expectOnFeed(page);

    // Demo banner is visible + dismissal persists across reloads
    await expect(page.getByText(/demo session/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /^dismiss$/i }).click();
    await expect(page.getByText(/demo session/i)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/demo session/i)).toHaveCount(0);

    // Feed is seeded (not empty on first load)
    await expect(page.locator("article").first()).toBeVisible();

    // Notifications are seeded and link to posts/profiles
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: /^notifications$/i })).toBeVisible({ timeout: 15000 });
    const notificationLinks = page.locator("main ul li a");
    await expect(notificationLinks.first()).toBeVisible({ timeout: 15000 });
    await notificationLinks.first().click();
    await expect(page).toHaveURL(/\/(post\/|demo_seed_)/, { timeout: 15000 });

    // Demo user can post
    const postContent = `E2E demo post ${Date.now()}`;
    await page.goto("/upload");
    await page.getByPlaceholder("Share your latest idea, update, or insight...").fill(postContent);
    await page.getByRole("button", { name: /^post$/i }).click();
    await expectOnFeed(page);
    const postCard = page.locator("article").filter({ hasText: postContent }).first();
    await expect(postCard).toBeVisible({ timeout: 15000 });

    // Demo user can like
    await postCard.getByRole("button", { name: /^like$/i }).click();
    await expect(postCard.getByRole("button", { name: /^unlike$/i })).toBeVisible();

    // Demo user can comment
    const commentContent = `Nice post ${Date.now()}`;
    await postCard.getByRole("link", { name: /view all/i }).click();
    await page.waitForURL(/\/post\//, { timeout: 15000 });
    await page.getByPlaceholder("Add a comment...").fill(commentContent);
    await page.getByRole("button", { name: /^post$/i }).click();
    await expect(page.getByText(commentContent).first()).toBeVisible({ timeout: 15000 });

    // Demo user can edit profile
    const me = (await page.evaluate(async () => {
      const res = await fetch("/api/bff/users/me", { cache: "no-store" });
      return res.ok ? ((await res.json()) as { username?: string }) : null;
    })) as { username?: string } | null;

    expect(me?.username).toBeTruthy();
    const demoUsername = me?.username as string;

    await page.goto(`/${demoUsername}`);
    const seededPosts = (await page.evaluate(async (username) => {
      const res = await fetch(`/api/bff/posts/user/${encodeURIComponent(username)}?limit=20`, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as { items?: Array<{ mediaUrl?: string | null }> } | null;
    }, demoUsername)) as { items?: Array<{ mediaUrl?: string | null }> } | null;

    const mediaPosts = (seededPosts?.items ?? []).filter((post) => Boolean(post.mediaUrl));
    expect(mediaPosts.length).toBeGreaterThanOrEqual(9);

    await page.getByRole("button", { name: /edit profile/i }).click();
    const dialog = page.getByRole("dialog", { name: /edit profile/i });
    await expect(dialog).toBeVisible();

    const updatedFullName = `Demo User ${Date.now()}`;
    await dialog.getByLabel(/full name/i).fill(updatedFullName);
    await dialog.getByLabel(/username/i).fill(demoUsername);
    await dialog.getByRole("button", { name: /save/i }).click({ force: true });
    await expect(page.getByText(updatedFullName)).toBeVisible({ timeout: 15000 });

    // Demo user can follow/unfollow demo seed profiles
    await page.goto("/demo_seed_ava");
    await page.waitForLoadState("domcontentloaded");
    const followButton = page.getByRole("button", { name: /^Follow$/ });
    const followingButton = page.getByRole("button", { name: /^Following$/ });
    const followToggleButton = page.getByRole("button", { name: /^(Follow|Following)$/ });

    await expect(followToggleButton).toBeVisible({ timeout: 15000 });
    await expect(followToggleButton).toBeEnabled();

    if (await followButton.isVisible()) {
      const followRequest = page.waitForResponse((response) => {
        if (response.request().method() !== "POST") return false;
        return response.url().includes("/api/bff/follows/");
      });
      await followButton.click();
      const followRes = await followRequest;
      const followBody = await followRes.json().catch(() => null);
      expect(
        followRes.ok(),
        `Follow request failed: ${followRes.status()} ${followRes.statusText()} ${followBody ? JSON.stringify(followBody) : ""}`,
      ).toBe(true);
      await expect(followingButton).toBeVisible();
    } else {
      const unfollowRequest = page.waitForResponse((response) => {
        if (response.request().method() !== "DELETE") return false;
        return response.url().includes("/api/bff/follows/");
      });
      await followingButton.click();
      const unfollowRes = await unfollowRequest;
      const unfollowBody = await unfollowRes.json().catch(() => null);
      expect(
        unfollowRes.ok(),
        `Unfollow request failed: ${unfollowRes.status()} ${unfollowRes.statusText()} ${unfollowBody ? JSON.stringify(unfollowBody) : ""}`,
      ).toBe(true);
      await expect(followButton).toBeVisible();
    }

    // Demo user cannot access real users (isolation)
    await page.goto(`/${otherUser.username}`);
    await expect(page.getByText(/this page could not be found/i)).toBeVisible({ timeout: 15000 });
  });
});

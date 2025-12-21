import { test, expect } from "@playwright/test";
import {
  createPostContent,
  createPostViaApi,
  createTestUser,
  expectOnFeed,
  loginViaApi,
  loginViaUi,
  registerViaApi,
} from "./helpers/test-utils";

test.describe("Feed + Profile smoke", () => {
  test("user can follow, post, and see updates across feed and profile", async ({ page, request }) => {
    const userA = await registerViaApi(request, createTestUser("user-a"));
    const userB = await registerViaApi(request, createTestUser("user-b"));
    const postA = createPostContent("post-a");
    const postB = createPostContent("post-b");

    const loginB = await loginViaApi(request, userB);
    await createPostViaApi(request, loginB.accessToken as string, postB);

    await loginViaUi(page, userA);
    await expectOnFeed(page);

    const composer = page.getByPlaceholder("Share your latest idea, update, or insight...");
    await composer.fill(postA);
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText(postA, { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.goto(`/${userB.username}`);
    const followButton = page.getByRole("button", { name: "Follow" });
    await expect(followButton).toBeVisible();
    await followButton.click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible();

    await page.goto("/feed");
    await expect(page.getByText(postB, { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await page.goto(`/${userA.username}`);
    await expect(page.getByText(postA, { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("heading", { name: userA.username })).toBeVisible();
  });
});

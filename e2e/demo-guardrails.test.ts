import { test, expect } from "@playwright/test";
import { createTestUser, expectOnFeed, registerViaApi } from "./helpers/test-utils";

const apiBaseUrl = process.env.E2E_API_URL || "http://127.0.0.1:3001";

test.describe("Demo guardrails", () => {
  test("demo user cannot post, follow, or edit profile", async ({ page, request }) => {
    const otherUser = await registerViaApi(request, createTestUser("demo-follow"));

    await page.goto("/login");
    await page.getByRole("button", { name: /try our demo/i }).click();
    await expectOnFeed(page);

    const postButton = page.getByRole("button", { name: /^post$/i });
    const aiButton = page.getByRole("button", { name: /ai polish/i });
    await expect(postButton).toBeDisabled();
    await expect(postButton).toHaveAttribute("title", /demo mode: posting disabled/i);
    await expect(aiButton).toBeDisabled();
    await expect(aiButton).toHaveAttribute("title", /demo mode: posting disabled/i);
    await expect(page.getByPlaceholder("Share your latest idea, update, or insight...")).toBeDisabled();
    await expect(page.getByLabel(/upload image/i)).toBeDisabled();

    const demoRes = await request.post(`${apiBaseUrl}/api/auth/demo`);
    expect(demoRes.status()).toBe(200);
    const demoPayload = (await demoRes.json()) as { user?: { username?: string } };
    const demoUsername = demoPayload.user?.username || "demo";

    await page.goto(`/${demoUsername}`);
    const editButton = page.getByRole("button", { name: /edit profile/i });
    await expect(editButton).toBeDisabled();
    await expect(editButton).toHaveAttribute("title", /demo mode: editing disabled/i);
    await editButton.click({ force: true });
    await expect(page.getByRole("dialog", { name: /edit profile/i })).toHaveCount(0);

    await page.goto(`/${otherUser.username}`);
    const followButton = page.getByRole("button", { name: /^follow$/i });
    await expect(followButton).toBeDisabled();
    await expect(followButton).toHaveAttribute("title", /demo mode: following disabled/i);
    await followButton.click({ force: true });
    await expect(page.getByRole("button", { name: /^unfollow$/i })).toHaveCount(0);
  });
});

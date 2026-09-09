import { test, expect } from "@playwright/test";
import { createTestUser, expectOnFeed, loginViaUi, registerViaApi } from "./helpers/test-utils";

test.describe("Profile actions", () => {
  test("user can edit profile details", async ({ page, request }) => {
    const user = await registerViaApi(request, createTestUser("edit-profile"));

    await loginViaUi(page, user);
    await expectOnFeed(page);

    await page.goto(`/${user.username}`);
    await page.getByRole("button", { name: /edit profile/i }).click();

    const dialog = page.getByRole("dialog", { name: /edit profile/i });
    await expect(dialog).toBeVisible();
    const closeButton = dialog.getByRole("button", { name: /close edit profile/i });
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: /save/i })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();

    const updatedFullName = `${user.fullName} Updated`;
    const suffix = "_upd";
    const updatedUsername = `${user.username.slice(0, 30 - suffix.length)}${suffix}`;

    await dialog.getByLabel(/full name/i).fill(updatedFullName);
    await dialog.getByLabel(/username/i).fill(updatedUsername);
    await dialog.getByRole("button", { name: /save/i }).click({ force: true });

    await page.waitForURL(new RegExp(`/${updatedUsername}$`), { timeout: 15000 });
    await expect(page.getByRole("heading", { name: updatedUsername })).toBeVisible();
    await expect(page.getByText(updatedFullName)).toBeVisible();

    await page.getByRole("button", { name: /edit profile/i }).click();
    const refreshedDialog = page.getByRole("dialog", { name: /edit profile/i });
    await expect(refreshedDialog).toBeVisible();
    await expect(refreshedDialog.getByLabel(/full name/i)).toHaveValue(updatedFullName);
    await expect(refreshedDialog.getByLabel(/username/i)).toHaveValue(updatedUsername);
    await refreshedDialog.getByRole("button", { name: /cancel/i }).click();
    await expect(refreshedDialog).toHaveCount(0);
  });

  test("user can sign out from profile", async ({ page, request }) => {
    const user = await registerViaApi(request, createTestUser("signout"));

    await loginViaUi(page, user);
    await expectOnFeed(page);

    await page.goto(`/${user.username}`);
    await page.getByRole("button", { name: /log out/i }).click();
    const confirmation = page.getByRole("dialog", { name: "Log out?", exact: true });
    await expect(confirmation.getByRole("button", { name: "Stay logged in" })).toBeFocused();
    await confirmation.getByRole("button", { name: "Log out", exact: true }).click();

    await page.waitForURL(/\/login$/, { timeout: 15000 });
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();

    await page.goto("/feed");
    await page.waitForURL(/\/login$/, { timeout: 15000 });
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });
});

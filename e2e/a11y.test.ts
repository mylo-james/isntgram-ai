import { test, expect, type Page } from "@playwright/test";
import axe from "axe-core";
import type { RunOptions } from "axe-core";

const axeOptions: RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
};

async function expectNoA11yViolations(page: Page, label: string) {
  await page.addScriptTag({ content: axe.source });

  const results = await page.evaluate(async (options) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axeGlobal = (window as any).axe as typeof axe | undefined;
    if (!axeGlobal) throw new Error("axe not found on window");
    return axeGlobal.run(document, options);
  }, axeOptions);

  const violationSummary = results.violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `  - ${node.target.join(" ")}: ${node.failureSummary ?? ""}`.trimEnd())
        .join("\n");
      return `${violation.id} (${violation.impact ?? "unknown"}) — ${violation.help}\n${nodes}`;
    })
    .join("\n\n");

  expect(results.violations, `A11y violations on ${label}:\n${violationSummary}`).toEqual([]);
}

test.describe("Accessibility (axe-core)", () => {
  test("login page has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
    await expectNoA11yViolations(page, "/login");
  });

  test("core authed pages have no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /try our demo/i }).click();
    await page.waitForURL(/\/feed$/, { timeout: 15000 });
    await expect(page.getByRole("navigation")).toBeVisible();

    await expectNoA11yViolations(page, "/feed");

    await page.goto("/explore");
    await expect(page.getByRole("textbox", { name: /search users/i })).toBeVisible();
    await expectNoA11yViolations(page, "/explore");

    await page.goto("/notifications");
    await expect(page.getByText(/notifications/i)).toBeVisible();
    await expectNoA11yViolations(page, "/notifications");

    // Open one post to cover the detail view + comment composer.
    const postLink = page.getByRole("link", { name: /view all/i }).first();
    if (await postLink.isVisible()) {
      await postLink.click();
      await page.waitForURL(/\/post\//, { timeout: 15000 });
      await expect(page.getByPlaceholder(/add a comment/i)).toBeVisible();
      await expectNoA11yViolations(page, "/post/[postId]");
    }
  });
});

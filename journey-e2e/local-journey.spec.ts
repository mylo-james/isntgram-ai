import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const { JOURNEY, loadPrivateEnvironment } = require("../apps/api/scripts/journey/config.cjs") as {
  JOURNEY: { evidenceDirectory: string };
  loadPrivateEnvironment: () => {
    ISNTGRAM_JOURNEY_FIXTURE_PASSWORD: string;
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_APP_URL: string;
  };
};
const { FIXTURE } = require("../apps/api/scripts/journey/fixture.cjs") as {
  FIXTURE: { userId: string; postId: string; username: string; email: string; content: string };
};
const { preflight } = require("../apps/api/scripts/journey/preflight.cjs") as {
  preflight: (mode: "running") => Promise<unknown>;
};
const { openJourneyClient, assertMigrationsCurrent } = require("../apps/api/scripts/journey/sql.cjs") as {
  openJourneyClient: () => Promise<{ end: () => Promise<void> }>;
  assertMigrationsCurrent: (client: unknown) => Promise<unknown>;
};
const { verifyPost } = require("../apps/api/scripts/journey/verify.cjs") as {
  verifyPost: (
    postId: string,
    client: unknown,
  ) => Promise<{ id: string; authorId: string; content: string; createdAt: string; username: string }>;
};

const environment = loadPrivateEnvironment();
const evidenceDirectory = JOURNEY.evidenceDirectory;
const QUIET_WINDOW_MS = 12_000;

type CreatedPost = {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
};

type SafeConsoleEvent = { type: string; text: string };

function redactText(value: string): string {
  return value
    .replace(/(authorization|bearer|token|password|cookie)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function recordPageDiagnostics(page: Page) {
  const consoleEvents: SafeConsoleEvent[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    consoleEvents.push({ type: message.type(), text: redactText(message.text()) });
  });
  page.on("pageerror", (error: Error) => {
    pageErrors.push(redactText(error.message));
  });
  return { consoleEvents, pageErrors };
}

async function quietWindow(page: Page) {
  await page.waitForTimeout(QUIET_WINDOW_MS);
}

async function loginThroughUi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(FIXTURE.email);
  await page.getByLabel("Password").fill(environment.ISNTGRAM_JOURNEY_FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Log In" }).click();
  await page.waitForURL(/\/feed$/, { timeout: 15_000 });
  await expect(page.getByLabel("Password")).toHaveCount(0);
}

test.describe("local PostgreSQL journey", () => {
  test.beforeAll(async () => {
    // The native owner establishes process and target identity before any browser request.
    await preflight("running");
  });

  test("signs in, creates one text post, and verifies durable retrieval", async ({ browser, page, request }) => {
    const diagnostics = recordPageDiagnostics(page);

    await page.goto("/feed");
    await page.waitForURL(/\/login$/, { timeout: 15_000 });
    await page.goto("/upload");
    await page.waitForURL(/\/login$/, { timeout: 15_000 });

    await page.getByLabel("Email").fill(FIXTURE.email);
    await page.getByLabel("Password").fill("WrongJourneyPassword123!");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByText("Invalid credentials")).toBeVisible({ timeout: 10_000 });

    // Four total login attempts stay below the existing five-per-minute limit.
    await quietWindow(page);
    await loginThroughUi(page);
    await expect(page.locator("article").filter({ hasText: FIXTURE.content }).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/upload");
    const createdContent = `isntgram-journey-ui-${Date.now()}`;
    const bffResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/bff/posts",
    );
    await page.getByPlaceholder("Share your latest idea, update, or insight...").fill(createdContent);
    await page.getByRole("button", { name: "Post" }).click();
    const response = await bffResponse;
    expect(response.status()).toBe(201);
    const bffRequestId = response.headers()["x-request-id"];
    expect(bffRequestId).toMatch(/^[A-Za-z0-9._-]{1,128}$/);
    const created = (await response.json()) as CreatedPost;
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(created.author.id).toBe(FIXTURE.userId);
    expect(created.author.username).toBe(FIXTURE.username);
    expect(created.content).toBe(createdContent);

    await page.waitForURL(/\/feed$/, { timeout: 15_000 });
    await page.reload();
    await expect(page.locator("article").filter({ hasText: createdContent }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Password")).toHaveCount(0);
    await page.screenshot({ path: path.join(evidenceDirectory, "journey-created-post.png"), fullPage: true });

    // Keep this phase distinct from creation to avoid approaching the existing default API limit.
    await quietWindow(page);
    const freshContext = await browser.newContext({ baseURL: environment.NEXT_PUBLIC_APP_URL, viewport: { width: 1280, height: 900 } });
    try {
      const freshPage = await freshContext.newPage();
      const freshDiagnostics = recordPageDiagnostics(freshPage);
      await loginThroughUi(freshPage);
      await expect(freshPage.locator("article").filter({ hasText: createdContent }).first()).toBeVisible({
        timeout: 15_000,
      });

      const loginResponse = await request.post(`${environment.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        data: { email: FIXTURE.email, password: environment.ISNTGRAM_JOURNEY_FIXTURE_PASSWORD },
      });
      expect(loginResponse.status()).toBe(200);
      const login = (await loginResponse.json()) as { accessToken: string };
      expect(login.accessToken).toBeTruthy();

      const apiPostResponse = await request.get(`${environment.NEXT_PUBLIC_API_URL}/api/posts/${created.id}`, {
        headers: { Authorization: `Bearer ${login.accessToken}` },
      });
      expect(apiPostResponse.status()).toBe(200);
      const apiPost = (await apiPostResponse.json()) as CreatedPost;
      expect(apiPost.id).toBe(created.id);
      expect(apiPost.author.id).toBe(created.author.id);
      expect(apiPost.content).toBe(created.content);

      const client = await openJourneyClient();
      try {
        await assertMigrationsCurrent(client);
        const databasePost = await verifyPost(created.id, client);
        expect(databasePost.id).toBe(created.id);
        expect(databasePost.authorId).toBe(created.author.id);
        expect(databasePost.content).toBe(created.content);
      } finally {
        await client.end();
      }

      expect(diagnostics.pageErrors).toEqual([]);
      expect(freshDiagnostics.pageErrors).toEqual([]);
      const viewport = page.viewportSize();
      const receipt = {
        chromeVersion: browser.version(),
        url: new URL(page.url()).toString(),
        title: await page.title(),
        viewport,
        console: diagnostics.consoleEvents,
        pageErrors: diagnostics.pageErrors,
        freshSessionPageErrors: freshDiagnostics.pageErrors,
        bffCreationStatus: response.status(),
        bffRequestId,
        apiReadStatus: apiPostResponse.status(),
        knownPostId: FIXTURE.postId,
        reloadVisible: true,
        freshSessionVisible: true,
        postgresRowMatched: true,
        exactPost: {
          id: created.id,
          authorId: created.author.id,
          authorUsername: created.author.username,
          content: created.content,
          createdAt: created.createdAt,
        },
      };
      await writeFile(
        path.join(evidenceDirectory, "journey-browser-receipt.json"),
        `${JSON.stringify(receipt, null, 2)}\n`,
        { mode: 0o600 },
      );
    } finally {
      await freshContext.close();
    }
  });
});

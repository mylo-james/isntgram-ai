import { expect, test, type Page } from "@playwright/test";

const FIXED_NOW_ISO = "2025-01-01T00:00:00.000Z";

function svgDataUri(label: string, bg = "#e5e7eb", fg = "#111827"): string {
  const safeLabel = label.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect width="100%" height="100%" fill="${bg}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="48" fill="${fg}">
        ${safeLabel}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const USERS = {
  demo: {
    id: "1",
    username: "demo_user",
    fullName: "Demo User",
    profilePictureUrl: svgDataUri("ME", "#dbeafe", "#1e3a8a"),
  },
  alice: {
    id: "2",
    username: "alice",
    fullName: "Alice",
    profilePictureUrl: svgDataUri("A", "#fce7f3", "#9d174d"),
  },
  bob: {
    id: "3",
    username: "bob",
    fullName: "Bob",
    profilePictureUrl: svgDataUri("B", "#dcfce7", "#14532d"),
  },
} as const;

const POSTS = {
  p101: {
    id: "101",
    content: "A crisp morning walk.",
    createdAt: "2024-12-31T23:00:00.000Z",
    updatedAt: "2024-12-31T23:00:00.000Z",
    author: USERS.alice,
    likesCount: 0,
    commentsCount: 3,
    likedByMe: false,
  },
  p102: {
    id: "102",
    content: "Weekend project: done.",
    createdAt: "2024-12-31T22:30:00.000Z",
    updatedAt: "2024-12-31T22:30:00.000Z",
    author: USERS.bob,
    likesCount: 0,
    commentsCount: 2,
    likedByMe: false,
  },
  p103: {
    id: "103",
    content: "Exploring layout tests.",
    createdAt: "2024-12-31T21:15:00.000Z",
    updatedAt: "2024-12-31T21:15:00.000Z",
    author: USERS.alice,
    likesCount: 0,
    commentsCount: 1,
    likedByMe: false,
  },
} as const;

const COMMENTS = {
  "101": [
    {
      id: "201",
      text: "Looks peaceful.",
      createdAt: "2024-12-31T23:05:00.000Z",
      updatedAt: "2024-12-31T23:05:00.000Z",
      author: USERS.bob,
    },
    {
      id: "202",
      text: "Love the light in this shot.",
      createdAt: "2024-12-31T23:06:00.000Z",
      updatedAt: "2024-12-31T23:06:00.000Z",
      author: USERS.demo,
    },
    {
      id: "203",
      text: "Thanks!",
      createdAt: "2024-12-31T23:07:00.000Z",
      updatedAt: "2024-12-31T23:07:00.000Z",
      author: USERS.alice,
    },
  ],
  "102": [
    {
      id: "204",
      text: "Ship it.",
      createdAt: "2024-12-31T22:40:00.000Z",
      updatedAt: "2024-12-31T22:40:00.000Z",
      author: USERS.alice,
    },
    {
      id: "205",
      text: "Nice work.",
      createdAt: "2024-12-31T22:42:00.000Z",
      updatedAt: "2024-12-31T22:42:00.000Z",
      author: USERS.demo,
    },
  ],
  "103": [
    {
      id: "206",
      text: "Nice.",
      createdAt: "2024-12-31T21:20:00.000Z",
      updatedAt: "2024-12-31T21:20:00.000Z",
      author: USERS.bob,
    },
  ],
} as const;

async function installStabilizers(page: Page) {
  await page.addInitScript((fixedNowIso) => {
    const fixedNowMs = new Date(fixedNowIso).getTime();
    const RealDate = Date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class MockDate extends (RealDate as any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        super(...args);
        if (args.length === 0) return new RealDate(fixedNowMs);
        return new RealDate(...args);
      }
      static now() {
        return fixedNowMs;
      }
    }
    // eslint-disable-next-line no-global-assign
    Date = MockDate as unknown as DateConstructor;

    Math.random = () => 0.123456;

    const css = `
      *, *::before, *::after {
        animation-duration: 0.01s !important;
        animation-delay: 0s !important;
        transition-duration: 0.01s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
        caret-color: transparent !important;
      }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-pw", "stabilize");
    style.textContent = css;
    document.addEventListener("DOMContentLoaded", () => {
      document.head.appendChild(style);
    });
  }, FIXED_NOW_ISO);
}

async function mockNextAuthSession(page: Page) {
  await page.route("**/auth/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  await page.route("**/auth/providers", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/auth/csrf", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "pw" }) });
  });
}

async function mockWebApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;

    if (pathname === "/api/posts/feed") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts: [POSTS.p101, POSTS.p102],
          pagination: { page: 1, limit: 10, total: 2, hasMore: false },
        }),
      });
      return;
    }

    if (pathname === "/api/posts/explore") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts: [POSTS.p101, POSTS.p102, POSTS.p103],
          pagination: { page: 1, limit: 12, total: 3, hasMore: false },
        }),
      });
      return;
    }

    if (pathname === `/api/users/${USERS.demo.username}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: USERS.demo.id,
          username: USERS.demo.username,
          fullName: USERS.demo.fullName,
          bio: "Just a baseline profile.",
          profilePictureUrl: USERS.demo.profilePictureUrl,
          postCount: 3,
          followerCount: 0,
          followingCount: 0,
        }),
      });
      return;
    }

    if (pathname === `/api/posts/user/${USERS.demo.username}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          posts: [POSTS.p101, POSTS.p102, POSTS.p103],
          pagination: { page: 1, limit: 12, total: 3, hasMore: false },
        }),
      });
      return;
    }

    if (pathname === `/api/posts/${POSTS.p101.id}`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(POSTS.p101) });
      return;
    }

    if (pathname === `/api/posts/${POSTS.p101.id}/comments`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          comments: COMMENTS[POSTS.p101.id],
          pagination: { page: 1, limit: 20, total: COMMENTS[POSTS.p101.id].length, hasMore: false },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: `No mock for ${pathname}` }),
    });
  });
}

test.describe("web matches react-app baselines", () => {
  test("login screen", async ({ page }) => {
    await installStabilizers(page);
    await mockNextAuthSession(page);
    await mockWebApi(page);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-login", { fullPage: true, animations: "disabled" });
  });

  test("register screen", async ({ page }) => {
    await installStabilizers(page);
    await mockNextAuthSession(page);
    await mockWebApi(page);

    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-register", { fullPage: true, animations: "disabled" });
  });

  test("feed screen", async ({ page }) => {
    await installStabilizers(page);
    await mockNextAuthSession(page);
    await mockWebApi(page);

    await page.goto("/feed", { waitUntil: "domcontentloaded" });
    await page.locator('img[alt="feed-post"]').first().waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-feed", { fullPage: true, animations: "disabled" });
  });

  test("explore screen", async ({ page }) => {
    await installStabilizers(page);
    await mockNextAuthSession(page);
    await mockWebApi(page);

    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="search"]').waitFor();
    await page.waitForTimeout(250);

    await expect(page).toHaveScreenshot("react-app-explore", { fullPage: true, animations: "disabled" });
  });

  test("profile screen", async ({ page }) => {
    await installStabilizers(page);
    await mockNextAuthSession(page);
    await mockWebApi(page);

    await page.goto(`/${USERS.demo.username}`, { waitUntil: "domcontentloaded" });
    await page.locator('img[alt="avatar"]').first().waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-profile", { fullPage: true, animations: "disabled" });
  });

  test("post detail screen", async ({ page }) => {
    await installStabilizers(page);
    await mockNextAuthSession(page);
    await mockWebApi(page);

    await page.goto(`/posts/${POSTS.p101.id}`, { waitUntil: "domcontentloaded" });
    await page.locator('img[alt="feed-post"]').first().waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-post-detail", { fullPage: true, animations: "disabled" });
  });
});


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

const AUTH_SPLASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="3000" viewBox="0 0 2000 3000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fafafa"/>
      <stop offset="1" stop-color="#f3f4f6"/>
    </linearGradient>
    <radialGradient id="c1" cx="0.2" cy="0.2" r="0.6">
      <stop offset="0" stop-color="#e0f2fe"/>
      <stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="c2" cx="0.8" cy="0.3" r="0.55">
      <stop offset="0" stop-color="#fce7f3"/>
      <stop offset="1" stop-color="#fce7f3" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="c3" cx="0.4" cy="0.8" r="0.5">
      <stop offset="0" stop-color="#ede9fe"/>
      <stop offset="1" stop-color="#ede9fe" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="2000" height="3000" fill="url(#bg)"/>
  <rect width="2000" height="3000" fill="url(#c1)"/>
  <rect width="2000" height="3000" fill="url(#c2)"/>
  <rect width="2000" height="3000" fill="url(#c3)"/>
</svg>`;

const USERS = {
  me: {
    id: 1,
    username: "demo_user",
    full_name: "Demo User",
    bio: "Just a baseline profile.",
    profile_image_url: svgDataUri("ME", "#dbeafe", "#1e3a8a"),
  },
  alice: {
    id: 2,
    username: "alice",
    full_name: "Alice",
    bio: "Coffee, code, and cats.",
    profile_image_url: svgDataUri("A", "#fce7f3", "#9d174d"),
  },
  bob: {
    id: 3,
    username: "bob",
    full_name: "Bob",
    bio: "Outdoor enthusiast.",
    profile_image_url: svgDataUri("B", "#dcfce7", "#14532d"),
  },
} as const;

const POSTS = {
  p101: {
    id: 101,
    image_url: svgDataUri("Post 101", "#fef9c3", "#854d0e"),
    caption: "A crisp morning walk.",
    created_at: "2024-12-31T23:00:00.000Z",
    user: USERS.alice,
    likes: Array.from({ length: 12 }).map((_, i) => ({ id: i + 1 })),
    comments: [
      { id: 201, user: USERS.bob, content: "Looks peaceful." },
      { id: 202, user: USERS.me, content: "Love the light in this shot." },
      { id: 203, user: USERS.alice, content: "Thanks!" },
    ],
    like_count: 12,
    comment_count: 3,
  },
  p102: {
    id: 102,
    image_url: svgDataUri("Post 102", "#e0f2fe", "#0c4a6e"),
    caption: "Weekend project: done.",
    created_at: "2024-12-31T22:30:00.000Z",
    user: USERS.bob,
    likes: Array.from({ length: 7 }).map((_, i) => ({ id: i + 1 })),
    comments: [
      { id: 204, user: USERS.alice, content: "Ship it." },
      { id: 205, user: USERS.me, content: "Nice work." },
    ],
    like_count: 7,
    comment_count: 2,
  },
  p103: {
    id: 103,
    image_url: svgDataUri("Post 103", "#ede9fe", "#4c1d95"),
    caption: "Exploring layout tests.",
    created_at: "2024-12-31T21:15:00.000Z",
    user: USERS.alice,
    likes: Array.from({ length: 4 }).map((_, i) => ({ id: i + 1 })),
    comments: [{ id: 206, user: USERS.bob, content: "Nice." }],
    like_count: 4,
    comment_count: 1,
  },
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

    // Make randomized layouts deterministic.
    Math.random = () => 0.123456;

    // Reduce animation delay/duration so UI settles quickly.
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

async function mockReactAppApi(page: Page, { authenticated }: { authenticated: boolean }) {
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;

    // Auth probe (App.js)
    if (pathname === "/api/auth/") {
      if (!authenticated) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ errors: ["Unauthorized"] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(USERS.me),
      });
      return;
    }

    // App.js: follows + likes
    if (pathname === `/api/follow/${USERS.me.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: [USERS.alice] }),
      });
      return;
    }
    if (pathname === `/api/like/user/${USERS.me.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ likes: [] }),
      });
      return;
    }

    // Feed infinite scroll
    if (pathname === `/api/post/${USERS.me.id}/scroll/0`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [POSTS.p101, POSTS.p102] }),
      });
      return;
    }
    if (pathname.startsWith(`/api/post/${USERS.me.id}/scroll/`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [] }),
      });
      return;
    }

    // Explore grid infinite scroll
    if (pathname === "/api/post/scroll/0") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [POSTS.p101, POSTS.p102, POSTS.p103] }),
      });
      return;
    }
    if (pathname.startsWith("/api/post/scroll/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ posts: [] }),
      });
      return;
    }

    // Profile
    if (pathname === `/api/profile/${USERS.me.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          num_posts: 3,
          user: USERS.me,
          followersList: [],
          followingList: [],
          posts: [POSTS.p101, POSTS.p102, POSTS.p103],
        }),
      });
      return;
    }
    if (pathname === `/api/follow/${USERS.me.id}/following`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: [] }),
      });
      return;
    }

    // Single post detail
    if (pathname === `/api/post/${POSTS.p101.id}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ post: POSTS.p101 }),
      });
      return;
    }

    // Default: avoid hard failures in the UI by returning a deterministic 404 JSON.
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ errors: [`No mock for ${pathname}`] }),
    });
  });
}

async function mockSplashImage(page: Page) {
  await page.route("**picsum.photos/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: AUTH_SPLASH_SVG,
    });
  });
}

test.describe("react-app visual baselines", () => {
  test("login screen", async ({ page }) => {
    await installStabilizers(page);
    await mockSplashImage(page);
    await mockReactAppApi(page, { authenticated: false });

    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="username"]').waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-login.png", { fullPage: true, animations: "disabled" });
  });

  test("register screen", async ({ page }) => {
    await installStabilizers(page);
    await mockSplashImage(page);
    await mockReactAppApi(page, { authenticated: false });

    await page.goto("/auth/register", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-register.png", { fullPage: true, animations: "disabled" });
  });

  test("feed screen", async ({ page }) => {
    await installStabilizers(page);
    await mockReactAppApi(page, { authenticated: true });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator('img[alt="feed-post"]').first().waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-feed.png", { fullPage: true, animations: "disabled" });
  });

  test("explore screen", async ({ page }) => {
    await installStabilizers(page);
    await mockReactAppApi(page, { authenticated: true });

    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="search"]').waitFor();
    await page.waitForTimeout(250);

    await expect(page).toHaveScreenshot("react-app-explore.png", { fullPage: true, animations: "disabled" });
  });

  test("profile screen", async ({ page }) => {
    await installStabilizers(page);
    await mockReactAppApi(page, { authenticated: true });

    await page.goto(`/profile/${USERS.me.id}`, { waitUntil: "domcontentloaded" });
    await page.locator('img[alt="avatar"]').first().waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-profile.png", { fullPage: true, animations: "disabled" });
  });

  test("post detail screen", async ({ page }) => {
    await installStabilizers(page);
    await mockReactAppApi(page, { authenticated: true });

    await page.goto(`/post/${POSTS.p101.id}`, { waitUntil: "domcontentloaded" });
    await page.locator('img[alt="feed-post"]').first().waitFor();
    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot("react-app-post-detail.png", { fullPage: true, animations: "disabled" });
  });
});

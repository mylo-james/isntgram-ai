import { render, screen } from "@testing-library/react";
import FeedPage from "./feed/page";
import ExplorePage from "./explore/page";
import UploadPage from "./upload/page";
import NotificationsPage from "./notifications/page";
import UserProfilePage from "./[username]/page";
import PostPage from "./post/[postId]/page";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
  redirect: jest.fn(),
}));
jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/server-api", () => ({
  internalApi: { GET: jest.fn() },
  getApiAccessToken: jest.fn(),
  getRequestId: jest.fn(),
}));
jest.mock("@/components/legacy/LegacyNav", () => {
  return function MockLegacyNav({ profileHref }: { profileHref?: string }) {
    return <div data-testid="legacy-nav" data-profile-href={profileHref} />;
  };
});
jest.mock("./feed/FeedClient", () => {
  return function MockFeedClient() {
    return <div data-testid="feed-client" />;
  };
});
jest.mock("./explore/ExploreClient", () => {
  return function MockExploreClient() {
    return <div data-testid="explore-client" />;
  };
});
jest.mock("./upload/UploadClient", () => {
  return function MockUploadClient() {
    return <div data-testid="upload-client" />;
  };
});
jest.mock("./notifications/NotificationsClient", () => {
  return function MockNotificationsClient() {
    return <div data-testid="notifications-client" />;
  };
});
jest.mock("./[username]/ProfilePage", () => {
  return function MockProfilePage() {
    return <div data-testid="profile-page" />;
  };
});
jest.mock("./post/[postId]/PostDetailClient", () => {
  return function MockPostDetailClient() {
    return <div data-testid="post-detail-client" />;
  };
});

describe("authoritative profile navigation", () => {
  const authModule = jest.requireMock("@/lib/auth") as { auth: jest.Mock };
  const serverApi = jest.requireMock("@/lib/server-api") as {
    internalApi: { GET: jest.Mock };
    getApiAccessToken: jest.Mock;
    getRequestId: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authModule.auth.mockResolvedValue({
      user: { id: "viewer-1", username: "stale-session-name", email: "viewer@example.com" },
    });
    serverApi.getApiAccessToken.mockResolvedValue("test-access-token");
    serverApi.getRequestId.mockResolvedValue("request-1");
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/users/me") {
        return Promise.resolve({
          data: { username: "fresh-profile-name", profilePictureUrl: null },
          response: { ok: true, status: 200 },
        });
      }
      if (path === "/api/posts/feed" || path === "/api/posts/explore") {
        return Promise.resolve({ data: { items: [], nextCursor: undefined }, response: { ok: true, status: 200 } });
      }
      if (path === "/api/notifications") {
        return Promise.resolve({ data: { items: [], nextCursor: undefined }, response: { ok: true, status: 200 } });
      }
      if (path === "/api/users/{username}") {
        return Promise.resolve({
          data: { id: "other-user", username: "other-user" },
          response: { ok: true, status: 200 },
        });
      }
      if (path === "/api/posts/user/{username}") {
        return Promise.resolve({ data: { items: [], nextCursor: undefined }, response: { ok: true, status: 200 } });
      }
      if (path === "/api/follows/{username}/status") {
        return Promise.resolve({ data: { isFollowing: false }, response: { ok: true, status: 200 } });
      }
      if (path === "/api/posts/{postId}") {
        return Promise.resolve({ data: { id: "post-1" }, response: { ok: true, status: 200 } });
      }
      if (path === "/api/posts/{postId}/comments") {
        return Promise.resolve({ data: { items: [], nextCursor: undefined }, response: { ok: true, status: 200 } });
      }
      throw new Error(`Unexpected endpoint: ${path}`);
    });
  });

  it.each([
    ["feed", () => FeedPage()],
    ["explore", () => ExplorePage()],
    ["upload", () => UploadPage()],
    ["notifications", () => NotificationsPage()],
    ["profile", () => UserProfilePage({ params: { username: "other-user" } })],
    ["post detail", () => PostPage({ params: { postId: "post-1" } })],
  ])("uses the current profile response instead of a stale session username on %s", async (_name, renderPage) => {
    render(await renderPage());

    expect(screen.getByTestId("legacy-nav")).toHaveAttribute("data-profile-href", "/fresh-profile-name");
    expect(screen.getByTestId("legacy-nav")).not.toHaveAttribute("data-profile-href", "/stale-session-name");
  });

  it("keeps the feed profile navigation at the safe feed fallback when the profile response is unavailable", async () => {
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/posts/feed") {
        return Promise.resolve({ data: { items: [], nextCursor: undefined }, response: { ok: true, status: 200 } });
      }
      if (path === "/api/users/me") {
        return Promise.resolve({ data: { username: "fresh-profile-name" }, response: { ok: false, status: 503 } });
      }
      throw new Error(`Unexpected endpoint: ${path}`);
    });

    render(await FeedPage());

    expect(screen.getByTestId("legacy-nav")).toHaveAttribute("data-profile-href", "/feed");
    expect(screen.getByTestId("legacy-nav")).not.toHaveAttribute("data-profile-href", "/stale-session-name");
  });
});

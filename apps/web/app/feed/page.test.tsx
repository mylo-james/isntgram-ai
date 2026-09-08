import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import FeedPage from "./page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/server-api", () => ({
  internalApi: { GET: jest.fn() },
  getApiAccessToken: jest.fn(),
  getRequestId: jest.fn(),
}));
jest.mock("./FeedClient", () => {
  return function MockFeedClient({ initialFeed }: { initialFeed: { items: Array<{ id: string }> } }) {
    return <div data-testid="feed-client">{initialFeed.items.length}</div>;
  };
});
jest.mock("@/components/legacy/LegacyNav", () => {
  return function MockLegacyNav({ avatarSrc }: { avatarSrc: string }) {
    return <div data-testid="legacy-nav">{avatarSrc}</div>;
  };
});

describe("FeedPage", () => {
  const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;
  const authModule = jest.requireMock("@/lib/auth") as { auth: jest.Mock };
  const serverApi = jest.requireMock("@/lib/server-api") as {
    internalApi: { GET: jest.Mock };
    getApiAccessToken: jest.Mock;
    getRequestId: jest.Mock;
  };
  const feed = { items: [{ id: "seed-post" }], nextCursor: undefined };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("redirect");
    });
    authModule.auth.mockResolvedValue({ user: { id: "viewer-1", username: "viewer" } });
    serverApi.getApiAccessToken.mockResolvedValue("test-access-token");
    serverApi.getRequestId.mockResolvedValue("request-1");
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/posts/feed") return Promise.resolve({ data: feed, response: { ok: true, status: 200 } });
      if (path === "/api/users/me")
        return Promise.resolve({ data: { profilePictureUrl: null }, response: { ok: true, status: 200 } });
      throw new Error(`Unexpected endpoint: ${path}`);
    });
  });

  it("preserves the login redirect before any dependency request", async () => {
    authModule.auth.mockResolvedValue(null);
    await expect(FeedPage()).rejects.toThrow("redirect");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(serverApi.internalApi.GET).not.toHaveBeenCalled();
  });

  it("allows reauthentication when the browser session has no API access token", async () => {
    serverApi.getApiAccessToken.mockResolvedValue(null);

    await expect(FeedPage()).rejects.toThrow("redirect");

    expect(mockRedirect).toHaveBeenCalledWith("/login?reauth=1");
    expect(serverApi.internalApi.GET).not.toHaveBeenCalled();
  });

  it("passes a populated successful feed to the existing client", async () => {
    render(await FeedPage());
    expect(screen.getByTestId("feed-client")).toHaveTextContent("1");
  });

  it("keeps a valid empty feed distinct from a feed-load failure", async () => {
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/posts/feed")
        return Promise.resolve({ data: { items: [], nextCursor: undefined }, response: { ok: true, status: 200 } });
      return Promise.resolve({ data: { profilePictureUrl: null }, response: { ok: true, status: 200 } });
    });
    render(await FeedPage());
    expect(screen.getByTestId("feed-client")).toHaveTextContent("0");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["HTTP failure", () => Promise.resolve({ data: null, response: { ok: false, status: 503 } })],
    [
      "malformed successful payload",
      () => Promise.resolve({ data: { items: "not-an-array" }, response: { ok: true, status: 200 } }),
    ],
    ["transport failure", () => Promise.reject(new TypeError("network unavailable"))],
  ])("shows a retriable feed-load error for %s", async (_label, getFeed) => {
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/posts/feed") return getFeed();
      return Promise.resolve({ data: { profilePictureUrl: null }, response: { ok: true, status: 200 } });
    });
    render(await FeedPage());
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t load your feed");
    expect(screen.getByRole("link", { name: "Retry feed" })).toHaveAttribute("href", "/feed");
    expect(serverApi.internalApi.GET).toHaveBeenCalledTimes(1);
  });

  it("bounds a hanging feed request and exposes the document-navigation retry target", async () => {
    jest.useFakeTimers();
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/posts/feed") return new Promise(() => undefined);
      return Promise.resolve({ data: { profilePictureUrl: null }, response: { ok: true, status: 200 } });
    });
    try {
      const page = FeedPage();
      await jest.advanceTimersByTimeAsync(5_000);
      render(await page);
      expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t load your feed");
      expect(screen.getByRole("link", { name: "Retry feed" })).toHaveAttribute("href", "/feed");
    } finally {
      jest.useRealTimers();
    }
  });

  it("redirects a feed 401 through the existing authentication boundary", async () => {
    serverApi.internalApi.GET.mockResolvedValueOnce({ data: null, response: { ok: false, status: 401 } });
    await expect(FeedPage()).rejects.toThrow("redirect");
    expect(mockRedirect).toHaveBeenCalledWith("/login?reauth=1");
    expect(serverApi.internalApi.GET).toHaveBeenCalledTimes(1);
  });

  it("uses the local avatar fallback when optional profile decoration fails", async () => {
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/posts/feed") return Promise.resolve({ data: feed, response: { ok: true, status: 200 } });
      return Promise.reject(new TypeError("profile decoration unavailable"));
    });
    render(await FeedPage());
    expect(screen.getByTestId("feed-client")).toHaveTextContent("1");
    expect(screen.getByTestId("legacy-nav")).toHaveTextContent("/assets/default-avatar.svg");
  });
});

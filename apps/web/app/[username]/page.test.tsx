import { render, screen, waitFor } from "@testing-library/react";
import { notFound } from "next/navigation";
import UserProfilePage, { generateMetadata } from "./page";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/server-api", () => ({
  internalApi: {
    GET: jest.fn(),
  },
  getApiAccessToken: jest.fn(),
  getRequestId: jest.fn(),
}));

jest.mock("./ProfilePage", () => {
  return function MockProfilePage({
    username,
    currentUser,
    initialPosts,
    initialIsFollowing,
  }: {
    username: string;
    currentUser?: { username: string } | null;
    initialPosts?: Array<{ id: string }>;
    initialIsFollowing?: boolean | null;
  }) {
    return (
      <div data-testid="profile-page">
        <span data-testid="username">{username}</span>
        <span data-testid="current-user">{currentUser?.username || "no-user"}</span>
        <span data-testid="posts-count">{initialPosts?.length ?? 0}</span>
        <span data-testid="is-following">{String(initialIsFollowing)}</span>
      </div>
    );
  };
});

describe("UserProfilePage", () => {
  const mockNotFound = notFound as jest.MockedFunction<typeof notFound>;
  const authModule = jest.requireMock("@/lib/auth") as { auth: jest.Mock };
  const serverApi = jest.requireMock("@/lib/server-api") as {
    internalApi: { GET: jest.Mock };
    getApiAccessToken: jest.Mock;
    getRequestId: jest.Mock;
  };

  const mockProfile = {
    id: "1",
    username: "testuser",
    fullName: "Test User",
    profilePictureUrl: null,
    bio: "Test bio",
    postCount: 2,
    followerCount: 5,
    followingCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockFeed = {
    items: [{ id: "p1" }, { id: "p2" }],
    nextCursor: "next",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("not found");
    });
    authModule.auth.mockResolvedValue({
      user: { id: "1", username: "testuser", email: "test@example.com" },
    } as never);
    serverApi.getApiAccessToken.mockResolvedValue(null);
    serverApi.getRequestId.mockResolvedValue("req-1");
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/users/{username}") {
        return Promise.resolve({ data: mockProfile, response: { ok: true } });
      }
      if (path === "/api/posts/user/{username}") {
        return Promise.resolve({ data: mockFeed, response: { ok: true } });
      }
      if (path === "/api/follows/{username}/status") {
        return Promise.resolve({ data: { isFollowing: true }, response: { ok: true } });
      }
      return Promise.resolve({ data: null, response: { ok: false } });
    });
  });

  it("renders profile page with valid username", async () => {
    const params = { username: "testuser" };

    render(await UserProfilePage({ params }));

    await waitFor(() => {
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
      expect(screen.getByTestId("username")).toHaveTextContent("testuser");
    });
    expect(screen.getByTestId("posts-count")).toHaveTextContent("2");
    expect(screen.getByTestId("is-following")).toHaveTextContent("null");
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["undefined", undefined as never],
  ])("calls notFound for %s username", async (_label, username) => {
    await expect(UserProfilePage({ params: { username } })).rejects.toThrow("not found");
    expect(mockNotFound).toHaveBeenCalled();
    expect(serverApi.internalApi.GET).not.toHaveBeenCalled();
  });

  it("calls notFound when profile fetch fails", async () => {
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/users/{username}") {
        return Promise.resolve({ data: null, response: { ok: false } });
      }
      if (path === "/api/posts/user/{username}") {
        return Promise.resolve({ data: mockFeed, response: { ok: true } });
      }
      return Promise.resolve({ data: null, response: { ok: false } });
    });

    await expect(UserProfilePage({ params: { username: "testuser" } })).rejects.toThrow("not found");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("passes current user session to ProfilePage", async () => {
    authModule.auth.mockResolvedValue({
      user: { id: "1", username: "currentuser", email: "current@example.com" },
    } as never);

    render(await UserProfilePage({ params: { username: "testuser" } }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("currentuser");
    });
  });

  it("handles null session gracefully", async () => {
    authModule.auth.mockResolvedValue(null as never);

    render(await UserProfilePage({ params: { username: "testuser" } }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("no-user");
    });
    expect(serverApi.getApiAccessToken).not.toHaveBeenCalled();
  });

  it("fetches follow status when access token is available", async () => {
    serverApi.getApiAccessToken.mockResolvedValue("token-123");

    render(await UserProfilePage({ params: { username: "testuser" } }));

    await waitFor(() => expect(screen.getByTestId("is-following")).toHaveTextContent("true"));

    const followCall = serverApi.internalApi.GET.mock.calls.find(
      (call) => call[0] === "/api/follows/{username}/status",
    );
    expect(followCall).toBeDefined();
    const [, options] = followCall as [string, { headers?: Record<string, string> }];
    expect(options.headers?.Authorization).toBe("Bearer token-123");
  });

  it("keeps follow status null when follow payload is invalid", async () => {
    serverApi.getApiAccessToken.mockResolvedValue("token-123");
    serverApi.internalApi.GET.mockImplementation((path: string) => {
      if (path === "/api/users/{username}") {
        return Promise.resolve({ data: mockProfile, response: { ok: true } });
      }
      if (path === "/api/posts/user/{username}") {
        return Promise.resolve({ data: mockFeed, response: { ok: true } });
      }
      if (path === "/api/follows/{username}/status") {
        return Promise.resolve({ data: { isFollowing: "yes" }, response: { ok: true } });
      }
      return Promise.resolve({ data: null, response: { ok: false } });
    });

    render(await UserProfilePage({ params: { username: "testuser" } }));

    await waitFor(() => expect(screen.getByTestId("is-following")).toHaveTextContent("null"));
  });

  it("generates correct metadata", async () => {
    const params = { username: "testuser" };

    const metadata = await generateMetadata({ params });

    expect(metadata).toEqual({
      title: "testuser - Profile | Isntgram",
      description: "View testuser's profile on Isntgram",
    });
  });
});

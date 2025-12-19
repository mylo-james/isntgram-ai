import { apiClient } from "./api-client";

describe("apiClient", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function getLastRequest(): Request {
    const calls = (global.fetch as jest.Mock).mock.calls;
    return calls[calls.length - 1][0] as Request;
  }

  function toResponse(body: unknown, init: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  }

  it("registers a user", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          message: "User registered successfully",
          user: {
            id: "1",
            email: "test@example.com",
            username: "testuser",
            fullName: "Test User",
            postCount: 0,
            followerCount: 0,
            followingCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        { status: 201 },
      ),
    );

    const result = await apiClient.register({
      email: "test@example.com",
      username: "testuser",
      fullName: "Test User",
      password: "Password123",
    });

    expect(result.user.email).toBe("test@example.com");

    const req = getLastRequest();
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/auth/register");
  });

  it("fetches public user profile", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          id: "1",
          username: "testuser",
          fullName: "Test User",
          postCount: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { status: 200 },
      ),
    );

    const result = await apiClient.getUserProfile("testuser");
    expect(result.username).toBe("testuser");

    const req = getLastRequest();
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/users/testuser");
  });

  it("fetches current user profile", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          id: "1",
          username: "me",
          fullName: "Me",
          email: "me@example.com",
          postCount: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { status: 200 },
      ),
    );

    const result = await apiClient.getMyProfile();
    expect(result.email).toBe("me@example.com");
  });

  it("creates a post", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          id: "post1",
          content: "Hello",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: { id: "1", username: "me", fullName: "Me" },
        },
        { status: 201 },
      ),
    );

    const result = await apiClient.createPost({ content: "Hello" });
    expect(result.content).toBe("Hello");
  });

  it("rewrites a post draft", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          content: "Rewritten content.",
          provider: "mock",
        },
        { status: 200 },
      ),
    );

    const result = await apiClient.rewritePost({ content: "hello world" });
    expect(result.content).toBe("Rewritten content.");

    const req = getLastRequest();
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/ai/rewrite");
  });

  it("builds feed query parameters", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse({ items: [], nextCursor: undefined }, { status: 200 }),
    );

    await apiClient.getFeed({ cursor: "cursor", limit: 10 });

    const req = getLastRequest();
    const url = new URL(req.url, "http://localhost");
    expect(url.pathname).toBe("/api/bff/posts/feed");
    expect(url.searchParams.get("cursor")).toBe("cursor");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("throws on API errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(toResponse({ message: "Bad request" }, { status: 400 }));

    await expect(
      apiClient.register({
        email: "bad@example.com",
        username: "bad",
        fullName: "Bad",
        password: "Password123",
      }),
    ).rejects.toThrow("Bad request");
  });
});

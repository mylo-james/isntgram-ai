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

  async function readRequestJson(request: Request): Promise<unknown> {
    // openapi-fetch uses the Fetch API Request; read the body to verify payload shaping.
    return request.json();
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

    const req = getLastRequest();
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/users/me");
  });

  it("checks username availability", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(toResponse({ available: true }, { status: 200 }));

    const result = await apiClient.checkUsernameAvailability("availableuser");
    expect(result.available).toBe(true);

    const req = getLastRequest();
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/users/check-username/availableuser");
  });

  it("updates a profile", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          id: "1",
          username: "newuser",
          fullName: "New Name",
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

    const result = await apiClient.updateProfile({ fullName: "New Name", username: "newuser" });
    expect(result.username).toBe("newuser");

    const req = getLastRequest();
    expect(req.method).toBe("PUT");
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/users/profile");
    await expect(readRequestJson(req)).resolves.toEqual({ fullName: "New Name", username: "newuser" });
  });

  it("adds CSRF header for state-changing requests when cookie is present", async () => {
    document.cookie = "isntgram-csrf=token%3A123";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          id: "1",
          username: "newuser",
          fullName: "New Name",
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

    await apiClient.updateProfile({ fullName: "New Name", username: "newuser" });

    const req = getLastRequest();
    expect(req.headers.get("x-csrf-token")).toBe("token:123");
  });

  it("omits CSRF header when cookie is missing", async () => {
    document.cookie = "isntgram-csrf=";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          id: "1",
          username: "newuser",
          fullName: "New Name",
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

    await apiClient.updateProfile({ fullName: "New Name", username: "newuser" });

    const req = getLastRequest();
    expect(req.headers.has("x-csrf-token")).toBe(false);
  });

  it("does not add CSRF header for GET requests", async () => {
    document.cookie = "isntgram-csrf=token%3A123";
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse({ items: [], nextCursor: undefined }, { status: 200 }),
    );

    await apiClient.getFeed();

    const req = getLastRequest();
    expect(req.method).toBe("GET");
    expect(req.headers.has("x-csrf-token")).toBe(false);
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

  it("keeps media identity, CSRF and cancellation on the publication request", async () => {
    document.cookie = "isntgram-csrf=publication-token";
    const controller = new AbortController();
    (global.fetch as jest.Mock).mockImplementation(
      (request: Request) =>
        new Promise((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true,
          });
        }),
    );
    const payload = { content: "Photo", mediaUploadId: "faf70e02-433a-4fe4-a537-46374b972ec8" };
    const pending = apiClient.createPost(payload, { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    const request = getLastRequest();
    expect(await readRequestJson(request.clone())).toEqual(payload);
    expect(request.headers.get("x-csrf-token")).toBe("publication-token");
    controller.abort();
    expect(request.signal.aborted).toBe(true);
    await rejected;
    document.cookie = "isntgram-csrf=";
  });

  it.each([400, 409, 503])(
    "preserves HTTP status %i so publication can distinguish refusal from uncertainty",
    async (status) => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        toResponse({ message: "Publication could not complete" }, { status }),
      );
      await expect(
        apiClient.createPost({ content: "Photo", mediaUploadId: "faf70e02-433a-4fe4-a537-46374b972ec8" }),
      ).rejects.toMatchObject({
        name: "ApiRequestError",
        status,
        message: "Publication could not complete",
      });
    },
  );

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

  it("omits feed query parameters when not provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse({ items: [], nextCursor: undefined }, { status: 200 }),
    );

    await apiClient.getFeed();

    const req = getLastRequest();
    const url = new URL(req.url, "http://localhost");
    expect(url.pathname).toBe("/api/bff/posts/feed");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect(url.searchParams.has("limit")).toBe(false);
  });

  it("fetches a user's posts with query parameters", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(toResponse({ items: [], nextCursor: "next" }, { status: 200 }));

    await apiClient.getUserPosts("testuser", { cursor: "c1", limit: 25 });

    const req = getLastRequest();
    const url = new URL(req.url, "http://localhost");
    expect(url.pathname).toBe("/api/bff/posts/user/testuser");
    expect(url.searchParams.get("cursor")).toBe("c1");
    expect(url.searchParams.get("limit")).toBe("25");
  });

  it("gets follow status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(toResponse({ isFollowing: true }, { status: 200 }));

    const status = await apiClient.getFollowStatus("ava");
    expect(status.isFollowing).toBe(true);

    const req = getLastRequest();
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/follows/ava/status");
  });

  it("follows and unfollows a user", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(toResponse({ isFollowing: true }, { status: 200 }))
      .mockResolvedValueOnce(toResponse({ isFollowing: false }, { status: 200 }));

    await apiClient.followUser("ava");

    const followReq = getLastRequest();
    expect(followReq.method).toBe("POST");
    expect(new URL(followReq.url, "http://localhost").pathname).toBe("/api/bff/follows/ava");

    await apiClient.unfollowUser("ava");

    const unfollowReq = getLastRequest();
    expect(unfollowReq.method).toBe("DELETE");
    expect(new URL(unfollowReq.url, "http://localhost").pathname).toBe("/api/bff/follows/ava");
  });

  it("creates an upload url", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      toResponse(
        {
          uploadUrl: "https://example.com/upload",
          publicUrl: "https://cdn.example.com/file",
          key: "uploads/file",
          expiresIn: 60,
        },
        { status: 201 },
      ),
    );

    const result = await apiClient.createUploadUrl({
      fileName: "hello.png",
      contentType: "image/png",
      contentLength: 123,
    });
    expect(result.publicUrl).toBe("https://cdn.example.com/file");

    const req = getLastRequest();
    expect(req.method).toBe("POST");
    expect(new URL(req.url, "http://localhost").pathname).toBe("/api/bff/media/presign");
    await expect(readRequestJson(req)).resolves.toEqual({
      fileName: "hello.png",
      contentType: "image/png",
      contentLength: 123,
    });
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

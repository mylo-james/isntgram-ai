/** @jest-environment node */
import { cookies } from "next/headers";
import { getApiAccessToken, internalApi } from "@/lib/server-api";
import { GET, POST } from "./route";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/server-api", () => ({
  getApiAccessToken: jest.fn(),
  internalApi: { GET: jest.fn(), POST: jest.fn() },
}));

describe("comments BFF with actual session and CSRF boundaries", () => {
  const origin = "http://127.0.0.1:4320";
  const originalEnv = process.env;
  const csrf = "comments-fixture.1788800000000";
  const requestId = "comments-boundary-request";
  const params = () => ({ params: Promise.resolve({ postId: " post-1 " }) });
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1788800000100);
    process.env = { ...originalEnv, NODE_ENV: "production", NEXTAUTH_URL: origin, NEXT_PUBLIC_APP_URL: origin };
    (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: csrf }) });
    (getApiAccessToken as jest.Mock).mockResolvedValue("fixture-access");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  const request = (headers: Record<string, string> = {}, body = JSON.stringify({ content: "An actual comment" })) =>
    new Request(origin + "/api/bff/posts/post-1/comments", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-csrf-token": csrf,
        "x-request-id": requestId,
        ...headers,
      },
      body,
    });

  it.each([
    ["?cursor=opaque%2Fcursor&limit=12", "fixture-access", "opaque/cursor", 12],
    ["?limit=not-a-number", null, undefined, undefined],
    ["", null, undefined, undefined],
  ])("forwards a paginated read without inventing credentials: %s", async (query, token, cursor, limit) => {
    (getApiAccessToken as jest.Mock).mockResolvedValue(token);
    const payload = { items: [{ id: "comment-1", content: "Retained" }], nextCursor: "next-page" };
    (internalApi.GET as jest.Mock).mockResolvedValue({ data: payload, response: { status: 200 } });
    const response = await GET(
      new Request(origin + "/api/bff/posts/post-1/comments" + query, {
        headers: { "x-request-id": requestId },
      }),
      params(),
    );
    expect(internalApi.GET).toHaveBeenCalledWith("/api/posts/{postId}/comments", {
      params: { path: { postId: "post-1" }, query: { cursor, limit } },
      headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "x-request-id": requestId },
      cache: "no-store",
    });
    expect(await response.json()).toEqual(payload);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(cookies).not.toHaveBeenCalled();
    expect(internalApi.POST).not.toHaveBeenCalled();
  });

  it.each([
    [404, { error: { message: "Post not found" } }, { message: "Post not found" }],
    [502, {}, {}],
  ])("retains failed read status, payload and correlation: %i", async (status, result, payload) => {
    (internalApi.GET as jest.Mock).mockResolvedValue({ ...result, response: { status } });
    const response = await GET(
      new Request(origin + "/api/bff/posts/post-1/comments", {
        headers: { "x-request-id": requestId },
      }),
      params(),
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(payload);
    expect(response.headers.get("x-request-id")).toBe(requestId);
  });

  it.each([
    [{ origin: "https://foreign.invalid" }, "Invalid origin"],
    [{ "x-csrf-token": "wrong" }, "Invalid CSRF token"],
  ] as const)("blocks invalid writes before authentication: %j", async (headers, message) => {
    const response = await POST(request(headers), params());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message });
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(getApiAccessToken).not.toHaveBeenCalled();
    expect(internalApi.POST).not.toHaveBeenCalled();
  });

  it("requires a session before parsing or forwarding a comment", async () => {
    (getApiAccessToken as jest.Mock).mockResolvedValue(null);
    const response = await POST(request({}, "{"), params());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Unauthorized" });
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(internalApi.POST).not.toHaveBeenCalled();
  });

  it("returns a correlated bad-request response for malformed JSON without an upstream write", async () => {
    const response = await POST(request({}, "{"), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Invalid JSON body" });
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(internalApi.POST).not.toHaveBeenCalled();
  });

  it.each([
    [
      201,
      { data: { id: "comment-1", content: "An actual comment" } },
      { id: "comment-1", content: "An actual comment" },
    ],
    [400, { error: { message: "Content is too long" } }, { message: "Content is too long" }],
    [502, {}, {}],
  ])("forwards the comment and preserves response %i", async (status, result, payload) => {
    (internalApi.POST as jest.Mock).mockResolvedValue({ ...result, response: { status } });
    const response = await POST(request(), params());
    expect(internalApi.POST).toHaveBeenCalledTimes(1);
    expect(internalApi.POST).toHaveBeenCalledWith("/api/posts/{postId}/comments", {
      params: { path: { postId: "post-1" } },
      body: { content: "An actual comment" },
      headers: { Authorization: "Bearer fixture-access", "x-request-id": requestId },
      cache: "no-store",
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(payload);
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(internalApi.GET).not.toHaveBeenCalled();
  });
});

/** @jest-environment node */
import { cookies } from "next/headers";
import { getApiAccessToken, internalApi } from "@/lib/server-api";
import { POST, DELETE } from "./route";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/server-api", () => ({
  getApiAccessToken: jest.fn(),
  internalApi: { POST: jest.fn(), DELETE: jest.fn() },
}));

describe("social post like BFF with actual guards", () => {
  const origin = "http://127.0.0.1:4320";
  const originalEnv = process.env;
  const csrf = "social-fixture.1788800000000";
  const requestId = "social-boundary-request";
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

  const request = (method: string, headers: Record<string, string> = {}) =>
    new Request(origin + "/api/bff/posts/post-1/like", {
      method,
      headers: { origin, "x-csrf-token": csrf, "x-request-id": requestId, ...headers },
    });

  describe.each([
    ["POST", POST],
    ["DELETE", DELETE],
  ] as const)("%s", (method, handler) => {
    it.each([
      [{ origin: "https://foreign.invalid" }, "Invalid origin"],
      [{ "x-csrf-token": "wrong" }, "Invalid CSRF token"],
    ] as const)("refuses invalid request before authentication or upstream effects: %j", async (headers, message) => {
      const response = await handler(request(method, headers), params());
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ message });
      expect(response.headers.get("x-request-id")).toBe(requestId);
      expect(getApiAccessToken).not.toHaveBeenCalled();
      expect(internalApi.POST).not.toHaveBeenCalled();
      expect(internalApi.DELETE).not.toHaveBeenCalled();
    });

    it("requires an authenticated session after valid CSRF", async () => {
      (getApiAccessToken as jest.Mock).mockResolvedValue(null);
      const response = await handler(request(method), params());
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ message: "Unauthorized" });
      expect(response.headers.get("x-request-id")).toBe(requestId);
      expect(internalApi.POST).not.toHaveBeenCalled();
      expect(internalApi.DELETE).not.toHaveBeenCalled();
    });

    it.each([
      [200, { data: { isLiked: true, likeCount: 4 } }, { isLiked: true, likeCount: 4 }],
      [404, { error: { message: "Post not found" } }, { message: "Post not found" }],
      [502, {}, {}],
    ])("forwards identifiers and preserves upstream response %i", async (status, payload, expected) => {
      (internalApi[method] as jest.Mock).mockResolvedValue({ ...payload, response: { status } });
      const response = await handler(request(method), params());
      expect(internalApi[method]).toHaveBeenCalledTimes(1);
      expect(internalApi[method]).toHaveBeenCalledWith("/api/posts/{postId}/like", {
        params: { path: { postId: "post-1" } },
        headers: { Authorization: "Bearer fixture-access", "x-request-id": requestId },
        cache: "no-store",
      });
      expect(internalApi[method === "POST" ? "DELETE" : "POST"]).not.toHaveBeenCalled();
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(expected);
      expect(response.headers.get("x-request-id")).toBe(requestId);
    });
  });
});

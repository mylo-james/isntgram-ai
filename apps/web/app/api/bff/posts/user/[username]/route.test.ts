/** @jest-environment node */
import { GET } from "./route";
import { getApiAccessToken, internalApi } from "@/lib/server-api";
jest.mock("@/lib/server-api", () => ({ getApiAccessToken: jest.fn(), internalApi: { GET: jest.fn() } }));
jest.mock("@/lib/bff", () => ({
  getRequestId: (r: Request) => r.headers.get("x-request-id") ?? "missing",
  attachRequestId: (r: Response, id: string) => {
    r.headers.set("x-request-id", id);
    return r;
  },
}));
describe("profile posts BFF", () => {
  beforeEach(() => jest.resetAllMocks());
  it("supports anonymous normalized profile reads and omits malformed pagination", async () => {
    (getApiAccessToken as jest.Mock).mockResolvedValue(null);
    (internalApi.GET as jest.Mock).mockResolvedValue({ data: { items: [] }, response: { status: 200 } });
    const response = await GET(
      new Request("http://local/api/bff/posts/user/%20Ava%20?cursor=c&limit=nope", {
        headers: { "x-request-id": "profile-1" },
      }),
      { params: Promise.resolve({ username: " Ava " }) },
    );
    expect(internalApi.GET).toHaveBeenCalledWith("/api/posts/user/{username}", {
      params: { path: { username: "ava" }, query: { cursor: "c", limit: undefined } },
      headers: { "x-request-id": "profile-1" },
      cache: "no-store",
    });
    expect(response.status).toBe(200);
  });
  it("forwards an authenticated token and upstream error", async () => {
    (getApiAccessToken as jest.Mock).mockResolvedValue("token");
    (internalApi.GET as jest.Mock).mockResolvedValue({ error: { message: "No profile" }, response: { status: 404 } });
    const response = await GET(
      new Request("http://local/api/bff/posts/user/ava", { headers: { "x-request-id": "profile-2" } }),
      { params: Promise.resolve({ username: "ava" }) },
    );
    expect(internalApi.GET).toHaveBeenCalledWith(
      "/api/posts/user/{username}",
      expect.objectContaining({ headers: { Authorization: "Bearer token", "x-request-id": "profile-2" } }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "No profile" });
    expect(response.headers.get("x-request-id")).toBe("profile-2");
  });
});

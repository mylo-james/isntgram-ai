/** @jest-environment node */
import { DELETE, POST } from "./route";
import { internalApi } from "@/lib/server-api";
jest.mock("@/lib/server-api", () => ({ internalApi: { POST: jest.fn(), DELETE: jest.fn() } }));
jest.mock("@/lib/bff", () => ({
  getRequestId: (request: Request) => request.headers.get("x-request-id") || "generated-id",
  attachRequestId: (response: Response, id: string) => {
    response.headers.set("x-request-id", id);
    return response;
  },
  requireCsrf: jest.fn(),
  requireApiAuth: jest.fn(),
}));
const { requireCsrf, requireApiAuth } = jest.requireMock("@/lib/bff");
describe("follow BFF", () => {
  beforeEach(() => jest.resetAllMocks());
  const params = { params: Promise.resolve({ username: "  MiXeD  " }) };
  it("rejects CSRF before authentication or mutation", async () => {
    requireCsrf.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await POST(new Request("http://local", { method: "POST" }), params)).status).toBe(403);
    expect(requireApiAuth).not.toHaveBeenCalled();
    expect(internalApi.POST).not.toHaveBeenCalled();
  });
  it("normalizes POST and DELETE targets while preserving API status", async () => {
    requireCsrf.mockResolvedValue(null);
    requireApiAuth.mockResolvedValue("token");
    (internalApi.POST as jest.Mock).mockResolvedValue({ data: { isFollowing: true }, response: { status: 200 } });
    (internalApi.DELETE as jest.Mock).mockResolvedValue({ error: { message: "gone" }, response: { status: 409 } });
    expect(
      (await POST(new Request("http://local", { method: "POST", headers: { "x-request-id": "follow-id" } }), params))
        .status,
    ).toBe(200);
    expect((await DELETE(new Request("http://local", { method: "DELETE" }), params)).status).toBe(409);
    expect(internalApi.POST).toHaveBeenCalledWith(
      "/api/follows/{username}",
      expect.objectContaining({ params: { path: { username: "mixed" } } }),
    );
    expect(internalApi.DELETE).toHaveBeenCalledWith(
      "/api/follows/{username}",
      expect.objectContaining({ params: { path: { username: "mixed" } } }),
    );
  });
});

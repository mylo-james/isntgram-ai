/** @jest-environment node */
import { GET } from "./route";
import { internalApi } from "@/lib/server-api";
jest.mock("@/lib/server-api", () => ({ internalApi: { GET: jest.fn() } }));
jest.mock("@/lib/bff", () => ({
  getRequestId: (request: Request) => request.headers.get("x-request-id") || "generated-id",
  attachRequestId: (response: Response, id: string) => {
    response.headers.set("x-request-id", id);
    return response;
  },
  requireApiAuth: jest.fn(),
}));
const { requireApiAuth } = jest.requireMock("@/lib/bff");
describe("notifications BFF", () => {
  beforeEach(() => jest.resetAllMocks());
  it("does not forward a cursor without authentication", async () => {
    requireApiAuth.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await GET(new Request("http://local?cursor=next"))).status).toBe(401);
    expect(internalApi.GET).not.toHaveBeenCalled();
  });
  it("passes cursor and API error status through with a request ID", async () => {
    requireApiAuth.mockResolvedValue("token");
    (internalApi.GET as jest.Mock).mockResolvedValue({ error: { message: "unavailable" }, response: { status: 503 } });
    const response = await GET(new Request("http://local?cursor=next", { headers: { "x-request-id": "notice-id" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "unavailable" });
    expect(response.headers.get("x-request-id")).toBe("notice-id");
    expect(internalApi.GET).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ params: { query: { cursor: "next" } } }),
    );
  });
  it("omits a malformed limit rather than forwarding an invalid pagination value", async () => {
    requireApiAuth.mockResolvedValue("token");
    (internalApi.GET as jest.Mock).mockResolvedValue({ data: { items: [] }, response: { status: 200 } });
    await GET(new Request("http://local?cursor=next&limit=not-a-number"));
    expect(internalApi.GET).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ params: { query: { cursor: "next", limit: undefined } } }),
    );
  });
});

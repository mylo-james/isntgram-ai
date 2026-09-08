/** @jest-environment node */
import { GET } from "./route";
import { internalApi } from "@/lib/server-api";
jest.mock("@/lib/server-api", () => ({ internalApi: { GET: jest.fn() } }));
jest.mock("@/lib/bff", () => ({
  getRequestId: (r: Request) => r.headers.get("x-request-id") ?? "missing",
  attachRequestId: (r: Response, id: string) => {
    r.headers.set("x-request-id", id);
    return r;
  },
}));
describe("username availability BFF", () => {
  beforeEach(() => jest.resetAllMocks());
  it("normalizes the reachable username and preserves an availability conflict", async () => {
    (internalApi.GET as jest.Mock).mockResolvedValue({ error: { message: "Taken" }, response: { status: 409 } });
    const response = await GET(
      new Request("http://local/api/bff/users/check-username/%20Feed%20", { headers: { "x-request-id": "name-1" } }),
      { params: Promise.resolve({ username: " Feed " }) },
    );
    expect(internalApi.GET).toHaveBeenCalledWith("/api/users/check-username/{username}", {
      params: { path: { username: "feed" } },
      headers: { "x-request-id": "name-1" },
      cache: "no-store",
    });
    expect(response.status).toBe(409);
    expect(response.headers.get("x-request-id")).toBe("name-1");
    expect(await response.json()).toEqual({ message: "Taken" });
  });
});

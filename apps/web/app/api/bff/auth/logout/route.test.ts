/** @jest-environment node */
import { NextResponse } from "next/server";
import { POST } from "./route";
import { internalApi } from "@/lib/server-api";
import { requireApiAuth, requireCsrf } from "@/lib/bff";
jest.mock("@/lib/server-api", () => ({ internalApi: { POST: jest.fn() } }));
jest.mock("@/lib/bff", () => ({
  getRequestId: (r: Request) => r.headers.get("x-request-id") ?? "missing",
  attachRequestId: (r: Response, id: string) => {
    r.headers.set("x-request-id", id);
    return r;
  },
  requireApiAuth: jest.fn(),
  requireCsrf: jest.fn(),
}));
describe("logout BFF", () => {
  const request = () =>
    new Request("http://local/api/bff/auth/logout", { method: "POST", headers: { "x-request-id": "logout-1" } });
  beforeEach(() => {
    jest.resetAllMocks();
    (requireCsrf as jest.Mock).mockResolvedValue(null);
  });
  it("stops CSRF and session failures before logout", async () => {
    (requireCsrf as jest.Mock).mockResolvedValue(NextResponse.json({}, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(internalApi.POST).not.toHaveBeenCalled();
    (requireCsrf as jest.Mock).mockResolvedValue(null);
    (requireApiAuth as jest.Mock).mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await POST(request())).status).toBe(401);
    expect(internalApi.POST).not.toHaveBeenCalled();
  });
  it("forwards authenticated logout and preserves upstream failure", async () => {
    (requireApiAuth as jest.Mock).mockResolvedValue("token");
    (internalApi.POST as jest.Mock).mockResolvedValue({ error: { message: "Retry" }, response: { status: 503 } });
    const response = await POST(request());
    expect(internalApi.POST).toHaveBeenCalledWith("/api/auth/logout", {
      headers: { Authorization: "Bearer token", "x-request-id": "logout-1" },
      cache: "no-store",
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "Retry" });
    expect(response.headers.get("x-request-id")).toBe("logout-1");
  });
});

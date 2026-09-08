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
describe("media presign BFF", () => {
  const request = () =>
    new Request("http://local/api/bff/media/presign", {
      method: "POST",
      headers: { "x-request-id": "upload-1" },
      body: JSON.stringify({ fileName: "photo.jpg" }),
    });
  beforeEach(() => {
    jest.resetAllMocks();
    (requireCsrf as jest.Mock).mockResolvedValue(null);
  });
  it("stops CSRF and session failures before an upload intent", async () => {
    (requireCsrf as jest.Mock).mockResolvedValue(NextResponse.json({}, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(internalApi.POST).not.toHaveBeenCalled();
    (requireCsrf as jest.Mock).mockResolvedValue(null);
    (requireApiAuth as jest.Mock).mockResolvedValue(NextResponse.json({}, { status: 401 }));
    expect((await POST(request())).status).toBe(401);
    expect(internalApi.POST).not.toHaveBeenCalled();
  });
  it("forwards metadata and preserves upstream validation failure", async () => {
    (requireApiAuth as jest.Mock).mockResolvedValue("token");
    (internalApi.POST as jest.Mock).mockResolvedValue({ error: { message: "Too large" }, response: { status: 413 } });
    const response = await POST(request());
    expect(internalApi.POST).toHaveBeenCalledWith(
      "/api/media/presign",
      expect.objectContaining({
        body: { fileName: "photo.jpg" },
        headers: { Authorization: "Bearer token", "x-request-id": "upload-1" },
        cache: "no-store",
      }),
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("x-request-id")).toBe("upload-1");
    expect(await response.json()).toEqual({ message: "Too large" });
  });
});

it("returns a correlated 400 for malformed JSON without an upstream mutation", async () => {
  jest.resetAllMocks();
  (requireCsrf as jest.Mock).mockResolvedValue(null);
  (requireApiAuth as jest.Mock).mockResolvedValue("token");
  const response = await POST(
    new Request("http://local/api/bff/media/presign", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "malformed-body" },
      body: "{",
    }),
  );
  expect(response.status).toBe(400);
  expect(response.headers.get("x-request-id")).toBe("malformed-body");
  expect(await response.json()).toEqual({ message: "Invalid JSON body" });
  expect(internalApi.POST).not.toHaveBeenCalled();
});

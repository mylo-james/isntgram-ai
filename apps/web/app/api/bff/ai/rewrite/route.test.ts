/** @jest-environment node */
import { NextResponse } from "next/server";
import { POST } from "./route";
import { internalApi } from "@/lib/server-api";
import { requireApiAuth, requireCsrf } from "@/lib/bff";

jest.mock("@/lib/server-api", () => ({ internalApi: { POST: jest.fn() } }));
jest.mock("@/lib/bff", () => ({
  getRequestId: (request: Request) => request.headers.get("x-request-id") ?? "missing",
  attachRequestId: (response: Response, id: string) => {
    response.headers.set("x-request-id", id);
    return response;
  },
  requireApiAuth: jest.fn(),
  requireCsrf: jest.fn(),
}));

describe("AI rewrite BFF", () => {
  const request = () =>
    new Request("http://local/api/bff/ai/rewrite", {
      method: "POST",
      headers: { "x-request-id": "rewrite-1" },
      body: JSON.stringify({ content: "draft" }),
    });
  beforeEach(() => {
    jest.resetAllMocks();
    (requireCsrf as jest.Mock).mockResolvedValue(null);
  });
  it.each([
    ["csrf", NextResponse.json({ message: "CSRF" }, { status: 403 })],
    ["session", NextResponse.json({ message: "Auth" }, { status: 401 })],
  ])("stops %s failures before upstream", async (_name, failure) => {
    if (_name === "csrf") (requireCsrf as jest.Mock).mockResolvedValue(failure);
    else (requireApiAuth as jest.Mock).mockResolvedValue(failure);
    const response = await POST(request());
    expect(response.status).toBe(failure.status);
    expect(response.headers.get("x-request-id")).toBe("rewrite-1");
    expect(internalApi.POST).not.toHaveBeenCalled();
  });
  it("forwards an authenticated rewrite and preserves an upstream error", async () => {
    (requireApiAuth as jest.Mock).mockResolvedValue("token");
    (internalApi.POST as jest.Mock).mockResolvedValue({ error: { message: "Unavailable" }, response: { status: 503 } });
    const response = await POST(request());
    expect(internalApi.POST).toHaveBeenCalledWith(
      "/api/ai/rewrite",
      expect.objectContaining({
        body: { content: "draft" },
        headers: { Authorization: "Bearer token", "x-request-id": "rewrite-1" },
        cache: "no-store",
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("x-request-id")).toBe("rewrite-1");
    expect(await response.json()).toEqual({ message: "Unavailable" });
  });
});

it("returns a correlated 400 for malformed JSON without an upstream mutation", async () => {
  jest.resetAllMocks();
  (requireCsrf as jest.Mock).mockResolvedValue(null);
  (requireApiAuth as jest.Mock).mockResolvedValue("token");
  const response = await POST(
    new Request("http://local/api/bff/ai/rewrite", {
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

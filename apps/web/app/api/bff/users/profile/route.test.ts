/** @jest-environment node */
import { PUT } from "./route";
import { internalApi } from "@/lib/server-api";
jest.mock("@/lib/server-api", () => ({ internalApi: { PUT: jest.fn() } }));
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
describe("profile update BFF", () => {
  beforeEach(() => jest.resetAllMocks());
  it("stops a failed CSRF check before body forwarding", async () => {
    requireCsrf.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await PUT(new Request("http://local", { method: "PUT" }))).status).toBe(403);
    expect(requireApiAuth).not.toHaveBeenCalled();
    expect(internalApi.PUT).not.toHaveBeenCalled();
  });
  it("retains correlation, status and conflict payload from the API", async () => {
    requireCsrf.mockResolvedValue(null);
    requireApiAuth.mockResolvedValue("token");
    (internalApi.PUT as jest.Mock).mockResolvedValue({
      error: { message: "Username already taken" },
      response: { status: 409 },
    });
    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-request-id": "profile-id" },
        body: JSON.stringify({ username: "taken", profilePictureUploadId: "550e8400-e29b-41d4-a716-446655440000" }),
      }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get("x-request-id")).toBe("profile-id");
    expect(await response.json()).toEqual({ message: "Username already taken" });
    expect(internalApi.PUT).toHaveBeenCalledWith(
      "/api/users/profile",
      expect.objectContaining({
        body: { username: "taken", profilePictureUploadId: "550e8400-e29b-41d4-a716-446655440000" },
        headers: { Authorization: "Bearer token", "x-request-id": "profile-id" },
      }),
    );
  });
});

it("returns a correlated 400 for malformed JSON without an upstream mutation", async () => {
  jest.resetAllMocks();
  (requireCsrf as jest.Mock).mockResolvedValue(null);
  (requireApiAuth as jest.Mock).mockResolvedValue("token");
  const response = await PUT(
    new Request("http://local/api/bff/users/profile", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-request-id": "malformed-body" },
      body: "{",
    }),
  );
  expect(response.status).toBe(400);
  expect(response.headers.get("x-request-id")).toBe("malformed-body");
  expect(await response.json()).toEqual({ message: "Invalid JSON body" });
  expect(internalApi.PUT).not.toHaveBeenCalled();
});

/** @jest-environment node */
import { POST } from "./route";
import { internalApi } from "@/lib/server-api";

jest.mock("@/lib/server-api", () => ({ internalApi: { POST: jest.fn() } }));
jest.mock("@/lib/bff", () => ({
  getRequestId: (request: Request) => request.headers.get("x-request-id") || "generated-id",
  attachRequestId: (response: Response, id: string) => {
    response.headers.set("x-request-id", id);
    return response;
  },
  requireCsrf: jest.fn(),
}));
const { requireCsrf } = jest.requireMock("@/lib/bff");

describe("registration BFF", () => {
  beforeEach(() => jest.resetAllMocks());
  it("stops a rejected CSRF request before reading the API", async () => {
    requireCsrf.mockResolvedValue(new Response(JSON.stringify({ message: "CSRF" }), { status: 403 }));
    const response = await POST(
      new Request("http://local/register", { method: "POST", headers: { "x-request-id": "register-csrf" } }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe("register-csrf");
    expect(internalApi.POST).not.toHaveBeenCalled();
  });
  it("forwards an allowed registration without a bearer credential", async () => {
    requireCsrf.mockResolvedValue(null);
    (internalApi.POST as jest.Mock).mockResolvedValue({ data: { id: "u1" }, response: { status: 201 } });
    const response = await POST(
      new Request("http://local/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "register-ok" },
        body: JSON.stringify({ username: "new" }),
      }),
    );
    expect(internalApi.POST).toHaveBeenCalledWith("/api/auth/register", {
      body: { username: "new" },
      headers: { "x-request-id": "register-ok" },
    });
    expect(response.status).toBe(201);
  });
});

it("returns a correlated 400 for malformed JSON without an upstream mutation", async () => {
  jest.resetAllMocks();
  (requireCsrf as jest.Mock).mockResolvedValue(null);
  const response = await POST(
    new Request("http://local/api/bff/auth/register", {
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

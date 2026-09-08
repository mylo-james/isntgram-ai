/** @jest-environment node */
import { GET } from "./route";
import { getApiAccessToken, internalApi } from "@/lib/server-api";

jest.mock("@/lib/server-api", () => ({
  getApiAccessToken: jest.fn(),
  internalApi: { GET: jest.fn() },
}));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));

describe("writing capability BFF", () => {
  beforeEach(() => jest.resetAllMocks());

  it("refuses an unauthenticated read before contacting the API", async () => {
    (getApiAccessToken as jest.Mock).mockResolvedValue(null);
    const response = await GET(
      new Request("http://localhost/api/bff/ai/capabilities", {
        headers: { "x-request-id": "capability-anonymous" },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBe("capability-anonymous");
    expect(internalApi.GET).not.toHaveBeenCalled();
  });

  it("forwards authenticated read-only capabilities with correlation and no cache", async () => {
    const capabilities = { mode: "mock", available: true, label: "Demo text formatter" };
    (getApiAccessToken as jest.Mock).mockResolvedValue("server-only-test-token");
    (internalApi.GET as jest.Mock).mockResolvedValue({ data: capabilities, response: { status: 200 } });
    const response = await GET(
      new Request("http://localhost/api/bff/ai/capabilities", {
        headers: { "x-request-id": "capability-read" },
      }),
    );
    expect(internalApi.GET).toHaveBeenCalledWith("/api/ai/capabilities", {
      headers: { Authorization: "Bearer server-only-test-token", "x-request-id": "capability-read" },
      cache: "no-store",
    });
    expect(await response.json()).toEqual(capabilities);
    expect(response.headers.get("x-request-id")).toBe("capability-read");
  });

  it("preserves an API failure as a failure rather than a false available capability", async () => {
    (getApiAccessToken as jest.Mock).mockResolvedValue("server-only-test-token");
    (internalApi.GET as jest.Mock).mockResolvedValue({ error: { message: "Unavailable" }, response: { status: 503 } });
    const response = await GET(new Request("http://localhost/api/bff/ai/capabilities"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "Unavailable" });
  });
});

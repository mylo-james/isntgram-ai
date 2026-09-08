/** @jest-environment node */
import { cookies } from "next/headers";
import { getApiAccessToken, internalApi } from "@/lib/server-api";
import { POST } from "./route";

jest.mock("server-only", () => ({}));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/server-api", () => ({
  getApiAccessToken: jest.fn(),
  internalApi: { POST: jest.fn() },
}));

describe("post BFF with the actual CSRF and auth guards", () => {
  const origin = "http://127.0.0.1:4320";
  const originalOrigin = process.env.NEXTAUTH_URL;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  let token: string;
  const body = { content: "A retained photo draft", mediaUploadId: "faf70e02-433a-4fe4-a537-46374b972ec8" };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.NEXTAUTH_URL = origin;
    delete process.env.NEXT_PUBLIC_APP_URL;
    token = `bounded-test-token.${Date.now()}`;
    (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: token }) });
    (getApiAccessToken as jest.Mock).mockResolvedValue("test-access-token");
  });
  afterAll(() => {
    if (originalOrigin === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalOrigin;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  const request = (headers: Record<string, string> = {}, requestBody: BodyInit | null = JSON.stringify(body)) =>
    new Request(`${origin}/api/bff/posts`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-csrf-token": token,
        "x-request-id": "photo-request",
        ...headers,
      },
      body: requestBody,
    });

  it.each<Record<string, string>>([{ origin: "http://127.0.0.1:4322" }, { "x-csrf-token": "mismatch" }])(
    "refuses foreign or mismatched CSRF before authentication and writes: %j",
    async (headers) => {
      const response = await POST(request(headers));
      expect(response.status).toBe(403);
      expect(response.headers.get("x-request-id")).toBe("photo-request");
      expect(getApiAccessToken).not.toHaveBeenCalled();
      expect(internalApi.POST).not.toHaveBeenCalled();
    },
  );

  it("refuses an expired matching token before creating a post", async () => {
    token = `bounded-test-token.${Date.now() - 3 * 60 * 60 * 1000}`;
    expect((await POST(request())).status).toBe(403);
    expect(internalApi.POST).not.toHaveBeenCalled();
  });

  it("requires a session after valid CSRF and preserves the response request ID", async () => {
    (getApiAccessToken as jest.Mock).mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBe("photo-request");
    expect(internalApi.POST).not.toHaveBeenCalled();
  });

  it("returns a request-correlated 400 for malformed JSON after valid CSRF and authentication", async () => {
    const response = await POST(request({}, "{malformed-json"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Invalid JSON body" });
    expect(response.headers.get("x-request-id")).toBe("photo-request");
    expect(getApiAccessToken).toHaveBeenCalledTimes(1);
    expect(internalApi.POST).not.toHaveBeenCalled();
  });

  it.each([201, 409])("forwards the exact upload identity and preserves status %i", async (status) => {
    const payload =
      status === 201
        ? { id: "same-post-id", ...body }
        : { message: "Media upload is already attached to another post" };
    (internalApi.POST as jest.Mock).mockResolvedValue({
      ...(status === 201 ? { data: payload } : { error: payload }),
      response: { status },
    });
    const response = await POST(request());
    expect(internalApi.POST).toHaveBeenCalledWith("/api/posts", {
      body,
      headers: { Authorization: "Bearer test-access-token", "x-request-id": "photo-request" },
      cache: "no-store",
    });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(payload);
    expect(response.headers.get("x-request-id")).toBe("photo-request");
  });
});

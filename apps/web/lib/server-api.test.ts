/** @jest-environment node */

jest.mock("next/headers", () => ({ headers: jest.fn(), cookies: jest.fn() }));
jest.mock("next-auth/jwt", () => ({ getToken: jest.fn() }));

import { getToken } from "next-auth/jwt";
import { getApiAccessToken, getRequestId, signedVisitorHeaders } from "./server-api";

const { headers: mockHeaders, cookies: mockCookies } = jest.requireMock("next/headers") as {
  headers: jest.Mock;
  cookies: jest.Mock;
};

function jwtWithPayload(payload: unknown) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

function jwtWithExpiry(exp: unknown) {
  return jwtWithPayload({ exp });
}

function jwtWithRawPayload(payload: string) {
  return `header.${Buffer.from(payload).toString("base64url")}.signature`;
}

describe("server API request boundary", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockCookies.mockResolvedValue({ get: jest.fn() });
    process.env.AUTH_SECRET = "synthetic-auth-secret";
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("returns no token for missing, malformed, invalid-expiry, expired, and near-expiry access tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const invalidAccessTokens: unknown[] = [
      undefined,
      null,
      42,
      "malformed",
      "header.payload",
      "header..signature",
      ".payload.signature",
      jwtWithPayload(null),
      jwtWithPayload([]),
      jwtWithPayload({}),
      jwtWithExpiry("tomorrow"),
      jwtWithRawPayload('{"exp":1e999}'),
      jwtWithExpiry(now),
      jwtWithExpiry(now + 30),
    ];
    for (const accessToken of invalidAccessTokens) {
      (getToken as jest.Mock).mockResolvedValueOnce(accessToken === undefined ? null : { accessToken });
      await expect(getApiAccessToken()).resolves.toBeNull();
    }
  });

  it("returns a token beyond skew and passes only the app-router header/cookie request seam", async () => {
    const accessToken = jwtWithExpiry(Math.floor(Date.now() / 1000) + 31);
    const headers = new Headers({ cookie: "session=opaque" });
    const cookies = { get: jest.fn() };
    mockHeaders.mockResolvedValue(headers);
    mockCookies.mockResolvedValue(cookies);
    (getToken as jest.Mock).mockResolvedValue({ accessToken });

    await expect(getApiAccessToken()).resolves.toBe(accessToken);
    expect(getToken).toHaveBeenCalledWith({
      req: { headers, cookies },
      secret: "synthetic-auth-secret",
    });
  });

  it("preserves a nonblank request ID and generates one for blank or missing input", async () => {
    mockHeaders.mockResolvedValueOnce(new Headers({ "x-request-id": "request-42" }));
    await expect(getRequestId()).resolves.toBe("request-42");

    const randomUUID = jest.spyOn(crypto, "randomUUID").mockReturnValue("generated-request-id");
    mockHeaders.mockResolvedValueOnce(new Headers({ "x-request-id": "   " }));
    await expect(getRequestId()).resolves.toBe("generated-request-id");
    mockHeaders.mockResolvedValueOnce(new Headers());
    await expect(getRequestId()).resolves.toBe("generated-request-id");
    randomUUID.mockRestore();
  });

  it("signs only Vercel's provider-owned visitor address for the exact API method and path", () => {
    const previousVercel = process.env.VERCEL;
    const previousSecret = process.env.BFF_PROXY_SECRET;
    process.env.VERCEL = "1";
    process.env.BFF_PROXY_SECRET = "b".repeat(32);
    const signed = signedVisitorHeaders(
      new Headers({ "x-vercel-forwarded-for": "198.51.100.3" }),
      "POST",
      "/api/auth/demo",
    ) as Record<string, string>;
    expect(signed["x-isntgram-client-address"]).toBe("198.51.100.3");
    expect(signed["x-isntgram-client-signature"]).toMatch(/^[a-f0-9]{64}$/);
    process.env.VERCEL = previousVercel;
    process.env.BFF_PROXY_SECRET = previousSecret;
  });
});

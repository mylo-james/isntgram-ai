/** @jest-environment node */

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/server-api", () => ({ getApiAccessToken: jest.fn() }));

import { cookies } from "next/headers";
import { requireApiAuth, requireCsrf } from "./bff";
import { getApiAccessToken } from "./server-api";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, CSRF_TOKEN_TTL_MS } from "./csrf";

const phoneOrigin = "https://isntgram-phone.example.ts.net:8445";
const originalEnvironment = process.env;

function request(headers: Record<string, string> = {}) {
  return new Request(`${phoneOrigin}/api/bff/posts`, {
    method: "POST",
    headers: { origin: phoneOrigin, ...headers },
  });
}

describe("phone BFF security boundary", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnvironment,
      NODE_ENV: "production",
      NEXTAUTH_URL: phoneOrigin,
    };
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("accepts the exact configured HTTPS origin with a matching current token", async () => {
    const token = `phone-csrf.${Date.now()}`;
    (cookies as jest.Mock).mockResolvedValue({
      get: (name: string) => (name === CSRF_COOKIE_NAME ? { value: token } : undefined),
    });
    await expect(requireCsrf(request({ [CSRF_HEADER_NAME]: token }))).resolves.toBeNull();
  });

  it("refuses a foreign origin, missing token, and expired matching token", async () => {
    const current = `phone-csrf.${Date.now()}`;
    (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: current }) });
    await expect(
      requireCsrf(request({ origin: "https://foreign.example.ts.net:8445", [CSRF_HEADER_NAME]: current })),
    ).resolves.toMatchObject({ status: 403 });
    await expect(requireCsrf(request())).resolves.toMatchObject({ status: 403 });
    const expired = `phone-csrf.${Date.now() - CSRF_TOKEN_TTL_MS - 1}`;
    (cookies as jest.Mock).mockResolvedValue({ get: () => ({ value: expired }) });
    await expect(requireCsrf(request({ [CSRF_HEADER_NAME]: expired }))).resolves.toMatchObject({ status: 403 });
  });

  it("uses the server-side API token seam only after the BFF boundary", async () => {
    (getApiAccessToken as jest.Mock).mockResolvedValue("server-only-access-token");
    await expect(requireApiAuth()).resolves.toBe("server-only-access-token");
    expect(getApiAccessToken).toHaveBeenCalledTimes(1);
  });
});

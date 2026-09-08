/** @jest-environment node */
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { CSRF_COOKIE_NAME } from "./lib/csrf";

describe("CSRF proxy", () => {
  it("rotates a missing token with the local-development cookie contract", () => {
    const response = proxy(new NextRequest("http://127.0.0.1:4320/feed"));
    const cookie = response.cookies.get(CSRF_COOKIE_NAME);
    expect(cookie?.value).toMatch(/^[a-f0-9]{64}\.\d+$/);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.httpOnly).toBe(false);
    expect(cookie?.secure).toBe(false);
    expect(cookie?.path).toBe("/");
  });

  it("does not rotate a fresh well-formed token", () => {
    const fresh = `token.${Date.now()}`;
    const request = new NextRequest("http://127.0.0.1:4320/feed", {
      headers: { cookie: `${CSRF_COOKIE_NAME}=${fresh}` },
    });
    expect(proxy(request).cookies.get(CSRF_COOKIE_NAME)).toBeUndefined();
  });
});

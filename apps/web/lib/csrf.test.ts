import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, getCsrfTokenFromCookie, isStateChangingMethod } from "./csrf";

describe("csrf helpers", () => {
  afterEach(() => {
    document.cookie = `${CSRF_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });

  it("detects state-changing methods case-insensitively", () => {
    expect(isStateChangingMethod("post")).toBe(true);
    expect(isStateChangingMethod("PUT")).toBe(true);
    expect(isStateChangingMethod("patch")).toBe(true);
    expect(isStateChangingMethod("DELETE")).toBe(true);
    expect(isStateChangingMethod("GET")).toBe(false);
  });

  it("returns null when csrf cookie is missing", () => {
    document.cookie = "other=1";
    expect(getCsrfTokenFromCookie()).toBeNull();
  });

  it("returns decoded csrf token from cookie", () => {
    const token = "token%3A123";
    document.cookie = `${CSRF_COOKIE_NAME}=${token}`;

    expect(getCsrfTokenFromCookie()).toBe("token:123");
  });

  it("uses the expected header name constant", () => {
    expect(CSRF_HEADER_NAME).toBe("x-csrf-token");
  });
});

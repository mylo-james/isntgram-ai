/** @jest-environment node */
import { getCsrfTokenFromCookie } from "./csrf";

describe("csrf helpers (server)", () => {
  it("returns null when document is unavailable", () => {
    expect(typeof document).toBe("undefined");
    expect(getCsrfTokenFromCookie()).toBeNull();
  });
});

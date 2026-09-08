import { isReservedUsername, normalizeUsername, RESERVED_USERNAMES } from "./username-policy";

describe("username policy", () => {
  it("normalizes username values before checking static routes", () => {
    expect(normalizeUsername("  ExPlOrE  ")).toBe("explore");
    expect(isReservedUsername("  ExPlOrE  ")).toBe(true);
    expect(isReservedUsername("_NEXT")).toBe(true);
  });

  it("reserves exactly the application route names", () => {
    expect(RESERVED_USERNAMES).toEqual([
      "_next",
      "api",
      "auth",
      "explore",
      "feed",
      "health",
      "login",
      "notifications",
      "post",
      "register",
      "upload",
    ]);
    expect(isReservedUsername("portfolio_user")).toBe(false);
  });
});

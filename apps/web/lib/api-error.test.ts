import { getApiErrorMessage } from "./api-error";

describe("getApiErrorMessage", () => {
  it("returns the message string when present", () => {
    expect(getApiErrorMessage({ message: "Bad request" })).toBe("Bad request");
  });

  it("returns the first error when an errors array is present", () => {
    expect(getApiErrorMessage({ errors: ["First", "Second"] })).toBe("First");
  });

  it("prefers errors[] over message when both are present", () => {
    expect(getApiErrorMessage({ errors: ["From errors"], message: "From message" })).toBe("From errors");
  });

  it("returns the first message when message is an array", () => {
    expect(getApiErrorMessage({ message: ["First", "Second"] })).toBe("First");
  });

  it("falls back when the message is empty/whitespace", () => {
    expect(getApiErrorMessage({ message: "   " })).toBe("Request failed");
  });

  it("falls back when arrays are empty or contain non-strings", () => {
    expect(getApiErrorMessage({ errors: [] })).toBe("Request failed");
    expect(getApiErrorMessage({ message: [] })).toBe("Request failed");
    expect(getApiErrorMessage({ errors: ["ok", 1] })).toBe("Request failed");
    expect(getApiErrorMessage({ message: ["ok", 1] })).toBe("Request failed");
  });

  it("falls back when error is not an object", () => {
    expect(getApiErrorMessage("boom")).toBe("Request failed");
  });

  it("uses the provided fallback", () => {
    expect(getApiErrorMessage(null, "Nope")).toBe("Nope");
  });
});

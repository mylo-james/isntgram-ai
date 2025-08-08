import { validateEmail, validatePassword, validateRequired, validateUsername } from "./validation";

describe("Validation Utilities", () => {
  describe("validateEmail", () => {
    it("returns error for empty email", () => {
      const result = validateEmail("");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Email is required");
    });

    it("returns error for invalid email format", () => {
      const result = validateEmail("invalid-email");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Please enter a valid email address");
    });

    it("returns valid for correct email", () => {
      const result = validateEmail("test@example.com");
      expect(result.isValid).toBe(true);
    });
  });

  describe("validatePassword", () => {
    it("returns error for empty password", () => {
      const result = validatePassword("");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Password is required");
    });

    it("returns error for short password", () => {
      const result = validatePassword("weak");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Password must be at least 8 characters");
    });

    it("returns valid for strong password", () => {
      const result = validatePassword("password123");
      expect(result.isValid).toBe(true);
    });
  });

  describe("validateRequired", () => {
    it("returns error for empty value", () => {
      const result = validateRequired("", "Full name");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Full name is required");
    });

    it("returns valid for non-empty value", () => {
      const result = validateRequired("Test User", "Full name");
      expect(result.isValid).toBe(true);
    });
  });

  describe("validateUsername", () => {
    it("returns error for empty username", () => {
      const result = validateUsername("");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Username is required");
    });

    it("returns error for short username", () => {
      const result = validateUsername("ab");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Username must be at least 3 characters");
    });

    it("returns error for invalid characters", () => {
      const result = validateUsername("test@user");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Username can only contain letters, numbers, and underscores");
    });

    it("returns valid for correct username", () => {
      const result = validateUsername("testuser");
      expect(result.isValid).toBe(true);
    });
  });
});

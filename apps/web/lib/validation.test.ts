import { validateEmail, validateFullName, validatePassword, validateRequired, validateUsername } from "./validation";

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
      const result = validatePassword("Password123");
      expect(result.isValid).toBe(true);
    });

    it("returns error for missing complexity requirements", () => {
      const result = validatePassword("password123");
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("lowercase");
    });

    it("returns error for overly long password", () => {
      const result = validatePassword("Password123" + "a".repeat(200));
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Password must not exceed 128 characters");
    });
  });

  describe("validateFullName", () => {
    it("returns error for empty full name", () => {
      const result = validateFullName("");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Full name is required");
    });

    it("returns error for short full name", () => {
      const result = validateFullName("A");
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Full name must be at least 2 characters");
    });

    it("returns error for overly long full name", () => {
      const result = validateFullName("A".repeat(101));
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Full name must not exceed 100 characters");
    });

    it("returns valid for correct full name", () => {
      const result = validateFullName("Test User");
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
      expect(result.message).toBe("Username can only contain lowercase letters, numbers, and underscores");
    });

    it("returns error for overly long username", () => {
      const result = validateUsername("a".repeat(31));
      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Username must not exceed 30 characters");
    });

    it("returns valid for correct username", () => {
      const result = validateUsername("testuser");
      expect(result.isValid).toBe(true);
    });
  });
});

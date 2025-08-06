import {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  AuthState,
} from "./auth";

describe("Auth Types", () => {
  describe("User interface", () => {
    it("should have required properties", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        firstName: "Test",
        lastName: "User",
        isVerified: false,
        createdAt: new Date(),
      };

      expect(user.id).toBe("1");
      expect(user.email).toBe("test@example.com");
      expect(user.username).toBe("testuser");
      expect(user.firstName).toBe("Test");
      expect(user.lastName).toBe("User");
      expect(user.isVerified).toBe(false);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it("should allow optional properties", () => {
      const user: User = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        firstName: "Test",
        isVerified: false,
        createdAt: new Date(),
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "Test bio",
        updatedAt: new Date(),
      };

      expect(user.avatarUrl).toBe("https://example.com/avatar.jpg");
      expect(user.bio).toBe("Test bio");
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("AuthResponse interface", () => {
    it("should have required properties", () => {
      const authResponse: AuthResponse = {
        user: {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          firstName: "Test",
          isVerified: false,
          createdAt: new Date(),
        },
        accessToken: "access-token",
        refreshToken: "refresh-token",
      };

      expect(authResponse.user).toBeDefined();
      expect(authResponse.accessToken).toBe("access-token");
      expect(authResponse.refreshToken).toBe("refresh-token");
    });
  });

  describe("LoginRequest interface", () => {
    it("should have required properties", () => {
      const loginRequest: LoginRequest = {
        email: "test@example.com",
        password: "password123",
      };

      expect(loginRequest.email).toBe("test@example.com");
      expect(loginRequest.password).toBe("password123");
    });
  });

  describe("RegisterRequest interface", () => {
    it("should have required properties", () => {
      const registerRequest: RegisterRequest = {
        email: "test@example.com",
        username: "testuser",
        password: "password123",
        firstName: "Test",
        lastName: "User",
      };

      expect(registerRequest.email).toBe("test@example.com");
      expect(registerRequest.username).toBe("testuser");
      expect(registerRequest.password).toBe("password123");
      expect(registerRequest.firstName).toBe("Test");
      expect(registerRequest.lastName).toBe("User");
    });
  });

  describe("AuthState interface", () => {
    it("should have required properties", () => {
      const authState: AuthState = {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        accessToken: null,
        refreshToken: null,
      };

      expect(authState.user).toBeNull();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.isLoading).toBe(false);
      expect(authState.error).toBeNull();
      expect(authState.accessToken).toBeNull();
      expect(authState.refreshToken).toBeNull();
    });
  });
});

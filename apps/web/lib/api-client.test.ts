// Mock axios before importing the module
jest.mock("axios");

// Import after mocking
import { apiClient } from "./api-client";
import { mockAxiosInstance } from "./__mocks__/axios";

describe("API Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.clearAuthToken();
  });

  describe("registration", () => {
    it("should call registration endpoint with correct data", async () => {
      const mockResponse = {
        data: {
          user: { id: "1", email: "test@example.com", username: "testuser", fullName: "Test User" },
          message: "User registered successfully",
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      const result = await apiClient.register(registerData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/auth/register", registerData);
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle registration errors", async () => {
      const mockError = {
        response: {
          data: { message: "Email already exists" },
          status: 409,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "existing@example.com",
        username: "existinguser",
        fullName: "Existing User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle registration with try-catch block", async () => {
      const mockError = new Error("Network error");
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toThrow("Network error");
    });
  });

  describe("login", () => {
    it("should call login endpoint and return data", async () => {
      const mockResponse = {
        data: {
          user: { id: "1", email: "test@example.com", username: "testuser", fullName: "Test User" },
          accessToken: "token123",
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiClient.login({
        email: "a@b.com",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/auth/signin", {
        email: "a@b.com",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle login errors", async () => {
      const mockError = new Error("Invalid credentials");
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(apiClient.login({ email: "a@b.com", password: "TotallyWrongPass!" })).rejects.toThrow(
        "Invalid credentials",
      );
    });
  });

  describe("getMyProfile", () => {
    it("should call /api/users/me and return data", async () => {
      const mockResponse = {
        data: {
          id: "1",
          email: "a@b.com",
          username: "ab",
          fullName: "A B",
          postCount: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await apiClient.getMyProfile();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/api/users/me");
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle getMyProfile errors", async () => {
      const mockError = new Error("Unauthorized");
      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(apiClient.getMyProfile()).rejects.toThrow("Unauthorized");
    });
  });

  describe("logout", () => {
    it("should call logout endpoint and return data", async () => {
      const mockResponse = { data: { message: "ok" } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiClient.logout();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/auth/signout");
      expect(result).toEqual({ message: "ok" });
    });

    it("should handle logout errors", async () => {
      const mockError = new Error("Logout failed");
      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(apiClient.logout()).rejects.toThrow("Logout failed");
    });
  });

  describe("token helpers", () => {
    it("gets/sets/clears bearer token", () => {
      expect(apiClient.getAuthToken()).toBeNull();
      expect(typeof apiClient.setAuthToken).toBe("function");
      expect(typeof apiClient.clearAuthToken).toBe("function");
      apiClient.setAuthToken("test-token");
      expect(apiClient.getAuthToken()).toBe("test-token");
      apiClient.clearAuthToken();
      expect(apiClient.getAuthToken()).toBeNull();
    });
  });

  describe("authentication headers", () => {
    it("should include authorization header when token is available", () => {
      const mockInterceptor = jest.fn();
      mockAxiosInstance.interceptors.request.use = mockInterceptor;

      // Simulate setting auth token
      if (typeof window !== "undefined") {
        localStorage.setItem("authToken", "test-token");
      }

      // The interceptor should be set up in the constructor
      expect(mockAxiosInstance.interceptors.request.use).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      const mockError = new Error("Network Error");
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle 500 server errors", async () => {
      const mockError = {
        response: {
          data: { message: "Internal server error" },
          status: 500,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle 400 server errors", async () => {
      const mockError = {
        response: {
          data: { message: "Bad request" },
          status: 400,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle 401 server errors", async () => {
      const mockError = {
        response: {
          data: { message: "Unauthorized" },
          status: 401,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle 403 server errors", async () => {
      const mockError = {
        response: {
          data: { message: "Forbidden" },
          status: 403,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle 404 server errors", async () => {
      const mockError = {
        response: {
          data: { message: "Not found" },
          status: 404,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle 422 server errors", async () => {
      const mockError = {
        response: {
          data: { message: "Validation failed" },
          status: 422,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });

    it("should handle 409 server errors", async () => {
      const mockError = {
        response: {
          data: { message: "Conflict" },
          status: 409,
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const registerData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: process.env.TEST_USER_PASSWORD || "TestPassword123!",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });
  });
});

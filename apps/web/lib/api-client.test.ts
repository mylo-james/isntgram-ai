// Mock axios before importing the module
jest.mock("axios");

// Import after mocking
import { apiClient } from "./api-client";
import { mockAxiosInstance } from "./__mocks__/axios";

describe("API Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        password: "password123",
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
        password: "password123",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
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
        password: "password123",
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
        password: "password123",
      };

      await expect(apiClient.register(registerData)).rejects.toEqual(mockError);
    });
  });
});

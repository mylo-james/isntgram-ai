import { configureStore } from "@reduxjs/toolkit";
import authReducer, {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  clearError,
  setUser,
  setAccessToken,
  clearAuth,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectError,
  selectAccessToken,
} from "./auth-slice";

// Mock API client
jest.mock("../api-client", () => ({
  apiClient: {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
  },
}));

const { apiClient } = jest.requireMock("../api-client") as {
  apiClient: {
    register: jest.Mock;
    login: jest.Mock;
    logout: jest.Mock;
    getCurrentUser: jest.Mock;
    setAuthToken: jest.Mock;
    clearAuthToken: jest.Mock;
  };
};

describe("Auth Slice", () => {
  let store: ReturnType<typeof setupStore>;

  const setupStore = () =>
    configureStore({
      reducer: {
        auth: authReducer,
      },
    });

  beforeEach(() => {
    store = setupStore();
    jest.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const state = store.getState().auth;
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      // accessToken is no longer stored in state
    });
  });

  describe("Reducers", () => {
    it("should clear error", () => {
      // Set initial error state
      store.dispatch({ type: "auth/register/rejected", payload: "Test error" });
      expect(selectError(store.getState())).toBe("Test error");

      // Clear error
      store.dispatch(clearError());
      expect(selectError(store.getState())).toBeNull();
    });

    it("should set user", () => {
      const mockUser = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      store.dispatch(setUser(mockUser));
      expect(selectUser(store.getState())).toEqual(mockUser);
      expect(selectIsAuthenticated(store.getState())).toBe(true);
      expect(selectError(store.getState())).toBeNull();
    });

    it("should accept setAccessToken action without changing state", () => {
      const token = "test-token";
      store.dispatch(setAccessToken(token));
      expect(selectAccessToken()).toBeNull();
      expect(apiClient.setAuthToken).not.toHaveBeenCalled();
    });

    it("should clear auth", () => {
      // Set initial authenticated state
      const mockUser = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        postsCount: 0,
        followerCount: 0,
        followingCount: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
      };
      store.dispatch(setUser(mockUser));
      store.dispatch(setAccessToken("test-token"));

      // Clear auth
      store.dispatch(clearAuth());
      expect(selectUser(store.getState())).toBeNull();
      expect(selectIsAuthenticated(store.getState())).toBe(false);
      expect(selectAccessToken()).toBeNull();
      expect(selectError(store.getState())).toBeNull();
      expect(apiClient.clearAuthToken).not.toHaveBeenCalled();
    });
  });

  describe("Async Thunks", () => {
    describe("registerUser", () => {
      it("should handle successful registration", async () => {
        const mockResponse = {
          user: {
            id: "1",
            email: "test@example.com",
            username: "testuser",
            fullName: "Test User",
          },
          message: "User registered successfully",
        };

        apiClient.register.mockResolvedValue(mockResponse);

        const userData = {
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
          password: "password123",
        };

        await store.dispatch(registerUser(userData));

        expect(apiClient.register).toHaveBeenCalledWith(userData);
        expect(selectUser(store.getState())).toEqual(mockResponse.user);
        expect(selectIsAuthenticated(store.getState())).toBe(true);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBeNull();
      });

      it("should handle registration failure", async () => {
        const errorMessage = "Email already exists";
        apiClient.register.mockRejectedValue(new Error(errorMessage));

        const userData = {
          email: "existing@example.com",
          username: "existinguser",
          fullName: "Existing User",
          password: "password123",
        };

        await store.dispatch(registerUser(userData));

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe(errorMessage);
      });
    });

    describe("loginUser", () => {
      it("should handle successful login", async () => {
        const mockResponse = {
          user: {
            id: "1",
            email: "test@example.com",
            username: "testuser",
            fullName: "Test User",
          },
          accessToken: "test-token",
        };

        apiClient.login.mockResolvedValue(mockResponse);

        const credentials = {
          email: "test@example.com",
          password: "password123",
        };

        await store.dispatch(loginUser(credentials));

        expect(apiClient.login).toHaveBeenCalledWith(credentials);
        expect(selectUser(store.getState())).toEqual(mockResponse.user);
        expect(selectAccessToken()).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(true);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBeNull();
        expect(apiClient.setAuthToken).not.toHaveBeenCalled();
      });

      it("should handle login failure", async () => {
        const errorMessage = "Invalid credentials";
        apiClient.login.mockRejectedValue(new Error(errorMessage));

        const credentials = {
          email: "test@example.com",
          password: "wrongpassword",
        };

        await store.dispatch(loginUser(credentials));

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe(errorMessage);
      });
    });

    describe("logoutUser", () => {
      it("should handle successful logout", async () => {
        // Set initial authenticated state
        const mockUser = {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
          postsCount: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt: "2024-01-01T00:00:00.000Z",
        };
        store.dispatch(setUser(mockUser));
        store.dispatch(setAccessToken("test-token"));

        apiClient.logout.mockResolvedValue({ message: "Logged out successfully" });

        await store.dispatch(logoutUser());

        expect(apiClient.logout).toHaveBeenCalled();
        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectAccessToken()).toBeNull();
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBeNull();
        expect(apiClient.clearAuthToken).not.toHaveBeenCalled();
      });

      it("should clear auth even if logout fails", async () => {
        // Set initial authenticated state
        const mockUser = {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
          postsCount: 0,
          followerCount: 0,
          followingCount: 0,
          createdAt: "2024-01-01T00:00:00.000Z",
        };
        store.dispatch(setUser(mockUser));
        store.dispatch(setAccessToken("test-token"));

        const errorMessage = "Logout failed";
        apiClient.logout.mockRejectedValue(new Error(errorMessage));

        await store.dispatch(logoutUser());

        // Should still clear local state even if API call fails
        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectAccessToken()).toBeNull();
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe(errorMessage);
        expect(apiClient.clearAuthToken).not.toHaveBeenCalled();
      });
    });

    describe("getCurrentUser", () => {
      it("should handle successful get current user", async () => {
        const mockResponse = {
          user: {
            id: "1",
            email: "test@example.com",
            username: "testuser",
            fullName: "Test User",
          },
        };

        apiClient.getCurrentUser.mockResolvedValue(mockResponse);

        await store.dispatch(getCurrentUser());

        expect(apiClient.getCurrentUser).toHaveBeenCalled();
        expect(selectUser(store.getState())).toEqual(mockResponse.user);
        expect(selectIsAuthenticated(store.getState())).toBe(true);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBeNull();
      });

      it("should handle get current user failure", async () => {
        const errorMessage = "Failed to get user data";
        apiClient.getCurrentUser.mockRejectedValue(new Error(errorMessage));

        await store.dispatch(getCurrentUser());

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe(errorMessage);
      });
    });
  });

  describe("Loading States", () => {
    it("should set loading state during async operations", async () => {
      // Mock a slow API call with proper response
      const mockResponse = {
        user: {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
        },
        message: "User registered successfully",
      };
      apiClient.register.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100)),
      );

      const userData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: "password123",
      };

      const promise = store.dispatch(registerUser(userData));

      // Check loading state is true during operation
      expect(selectIsLoading(store.getState())).toBe(true);

      await promise;

      // Check loading state is false after operation
      expect(selectIsLoading(store.getState())).toBe(false);
    });
  });
});

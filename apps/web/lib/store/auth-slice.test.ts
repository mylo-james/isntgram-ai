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

    it("should set user with minimal required fields", () => {
      const minimalUser = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
      };

      store.dispatch(setUser(minimalUser));
      expect(selectUser(store.getState())).toEqual(minimalUser);
      expect(selectIsAuthenticated(store.getState())).toBe(true);
    });

    it("should set user with all optional fields", () => {
      const fullUser = {
        id: "1",
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        profilePictureUrl: "https://example.com/avatar.jpg",
        bio: "Test bio",
        postsCount: 10,
        followerCount: 100,
        followingCount: 50,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      };

      store.dispatch(setUser(fullUser));
      expect(selectUser(store.getState())).toEqual(fullUser);
      expect(selectIsAuthenticated(store.getState())).toBe(true);
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

    it("should clear auth when no user is set", () => {
      // Clear auth without setting user first
      store.dispatch(clearAuth());
      expect(selectUser(store.getState())).toBeNull();
      expect(selectIsAuthenticated(store.getState())).toBe(false);
      expect(selectError(store.getState())).toBeNull();
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

      it("should handle registration failure with non-Error object", async () => {
        const errorObject = { message: "Custom error" };
        apiClient.register.mockRejectedValue(errorObject);

        const userData = {
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
          password: "password123",
        };

        await store.dispatch(registerUser(userData));

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Registration failed");
      });

      it("should handle registration failure with null error", async () => {
        apiClient.register.mockRejectedValue(null);

        const userData = {
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
          password: "password123",
        };

        await store.dispatch(registerUser(userData));

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Registration failed");
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

      it("should handle login failure with non-Error object", async () => {
        const errorObject = { message: "Custom error" };
        apiClient.login.mockRejectedValue(errorObject);

        const credentials = {
          email: "test@example.com",
          password: "password123",
        };

        await store.dispatch(loginUser(credentials));

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Login failed");
      });

      it("should handle login failure with null error", async () => {
        apiClient.login.mockRejectedValue(null);

        const credentials = {
          email: "test@example.com",
          password: "password123",
        };

        await store.dispatch(loginUser(credentials));

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Login failed");
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

      it("should handle logout failure with non-Error object", async () => {
        const errorObject = { message: "Custom error" };
        apiClient.logout.mockRejectedValue(errorObject);

        await store.dispatch(logoutUser());

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Logout failed");
      });

      it("should handle logout failure with null error", async () => {
        apiClient.logout.mockRejectedValue(null);

        await store.dispatch(logoutUser());

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Logout failed");
      });

      it("should handle logout when not authenticated", async () => {
        apiClient.logout.mockResolvedValue({ message: "Logged out successfully" });

        await store.dispatch(logoutUser());

        expect(apiClient.logout).toHaveBeenCalled();
        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBeNull();
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

      it("should handle get current user failure with non-Error object", async () => {
        const errorObject = { message: "Custom error" };
        apiClient.getCurrentUser.mockRejectedValue(errorObject);

        await store.dispatch(getCurrentUser());

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Failed to get user data");
      });

      it("should handle get current user failure with null error", async () => {
        apiClient.getCurrentUser.mockRejectedValue(null);

        await store.dispatch(getCurrentUser());

        expect(selectUser(store.getState())).toBeNull();
        expect(selectIsAuthenticated(store.getState())).toBe(false);
        expect(selectIsLoading(store.getState())).toBe(false);
        expect(selectError(store.getState())).toBe("Failed to get user data");
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

    it("should set loading state during login", async () => {
      const mockResponse = {
        user: {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
        },
        accessToken: "test-token",
      };
      apiClient.login.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100)));

      const credentials = {
        email: "test@example.com",
        password: "password123",
      };

      const promise = store.dispatch(loginUser(credentials));

      expect(selectIsLoading(store.getState())).toBe(true);

      await promise;

      expect(selectIsLoading(store.getState())).toBe(false);
    });

    it("should set loading state during logout", async () => {
      apiClient.logout.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ message: "ok" }), 100)),
      );

      const promise = store.dispatch(logoutUser());

      expect(selectIsLoading(store.getState())).toBe(true);

      await promise;

      expect(selectIsLoading(store.getState())).toBe(false);
    });

    it("should set loading state during getCurrentUser", async () => {
      const mockResponse = {
        user: {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
        },
      };
      apiClient.getCurrentUser.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100)),
      );

      const promise = store.dispatch(getCurrentUser());

      expect(selectIsLoading(store.getState())).toBe(true);

      await promise;

      expect(selectIsLoading(store.getState())).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should clear error when starting new async operation", async () => {
      // Set initial error state
      store.dispatch({ type: "auth/register/rejected", payload: "Previous error" });
      expect(selectError(store.getState())).toBe("Previous error");

      // Start new registration
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

      // Error should be cleared on success
      expect(selectError(store.getState())).toBeNull();
    });

    it("should maintain error state when operation fails", async () => {
      const errorMessage = "Operation failed";
      apiClient.register.mockRejectedValue(new Error(errorMessage));

      const userData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: "password123",
      };

      await store.dispatch(registerUser(userData));

      expect(selectError(store.getState())).toBe(errorMessage);
    });
  });

  describe("State Transitions", () => {
    it("should handle complete auth flow", async () => {
      // 1. Register
      const registerResponse = {
        user: {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
        },
        message: "User registered successfully",
      };
      apiClient.register.mockResolvedValue(registerResponse);

      const userData = {
        email: "test@example.com",
        username: "testuser",
        fullName: "Test User",
        password: "password123",
      };

      await store.dispatch(registerUser(userData));

      expect(selectUser(store.getState())).toEqual(registerResponse.user);
      expect(selectIsAuthenticated(store.getState())).toBe(true);

      // 2. Logout
      apiClient.logout.mockResolvedValue({ message: "Logged out successfully" });

      await store.dispatch(logoutUser());

      expect(selectUser(store.getState())).toBeNull();
      expect(selectIsAuthenticated(store.getState())).toBe(false);
    });

    it("should handle login after logout", async () => {
      // 1. Login
      const loginResponse = {
        user: {
          id: "1",
          email: "test@example.com",
          username: "testuser",
          fullName: "Test User",
        },
        accessToken: "test-token",
      };
      apiClient.login.mockResolvedValue(loginResponse);

      const credentials = {
        email: "test@example.com",
        password: "password123",
      };

      await store.dispatch(loginUser(credentials));

      expect(selectUser(store.getState())).toEqual(loginResponse.user);
      expect(selectIsAuthenticated(store.getState())).toBe(true);

      // 2. Logout
      apiClient.logout.mockResolvedValue({ message: "Logged out successfully" });

      await store.dispatch(logoutUser());

      expect(selectUser(store.getState())).toBeNull();
      expect(selectIsAuthenticated(store.getState())).toBe(false);

      // 3. Login again
      await store.dispatch(loginUser(credentials));

      expect(selectUser(store.getState())).toEqual(loginResponse.user);
      expect(selectIsAuthenticated(store.getState())).toBe(true);
    });
  });
});

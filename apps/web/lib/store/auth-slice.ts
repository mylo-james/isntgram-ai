import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { apiClient } from "../api-client";

// Types
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  profilePictureUrl?: string;
  bio?: string;
  postsCount?: number;
  followerCount?: number;
  followingCount?: number;
  createdAt?: string;
  updatedAt?: string;
  isDemoUser?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  followingUsernames: string[];
}

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  followingUsernames: [],
};

// Async thunks
export const registerUser = createAsyncThunk(
  "auth/register",
  async (
    userData: {
      email: string;
      username: string;
      fullName: string;
      password: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.register(userData);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Registration failed";
      return rejectWithValue(message);
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await apiClient.login(credentials);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      return rejectWithValue(message);
    }
  },
);

export const logoutUser = createAsyncThunk("auth/logout", async (_, { rejectWithValue }) => {
  try {
    await apiClient.logout();
    return null;
  } catch (error: unknown) {
    // Even if logout fails, clear local state
    const message = error instanceof Error ? error.message : "Logout failed";
    return rejectWithValue(message);
  }
});

export const getCurrentUser = createAsyncThunk("auth/getCurrentUser", async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.getCurrentUser();
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get user data";
    return rejectWithValue(message);
  }
});

// Auth slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setAccessToken: (_state, _action: PayloadAction<string>) => {
      // Deprecated: no-op retained for backward compatibility
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
      state.followingUsernames = [];
    },
    followUsername: (state, action: PayloadAction<string>) => {
      const username = action.payload;
      if (!state.followingUsernames.includes(username)) {
        state.followingUsernames.push(username);
      }
    },
    unfollowUsername: (state, action: PayloadAction<string>) => {
      const username = action.payload;
      state.followingUsernames = state.followingUsernames.filter((u) => u !== username);
    },
  },
  extraReducers: (builder) => {
    // Register user
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Login user
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Logout user
    builder
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
        state.followingUsernames = [];
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        // Even if logout fails, clear local state
        state.user = null;
        state.isAuthenticated = false;
        state.error = action.payload as string;
        state.followingUsernames = [];
      });

    // Get current user
    builder
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // If getting current user fails, user might not be authenticated
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

// Actions
export const { clearError, setUser, setAccessToken, clearAuth, followUsername, unfollowUsername } = authSlice.actions;

// Selectors
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectError = (state: { auth: AuthState }) => state.auth.error;
export const selectFollowingUsernames = (state: { auth: AuthState }) => state.auth.followingUsernames;
// Deprecated: access token is no longer stored client-side
export const selectAccessToken = () => null;

// Reducer
export default authSlice.reducer;

import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";

// Types for API requests and responses
export interface RegisterRequest {
  email: string;
  username: string;
  fullName: string;
  password: string;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
  };
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
  };
  accessToken: string;
}

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error: string;
  timestamp: string;
}

class ApiClient {
  private client: AxiosInstance;
  private bearerToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication headers
    this.client.interceptors.request.use(
      async (config) => {
        if (this.bearerToken) {
          config.headers = config.headers || {};
          (config.headers as Record<string, string>)["Authorization"] = `Bearer ${this.bearerToken}`;
        }
        return config;
      },
      (error) => {
        console.error("Request Error:", error);
        return Promise.reject(error);
      },
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError<ApiError>) => {
        console.error("Response Error:", {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data,
        });

        // Handle different error scenarios
        if (error.response) {
          // Server responded with error status
          const errorMessage = (error.response.data as unknown as { message?: string })?.message || "An error occurred";
          return Promise.reject(new Error(errorMessage));
        } else if (error.request) {
          // Network error
          return Promise.reject(new Error("Network error. Please check your connection."));
        } else {
          // Other error
          return Promise.reject(new Error("An unexpected error occurred."));
        }
      },
    );
  }

  setBearerToken(token: string | null): void {
    this.bearerToken = token || null;
  }

  // Registration endpoint
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await this.client.post<RegisterResponse>("/api/auth/register", data);
      return response.data;
    } catch (error) {
      // Re-throw the error to let the interceptor handle it
      throw error;
    }
  }

  // Login endpoint (for Auth.js integration)
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>("/api/auth/signin", data);
    return response.data;
  }

  // Get current user
  async getCurrentUser(): Promise<{ user: RegisterResponse["user"] }> {
    const response = await this.client.get<{ user: RegisterResponse["user"] }>("/api/auth/me");
    return response.data;
  }

  // Logout endpoint
  async logout(): Promise<{ message: string }> {
    const response = await this.client.post<{ message: string }>("/api/auth/signout");
    return response.data;
  }

  // Get user profile by username
  async getUserProfile(username: string): Promise<UserProfile> {
    const response = await this.client.get<UserProfile>(`/api/users/${username}`);
    return response.data;
  }

  // Get current user's profile by id or email
  async getMyProfile(params: { id?: string; email?: string }): Promise<UserProfile> {
    const search = params.id
      ? `id=${encodeURIComponent(params.id)}`
      : `email=${encodeURIComponent(params.email || "")}`;
    const response = await this.client.get<UserProfile>(`/api/users/me?${search}`);
    return response.data;
  }

  // Check if a username is available
  async checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
    const response = await this.client.get<{ available: boolean }>(
      `/api/users/check-username/${encodeURIComponent(username)}`,
    );
    return response.data;
  }

  // Update current user's profile
  async updateProfile(data: { id: string; fullName: string; username: string }): Promise<UserProfile> {
    const response = await this.client.put<UserProfile>("/api/users/profile", data);
    return response.data;
  }

  // Follow a user by username
  async followUser(username: string): Promise<void> {
    await this.client.post(`/api/users/${encodeURIComponent(username)}/follow`);
  }

  // Unfollow a user by username
  async unfollowUser(username: string): Promise<void> {
    await this.client.delete(`/api/users/${encodeURIComponent(username)}/follow`);
  }

  async isFollowing(username: string): Promise<{ isFollowing: boolean }> {
    const res = await this.client.get<{ isFollowing: boolean }>(
      `/api/users/${encodeURIComponent(username)}/is-following`,
    );
    return res.data;
  }

  // Set auth token (for manual token management)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setAuthToken(): void {}

  // Clear auth token
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  clearAuthToken(): void {}

  // Get auth token
  getAuthToken(): string | null {
    return null;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

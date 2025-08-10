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

export interface ApiError {
  message: string;
  statusCode: number;
  error: string;
  timestamp: string;
}

class ApiClient {
  private client: AxiosInstance;

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
      (config) => config,
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
          const errorMessage = error.response.data?.message || "An error occurred";
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

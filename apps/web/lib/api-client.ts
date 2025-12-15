import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import type { components } from "@/lib/generated/api";

// Types for API requests and responses
export type RegisterRequest = components["schemas"]["RegisterDto"];
export type RegisterResponse = components["schemas"]["RegisterResponseDto"];

export type LoginRequest = components["schemas"]["SignInDto"];
export type LoginResponse = components["schemas"]["SignInResponseDto"];

export type PublicUserProfile = components["schemas"]["PublicUserProfileDto"];
export type MyProfile = components["schemas"]["MyProfileDto"];

export type FeedPost = components["schemas"]["FeedPostDto"];
export type FeedResponse = components["schemas"]["FeedResponseDto"];

export type UserSummary = components["schemas"]["UserSummaryDto"];
export type SearchResponse = components["schemas"]["SearchResponseDto"];

export type LikeStateResponse = components["schemas"]["LikeStateResponseDto"];

export type CommentView = components["schemas"]["CommentViewDto"];
export type CommentsResponse = components["schemas"]["CommentsResponseDto"];

export type CaptionTone = NonNullable<components["schemas"]["CaptionSuggestionsDto"]["tone"]>;
export type CaptionSuggestionsResponse = components["schemas"]["CaptionSuggestionsResponseDto"];

export type MessageResponse = components["schemas"]["MessageResponseDto"];
export type UsernameAvailability = components["schemas"]["UsernameAvailabilityDto"];
export type IsFollowingResponse = components["schemas"]["IsFollowingResponseDto"];
export type FollowListResponse = components["schemas"]["FollowListResponseDto"];

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
    const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    const internalApiBaseUrl = process.env.INTERNAL_API_URL || publicApiBaseUrl;

    const nextAuthOrigin = (() => {
      const nextAuthUrl = process.env.NEXTAUTH_URL;
      if (!nextAuthUrl) return undefined;
      try {
        return new URL(nextAuthUrl).origin;
      } catch {
        return nextAuthUrl;
      }
    })();

    // In production we prefer same-origin API calls (relative URLs) to avoid
    // having to bake a hostname into the browser bundle.
    const baseURL =
      typeof window === "undefined"
        ? internalApiBaseUrl || nextAuthOrigin || "http://localhost:3001"
        : publicApiBaseUrl || "";

    this.client = axios.create({
      baseURL,
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
        return Promise.reject(error);
      },
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError<ApiError>) => {
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
    const response = await this.client.post<RegisterResponse>("/api/auth/register", data);
    return response.data;
  }

  // Login endpoint (for Auth.js integration)
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>("/api/auth/signin", data);
    return response.data;
  }

  // Logout endpoint
  async logout(): Promise<MessageResponse> {
    const response = await this.client.post<MessageResponse>("/api/auth/signout");
    return response.data;
  }

  // Get user profile by username
  async getUserProfile(username: string): Promise<PublicUserProfile> {
    const response = await this.client.get<PublicUserProfile>(`/api/users/${username}`);
    return response.data;
  }

  // Get current user's profile (identity derived from bearer token)
  async getMyProfile(): Promise<MyProfile> {
    const response = await this.client.get<MyProfile>("/api/users/me");
    return response.data;
  }

  // Check if a username is available
  async checkUsernameAvailability(username: string): Promise<UsernameAvailability> {
    const response = await this.client.get<UsernameAvailability>(
      `/api/users/check-username/${encodeURIComponent(username)}`,
    );
    return response.data;
  }

  // Update current user's profile
  async updateProfile(data: components["schemas"]["UpdateMyProfileDto"]): Promise<MyProfile> {
    const response = await this.client.put<MyProfile>("/api/users/profile", data);
    return response.data;
  }

  async getFeed(page = 1, limit = 10): Promise<FeedResponse> {
    const res = await this.client.get<FeedResponse>("/api/posts/feed", {
      params: { page, limit },
    });
    return res.data;
  }

  async getExplore(page = 1, limit = 12): Promise<FeedResponse> {
    const res = await this.client.get<FeedResponse>("/api/posts/explore", {
      params: { page, limit },
    });
    return res.data;
  }

  async createPost(content: string): Promise<FeedPost> {
    const res = await this.client.post<FeedPost>("/api/posts", { content });
    return res.data;
  }

  async getPostById(id: string): Promise<FeedPost> {
    const res = await this.client.get<FeedPost>(`/api/posts/${encodeURIComponent(id)}`);
    return res.data;
  }

  async getUserPosts(username: string, page = 1, limit = 12): Promise<FeedResponse> {
    const res = await this.client.get<FeedResponse>(`/api/posts/user/${encodeURIComponent(username)}`, {
      params: { page, limit },
    });
    return res.data;
  }

  async deletePost(id: string): Promise<MessageResponse> {
    const res = await this.client.delete<MessageResponse>(`/api/posts/${encodeURIComponent(id)}`);
    return res.data;
  }

  async likePost(postId: string): Promise<LikeStateResponse> {
    const res = await this.client.post<LikeStateResponse>(`/api/posts/${encodeURIComponent(postId)}/like`);
    return res.data;
  }

  async unlikePost(postId: string): Promise<LikeStateResponse> {
    const res = await this.client.delete<LikeStateResponse>(`/api/posts/${encodeURIComponent(postId)}/like`);
    return res.data;
  }

  async getComments(postId: string, page = 1, limit = 20): Promise<CommentsResponse> {
    const res = await this.client.get<CommentsResponse>(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      params: { page, limit },
    });
    return res.data;
  }

  async createComment(postId: string, text: string): Promise<CommentView> {
    const res = await this.client.post<CommentView>(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      text,
    });
    return res.data;
  }

  async deleteComment(postId: string, commentId: string): Promise<MessageResponse> {
    const res = await this.client.delete<MessageResponse>(
      `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    );
    return res.data;
  }

  async search(q: string, type: "all" | "users" | "posts" = "all", page = 1, limit = 10): Promise<SearchResponse> {
    const res = await this.client.get<SearchResponse>("/api/search", {
      params: { q, type, page, limit },
    });
    return res.data;
  }

  async suggestCaptions(
    prompt: string,
    tone: CaptionTone = "friendly",
    count = 3,
  ): Promise<CaptionSuggestionsResponse> {
    const res = await this.client.post<CaptionSuggestionsResponse>("/api/ai/captions", { prompt, tone, count });
    return res.data;
  }

  // Follow a user by username
  async followUser(username: string): Promise<void> {
    await this.client.post(`/api/users/${encodeURIComponent(username)}/follow`);
  }

  // Unfollow a user by username
  async unfollowUser(username: string): Promise<void> {
    await this.client.delete(`/api/users/${encodeURIComponent(username)}/follow`);
  }

  async isFollowing(username: string): Promise<IsFollowingResponse> {
    const res = await this.client.get<IsFollowingResponse>(`/api/users/${encodeURIComponent(username)}/is-following`);
    return res.data;
  }

  async getFollowers(username: string, page = 1, limit = 20): Promise<FollowListResponse> {
    const res = await this.client.get<FollowListResponse>(`/api/users/${encodeURIComponent(username)}/followers`, {
      params: { page, limit },
    });
    return res.data;
  }

  async getFollowing(username: string, page = 1, limit = 20): Promise<FollowListResponse> {
    const res = await this.client.get<FollowListResponse>(`/api/users/${encodeURIComponent(username)}/following`, {
      params: { page, limit },
    });
    return res.data;
  }

  // Back-compat token helpers (prefer `setBearerToken`)
  setAuthToken(token: string | null): void {
    this.setBearerToken(token);
  }

  clearAuthToken(): void {
    this.setBearerToken(null);
  }

  getAuthToken(): string | null {
    return this.bearerToken;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

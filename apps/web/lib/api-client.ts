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

export interface FollowRequest {
  userId: string;
}

export interface FollowResponse {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface FollowStatsResponse {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface CreatePostRequest {
  caption: string;
  imageUrl: string;
}

export interface PostResponse {
  id: string;
  userId: string;
  caption: string;
  imageUrl: string;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    username: string;
    fullName: string;
    profilePictureUrl?: string;
  };
}

export interface LikeRequest {
  postId: string;
}

export interface LikeResponse {
  id: string;
  userId: string;
  postId: string;
  createdAt: Date;
}

export interface LikeStatsResponse {
  likesCount: number;
  isLiked: boolean;
}

export interface CreateCommentRequest {
  postId: string;
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CommentResponse {
  id: string;
  userId: string;
  postId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    username: string;
    fullName: string;
    profilePictureUrl?: string;
  };
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

  // Follow user
  async followUser(userId: string): Promise<FollowResponse> {
    const response = await this.client.post<FollowResponse>("/api/follows", { userId });
    return response.data;
  }

  // Unfollow user
  async unfollowUser(userId: string): Promise<{ message: string }> {
    const response = await this.client.delete<{ message: string }>("/api/follows", {
      data: { userId },
    });
    return response.data;
  }

  // Get follow stats for a user
  async getFollowStats(userId: string): Promise<FollowStatsResponse> {
    const response = await this.client.get<FollowStatsResponse>(`/api/follows/stats/${userId}`);
    return response.data;
  }

  // Get followers list
  async getFollowers(userId: string): Promise<UserProfile[]> {
    const response = await this.client.get<UserProfile[]>(`/api/follows/followers/${userId}`);
    return response.data;
  }

  // Get following list
  async getFollowing(userId: string): Promise<UserProfile[]> {
    const response = await this.client.get<UserProfile[]>(`/api/follows/following/${userId}`);
    return response.data;
  }

  // Create a new post
  async createPost(data: CreatePostRequest): Promise<PostResponse> {
    const response = await this.client.post<PostResponse>("/api/posts", data);
    return response.data;
  }

  // Delete a post
  async deletePost(postId: string): Promise<{ message: string }> {
    const response = await this.client.delete<{ message: string }>(`/api/posts/${postId}`);
    return response.data;
  }

  // Get a single post
  async getPost(postId: string): Promise<PostResponse> {
    const response = await this.client.get<PostResponse>(`/api/posts/${postId}`);
    return response.data;
  }

  // Get user posts
  async getUserPosts(username: string, page = 1, limit = 12): Promise<PostResponse[]> {
    const response = await this.client.get<PostResponse[]>(`/api/posts/user/${username}?page=${page}&limit=${limit}`);
    return response.data;
  }

  // Get personalized feed
  async getFeed(page = 1, limit = 10): Promise<PostResponse[]> {
    const response = await this.client.get<PostResponse[]>(`/api/posts?page=${page}&limit=${limit}`);
    return response.data;
  }

  // Like a post
  async likePost(postId: string): Promise<LikeResponse> {
    const response = await this.client.post<LikeResponse>("/api/likes", { postId });
    return response.data;
  }

  // Unlike a post
  async unlikePost(postId: string): Promise<{ message: string }> {
    const response = await this.client.delete<{ message: string }>("/api/likes", { 
      data: { postId } 
    });
    return response.data;
  }

  // Get like stats for a post
  async getLikeStats(postId: string): Promise<LikeStatsResponse> {
    const response = await this.client.get<LikeStatsResponse>(`/api/likes/stats/${postId}`);
    return response.data;
  }

  // Get users who liked a post
  async getPostLikes(postId: string, page = 1, limit = 20): Promise<any[]> {
    const response = await this.client.get<any[]>(
      `/api/likes/post/${postId}?page=${page}&limit=${limit}`
    );
    return response.data;
  }

  // Create a comment
  async createComment(data: CreateCommentRequest): Promise<CommentResponse> {
    const response = await this.client.post<CommentResponse>("/api/comments", data);
    return response.data;
  }

  // Update a comment
  async updateComment(commentId: string, data: UpdateCommentRequest): Promise<CommentResponse> {
    const response = await this.client.put<CommentResponse>(`/api/comments/${commentId}`, data);
    return response.data;
  }

  // Delete a comment
  async deleteComment(commentId: string): Promise<{ message: string }> {
    const response = await this.client.delete<{ message: string }>(`/api/comments/${commentId}`);
    return response.data;
  }

  // Get a single comment
  async getComment(commentId: string): Promise<CommentResponse> {
    const response = await this.client.get<CommentResponse>(`/api/comments/${commentId}`);
    return response.data;
  }

  // Get comments for a post
  async getPostComments(postId: string, page = 1, limit = 20): Promise<CommentResponse[]> {
    const response = await this.client.get<CommentResponse[]>(
      `/api/comments/post/${postId}?page=${page}&limit=${limit}`
    );
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

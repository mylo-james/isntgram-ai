// Re-export auth types
export * from "./auth";
export * from "./test-utils";

// Post-related types
export interface Post {
  id: string;
  userId: string;
  caption?: string;
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

export interface CreatePostRequest {
  caption?: string;
  imageUrl: string;
}

export type PostResponse = Post;

// Comment-related types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentRequest {
  content: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

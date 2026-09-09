import type {
  ApiPaths,
  Comment,
  CommentsResponse,
  CommentLikeStatus,
  CreatePostRequest,
  CreateCommentRequest,
  CreateUploadUrlRequest,
  FeedResponse,
  FollowStatus,
  NotificationsResponse,
  PostLikeStatus,
  PostItem,
  PrivateUserProfile,
  PublicUserProfile,
  RegisterRequest,
  RegisterResponse,
  UserSearchItem,
  UserSearchResponse,
  AuthLogoutResponse,
  UploadUrlResponse,
} from "@isntgram-ai/shared-types";

import createClient from "openapi-fetch";
import { ApiRequestError, getApiErrorMessage } from "./api-error";
import { CSRF_HEADER_NAME, getCsrfTokenFromCookie, isStateChangingMethod } from "./csrf";

type BffPaths = {
  [K in keyof ApiPaths as K extends "/api" ? never : K extends `/api${infer Rest}` ? Rest : never]: ApiPaths[K];
};

const csrfFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const request = input instanceof Request ? (init ? new Request(input, init) : input) : new Request(input, init);
  const method = request.method || (init?.method ?? "GET");
  if (!isStateChangingMethod(method)) {
    return fetch(request);
  }

  const csrfToken = getCsrfTokenFromCookie();
  if (!csrfToken) {
    return fetch(request);
  }

  const headers = new Headers(request.headers);
  headers.set(CSRF_HEADER_NAME, csrfToken);
  return fetch(new Request(request, { headers }));
};

const client = createClient<BffPaths>({
  baseUrl: "/api/bff",
  // Allow tests to swap `global.fetch` after module import.
  fetch: csrfFetch as unknown as (input: Request) => Promise<Response>,
});

async function unwrap<T>(result: Promise<unknown>): Promise<T> {
  const { data, error, response } = (await result) as {
    data?: T;
    error?: unknown;
    response: Response;
  };

  if (!response.ok) {
    throw new ApiRequestError(getApiErrorMessage(error), response.status);
  }

  // openapi-fetch only provides `data` for 2xx responses.
  return data as T;
}

export const apiClient = {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return unwrap<RegisterResponse>(
      client.POST("/auth/register", {
        body: data,
      }),
    );
  },

  async getUserProfile(username: string): Promise<PublicUserProfile> {
    return unwrap<PublicUserProfile>(
      client.GET("/users/{username}", {
        params: {
          path: { username },
        },
      }),
    );
  },

  async getMyProfile(): Promise<PrivateUserProfile> {
    return unwrap<PrivateUserProfile>(client.GET("/users/me"));
  },

  async checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
    return unwrap<{ available: boolean }>(
      client.GET("/users/check-username/{username}", {
        params: {
          path: { username },
        },
      }),
    );
  },

  async updateProfile(data: {
    fullName: string;
    username: string;
    profilePictureUploadId?: string;
  }): Promise<PrivateUserProfile> {
    return unwrap<PrivateUserProfile>(
      client.PUT("/users/profile", {
        body: data,
      }),
    );
  },

  async getFeed(params?: { cursor?: string; limit?: number }): Promise<FeedResponse> {
    return unwrap<FeedResponse>(
      client.GET("/posts/feed", {
        params: {
          query: {
            cursor: params?.cursor,
            limit: params?.limit,
          },
        },
      }),
    );
  },

  async getExplore(params?: { cursor?: string; limit?: number }): Promise<FeedResponse> {
    return unwrap<FeedResponse>(
      client.GET("/posts/explore", {
        params: {
          query: {
            cursor: params?.cursor,
            limit: params?.limit,
          },
        },
      }),
    );
  },

  async getUserPosts(username: string, params?: { cursor?: string; limit?: number }): Promise<FeedResponse> {
    return unwrap<FeedResponse>(
      client.GET("/posts/user/{username}", {
        params: {
          path: { username },
          query: {
            cursor: params?.cursor,
            limit: params?.limit,
          },
        },
      }),
    );
  },

  async searchUsers(params: { q: string; limit?: number }): Promise<UserSearchResponse> {
    return unwrap<UserSearchResponse>(
      client.GET("/users/search", {
        params: {
          query: {
            q: params.q,
            limit: params.limit,
          },
        },
      }),
    );
  },

  async createPost(data: CreatePostRequest, options?: { signal?: AbortSignal }): Promise<PostItem> {
    return unwrap<PostItem>(
      client.POST("/posts", {
        body: data,
        signal: options?.signal,
      }),
    );
  },

  async likePost(postId: string): Promise<PostLikeStatus> {
    return unwrap<PostLikeStatus>(
      client.POST("/posts/{postId}/like", {
        params: { path: { postId } },
      }),
    );
  },

  async unlikePost(postId: string): Promise<PostLikeStatus> {
    return unwrap<PostLikeStatus>(
      client.DELETE("/posts/{postId}/like", {
        params: { path: { postId } },
      }),
    );
  },

  async getComments(postId: string, params?: { cursor?: string; limit?: number }): Promise<CommentsResponse> {
    return unwrap<CommentsResponse>(
      client.GET("/posts/{postId}/comments", {
        params: {
          path: { postId },
          query: {
            cursor: params?.cursor,
            limit: params?.limit,
          },
        },
      }),
    );
  },

  async createComment(postId: string, data: CreateCommentRequest): Promise<Comment> {
    return unwrap<Comment>(
      client.POST("/posts/{postId}/comments", {
        params: { path: { postId } },
        body: data,
      }),
    );
  },

  async likeComment(postId: string, commentId: string): Promise<CommentLikeStatus> {
    return unwrap<CommentLikeStatus>(
      client.POST("/posts/{postId}/comments/{commentId}/like", {
        params: { path: { postId, commentId } },
      }),
    );
  },

  async unlikeComment(postId: string, commentId: string): Promise<CommentLikeStatus> {
    return unwrap<CommentLikeStatus>(
      client.DELETE("/posts/{postId}/comments/{commentId}/like", {
        params: { path: { postId, commentId } },
      }),
    );
  },

  async logout(): Promise<AuthLogoutResponse> {
    return unwrap<AuthLogoutResponse>(client.POST("/auth/logout"));
  },

  async getFollowStatus(username: string): Promise<FollowStatus> {
    return unwrap<FollowStatus>(
      client.GET("/follows/{username}/status", {
        params: {
          path: { username },
        },
      }),
    );
  },

  async followUser(username: string): Promise<FollowStatus> {
    return unwrap<FollowStatus>(
      client.POST("/follows/{username}", {
        params: {
          path: { username },
        },
      }),
    );
  },

  async unfollowUser(username: string): Promise<FollowStatus> {
    return unwrap<FollowStatus>(
      client.DELETE("/follows/{username}", {
        params: {
          path: { username },
        },
      }),
    );
  },

  async createUploadUrl(data: CreateUploadUrlRequest): Promise<UploadUrlResponse> {
    return unwrap<UploadUrlResponse>(
      client.POST("/media/presign", {
        body: data,
      }),
    );
  },

  async getNotifications(params?: { cursor?: string; limit?: number }): Promise<NotificationsResponse> {
    return unwrap<NotificationsResponse>(
      client.GET("/notifications", {
        params: {
          query: {
            cursor: params?.cursor,
            limit: params?.limit,
          },
        },
      }),
    );
  },
};
export type {
  PublicUserProfile,
  PrivateUserProfile,
  FeedResponse,
  PostItem,
  PostLikeStatus,
  Comment,
  CommentsResponse,
  CommentLikeStatus,
  FollowStatus,
  UserSearchItem,
  UserSearchResponse,
  UploadUrlResponse,
  AuthLogoutResponse,
};

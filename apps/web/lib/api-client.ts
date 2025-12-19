import type {
  AiRewriteRequest,
  AiRewriteResponse,
  ApiPaths,
  CreatePostRequest,
  CreateUploadUrlRequest,
  FeedResponse,
  FollowStatus,
  PostItem,
  PrivateUserProfile,
  PublicUserProfile,
  RegisterRequest,
  RegisterResponse,
  UploadUrlResponse,
} from "@isntgram-ai/shared-types";

import createClient from "openapi-fetch";
import { getApiErrorMessage } from "./api-error";

type BffPaths = {
  [K in keyof ApiPaths as K extends "/api" ? never : K extends `/api${infer Rest}` ? Rest : never]: ApiPaths[K];
};

const client = createClient<BffPaths>({
  baseUrl: "/api/bff",
  // Allow tests to swap `global.fetch` after module import.
  fetch: (request) => fetch(request),
});

async function unwrap<T>(result: Promise<unknown>): Promise<T> {
  const { data, error, response } = (await result) as {
    data?: T;
    error?: unknown;
    response: Response;
  };

  if (!response.ok) {
    throw new Error(getApiErrorMessage(error));
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

  async updateProfile(data: { fullName: string; username: string }): Promise<PrivateUserProfile> {
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

  async createPost(data: CreatePostRequest): Promise<PostItem> {
    return unwrap<PostItem>(
      client.POST("/posts", {
        body: data,
      }),
    );
  },

  async rewritePost(data: AiRewriteRequest): Promise<AiRewriteResponse> {
    return unwrap<AiRewriteResponse>(
      client.POST("/ai/rewrite", {
        body: data,
      }),
    );
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
};
export type {
  AiRewriteRequest,
  AiRewriteResponse,
  PublicUserProfile,
  PrivateUserProfile,
  FeedResponse,
  PostItem,
  FollowStatus,
  UploadUrlResponse,
};

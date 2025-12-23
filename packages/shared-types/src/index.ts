// Generated API contract types.
//
// Source of truth: `apps/api/openapi.json` (generated from the NestJS Swagger document).
// Generate/update via:
// - `pnpm run contracts:generate`

import type { components, paths } from "./openapi";

type Schemas = components["schemas"];

export type ApiPaths = paths;
export type ApiSchemas = Schemas;

export type PublicUserProfile = Schemas["PublicUserProfileDto"];
export type PrivateUserProfile = Schemas["PrivateUserProfileDto"];

export type RegisterRequest = Schemas["RegisterDto"];
export type RegisterResponse = Schemas["AuthRegisterResponseDto"];
export type LoginRequest = Schemas["LoginDto"];
export type LoginResponse = Schemas["AuthLoginResponseDto"];
export type AuthLogoutResponse = Schemas["AuthLogoutResponseDto"];

export type PostAuthor = Schemas["PostAuthorDto"];
export type PostItem = Schemas["PostDto"];
export type FeedResponse = Schemas["FeedResponseDto"];
export type CreatePostRequest = Schemas["CreatePostDto"];
export type PostLikeStatus = Schemas["PostLikeStatusDto"];
export type CreateCommentRequest = Schemas["CreateCommentDto"];
export type Comment = Schemas["CommentDto"];
export type CommentsResponse = Schemas["CommentsResponseDto"];
export type CommentLikeStatus = Schemas["CommentLikeStatusDto"];

export type NotificationActor = Schemas["NotificationActorDto"];
export type NotificationItem = Schemas["NotificationDto"];
export type NotificationsResponse = Schemas["NotificationsResponseDto"];

export type AiRewriteRequest = Schemas["AiRewriteRequestDto"];
export type AiRewriteResponse = Schemas["AiRewriteResponseDto"];
export type AiRewriteTone = NonNullable<AiRewriteRequest["tone"]>;

export type FollowStatus = Schemas["FollowStatusDto"];

export type UserSearchItem = Schemas["UserSearchItemDto"];
export type UserSearchResponse = Schemas["UserSearchResponseDto"];

export type CreateUploadUrlRequest = Schemas["CreateUploadUrlDto"];
export type UploadUrlResponse = Schemas["UploadUrlDto"];

export type ApiError = Schemas["ApiErrorDto"];

"use server";

import { auth } from "@/lib/auth";
import type { AppSession } from "@/lib/auth";
import type { FeedPost } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api-base-url";

export type CreatePostState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; post: FeedPost };

export async function createPostAction(_prev: CreatePostState, formData: FormData): Promise<CreatePostState> {
  const content = String(formData.get("content") ?? "").trim();
  if (content.length === 0) return { status: "error", message: "Post content is required" };

  const session = (await auth()) as AppSession | null;
  const accessToken = session?.accessToken;
  if (!accessToken) return { status: "error", message: "You must be signed in to post" };

  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/posts`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({}))
      .then((body: unknown) => (body as { message?: string })?.message);

    return { status: "error", message: message || `Failed to create post (${response.status})` };
  }

  const post = (await response.json()) as FeedPost;
  return { status: "success", post };
}

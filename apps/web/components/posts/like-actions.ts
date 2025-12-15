"use server";

import { auth, type AppSession } from "@/lib/auth";
import type { LikeStateResponse } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { revalidatePath } from "next/cache";

export async function setPostLikeAction(postId: string, shouldLike: boolean): Promise<LikeStateResponse> {
  if (!postId) {
    throw new Error("Post ID is required");
  }

  const session = (await auth()) as AppSession | null;
  const accessToken = session?.accessToken;
  if (!accessToken) {
    throw new Error("You must be signed in to like posts");
  }

  const apiBaseUrl = getApiBaseUrl();
  const url = new URL(`/api/posts/${encodeURIComponent(postId)}/like`, apiBaseUrl);
  const response = await fetch(url.toString(), {
    method: shouldLike ? "POST" : "DELETE",
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({}))
      .then((body: unknown) => (body as { message?: string })?.message);

    throw new Error(message || `Failed to update like (${response.status})`);
  }

  const result = (await response.json()) as LikeStateResponse;
  revalidatePath("/feed");
  revalidatePath(`/posts/${postId}`);
  return result;
}

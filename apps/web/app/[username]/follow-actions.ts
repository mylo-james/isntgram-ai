"use server";

import { auth, type AppSession } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { redirect } from "next/navigation";

async function requireAccessToken(): Promise<string> {
  const session = (await auth()) as AppSession | null;
  const accessToken = session?.accessToken;
  if (!accessToken) redirect("/login");
  return accessToken;
}

async function setFollow(username: string, shouldFollow: boolean): Promise<void> {
  const accessToken = await requireAccessToken();
  const apiBaseUrl = getApiBaseUrl();

  const url = new URL(`/api/users/${encodeURIComponent(username)}/follow`, apiBaseUrl);
  const res = await fetch(url.toString(), {
    method: shouldFollow ? "POST" : "DELETE",
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.ok) return;

  const message = await res
    .json()
    .catch(() => ({}))
    .then((body: unknown) => (body as { message?: string })?.message);

  throw new Error(message || `Failed to ${shouldFollow ? "follow" : "unfollow"} (${res.status})`);
}

export async function followUserAction(username: string): Promise<void> {
  await setFollow(username, true);
  redirect(`/${username}`);
}

export async function unfollowUserAction(username: string): Promise<void> {
  await setFollow(username, false);
  redirect(`/${username}`);
}

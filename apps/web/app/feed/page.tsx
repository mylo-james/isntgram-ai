import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FeedClient from "./FeedClient";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import type { FeedResponse } from "@/lib/api-client";

export default async function FeedPage() {
  const session = await auth();
  const accessToken = await getApiAccessToken();
  const requestId = await getRequestId();

  if (!session?.user?.id || !accessToken) {
    redirect("/login");
  }

  let initialFeed: FeedResponse = { items: [] };
  const { data, response } = await internalApi.GET("/api/posts/feed", {
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  if (response.ok && data) {
    initialFeed = data as FeedResponse;
  }

  return <FeedClient initialFeed={initialFeed} isDemoUser={session?.user?.isDemoUser} />;
}

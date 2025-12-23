import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FeedClient from "./FeedClient";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import type { FeedResponse } from "@/lib/api-client";
import LegacyNav from "@/components/legacy/LegacyNav";

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

  const me = await internalApi.GET("/api/users/me", {
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });
  const avatarSrc = me.data?.profilePictureUrl ?? "/assets/profile.jpeg";
  const profileHref = session.user.username ? `/${session.user.username}` : "/feed";

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main className="min-h-screen bg-[#fafafa]" style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 54px)" }}>
        <FeedClient initialFeed={initialFeed} />
      </main>
    </>
  );
}

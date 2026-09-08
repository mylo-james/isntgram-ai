import LegacyNav from "@/components/legacy/LegacyNav";
import { auth } from "@/lib/auth";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import { redirect } from "next/navigation";
import ExploreClient from "./ExploreClient";
import type { FeedResponse } from "@/lib/api-client";

export default async function ExplorePage() {
  const session = await auth();
  const accessToken = await getApiAccessToken();
  const requestId = await getRequestId();
  if (!session?.user?.id || !accessToken) redirect(session?.user?.id ? "/login?reauth=1" : "/login");
  const headers = { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId };

  const [{ data: me, response: meResponse }, { data: explore, response: exploreResponse }] = await Promise.all([
    internalApi.GET("/api/users/me", { headers, cache: "no-store" }),
    internalApi.GET("/api/posts/explore", { headers, cache: "no-store" }),
  ]);

  const avatarSrc = me?.profilePictureUrl ?? "/assets/default-avatar.svg";
  const profileHref =
    meResponse.ok && typeof me?.username === "string" && me.username.length > 0 ? `/${me.username}` : "/feed";

  if (exploreResponse.status === 401) redirect(session?.user?.id ? "/login?reauth=1" : "/login");
  if (!exploreResponse.ok || !explore) throw new Error("Explore unavailable");
  const initialExplore = (explore ?? { items: [] }) as FeedResponse;

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main
        id="main-content"
        tabIndex={-1}
        className="social-page min-h-screen bg-[#fafafa]"
        style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 72px)" }}
      >
        <ExploreClient initialItems={initialExplore.items ?? []} initialCursor={initialExplore.nextCursor} />
      </main>
    </>
  );
}

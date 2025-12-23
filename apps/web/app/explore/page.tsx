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
  if (!session?.user?.id || !accessToken) redirect("/login");

  return (
    <>
      <ExploreAuthedPage
        accessToken={accessToken}
        requestId={requestId}
        profileUsername={session.user.username ?? null}
      />
    </>
  );
}

async function ExploreAuthedPage({
  accessToken,
  requestId,
  profileUsername,
}: {
  accessToken: string;
  requestId: string;
  profileUsername: string | null;
}) {
  const headers = { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId };

  const [{ data: me }, { data: explore }] = await Promise.all([
    internalApi.GET("/api/users/me", { headers, cache: "no-store" }),
    internalApi.GET("/api/posts/explore", { headers, cache: "no-store" }),
  ]);

  const avatarSrc = me?.profilePictureUrl ?? "/assets/profile.jpeg";
  const profileHref = profileUsername ? `/${profileUsername}` : "/feed";

  const initialExplore = (explore ?? { items: [] }) as FeedResponse;

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main className="min-h-screen bg-[#fafafa]" style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 54px)" }}>
        <ExploreClient initialItems={initialExplore.items ?? []} initialCursor={initialExplore.nextCursor} />
      </main>
    </>
  );
}

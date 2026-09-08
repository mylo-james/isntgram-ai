import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import type { FeedResponse, PublicUserProfile } from "@/lib/api-client";
import LegacyNav from "@/components/legacy/LegacyNav";
import ProfilePage from "./ProfilePage";

type UserProfilePageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const resolvedParams = await Promise.resolve(params);
  const { username } = resolvedParams ?? {};
  if (typeof username !== "string") {
    notFound();
  }
  const normalizedUsername = username.trim().toLowerCase();

  if (normalizedUsername.length === 0) {
    notFound();
  }

  const session = await auth();
  const requestId = await getRequestId();
  const accessToken = await getApiAccessToken();

  // Match legacy parity: profile pages require auth.
  if (!session?.user?.id || !accessToken) {
    redirect("/login");
  }

  const viewerHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "x-request-id": requestId,
  };

  const [{ data: profileData, response: profileResponse }, { data: postsData, response: postsResponse }] =
    await Promise.all([
      internalApi.GET("/api/users/{username}", {
        params: { path: { username: normalizedUsername } },
        headers: viewerHeaders,
        cache: "no-store",
      }),
      internalApi.GET("/api/posts/user/{username}", {
        params: { path: { username: normalizedUsername } },
        headers: viewerHeaders,
        cache: "no-store",
      }),
    ]);

  if (profileResponse.status === 401 || postsResponse.status === 401) redirect("/login");
  if (profileResponse.status === 404) notFound();
  if (!profileResponse.ok || !profileData) throw new Error("Profile unavailable");

  const initialFeed = (postsData ?? { items: [] }) as FeedResponse;

  let initialIsFollowing: boolean | null = null;
  const { data: followData } = await internalApi.GET("/api/follows/{username}/status", {
    params: { path: { username: normalizedUsername } },
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });
  if (followData && typeof followData.isFollowing === "boolean") {
    initialIsFollowing = followData.isFollowing;
  }

  const { data: me, response: meResponse } = await internalApi.GET("/api/users/me", {
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });
  const avatarSrc = me?.profilePictureUrl ?? "/assets/default-avatar.svg";
  const profileHref =
    meResponse.ok && typeof me?.username === "string" && me.username.length > 0 ? `/${me.username}` : "/feed";
  const nav: ReactNode = <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />;

  return (
    <>
      {nav}
      <main
        id="main-content"
        tabIndex={-1}
        className="social-page min-h-screen bg-[#fafafa]"
        style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 72px)" }}
      >
        <ProfilePage
          username={normalizedUsername}
          currentUser={session?.user}
          initialProfile={profileData as PublicUserProfile}
          initialPosts={initialFeed.items}
          initialPostsError={!postsResponse.ok}
          initialCursor={initialFeed.nextCursor}
          initialIsFollowing={initialIsFollowing}
        />
      </main>
    </>
  );
}

export async function generateMetadata({ params }: UserProfilePageProps) {
  const resolvedParams = await Promise.resolve(params);
  const { username } = resolvedParams ?? {};
  const normalizedUsername = typeof username === "string" ? username.trim().toLowerCase() : "profile";

  return {
    title: `${normalizedUsername} - Profile | Isntgram`,
    description: `View ${normalizedUsername}'s profile on Isntgram`,
  };
}

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import type { FeedResponse, PublicUserProfile } from "@/lib/api-client";
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

  const [{ data: profileData, response: profileResponse }, { data: postsData }] = await Promise.all([
    internalApi.GET("/api/users/{username}", {
      params: { path: { username: normalizedUsername } },
      headers: { "x-request-id": requestId },
      cache: "no-store",
    }),
    internalApi.GET("/api/posts/user/{username}", {
      params: { path: { username: normalizedUsername } },
      headers: { "x-request-id": requestId },
      cache: "no-store",
    }),
  ]);

  if (!profileResponse.ok || !profileData) {
    notFound();
  }

  const initialFeed = (postsData ?? { items: [] }) as FeedResponse;

  let initialIsFollowing: boolean | null = null;
  if (session?.user?.id) {
    const accessToken = await getApiAccessToken();
    if (accessToken) {
      const { data: followData } = await internalApi.GET("/api/follows/{username}/status", {
        params: { path: { username: normalizedUsername } },
        headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
        cache: "no-store",
      });
      if (followData && typeof followData.isFollowing === "boolean") {
        initialIsFollowing = followData.isFollowing;
      }
    }
  }

  return (
    <ProfilePage
      username={normalizedUsername}
      currentUser={session?.user}
      initialProfile={profileData as PublicUserProfile}
      initialPosts={initialFeed.items}
      initialCursor={initialFeed.nextCursor}
      initialIsFollowing={initialIsFollowing}
    />
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

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { type Session } from "next-auth";
import { getApiBaseUrl } from "@/lib/api-base-url";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string };
};

import ProfilePage from "./ProfilePage";
import type { UserProfile } from "./ProfilePage";

interface ProfilePageProps {
  params: Promise<{
    username: string;
  }>;
}

export default async function UserProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  // Validate username parameter
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    notFound();
  }

  const isVisualTestMode = process.env.VISUAL_TEST_MODE === "true";
  if (isVisualTestMode) {
    const fakeUser = { id: "1", username, email: "visual@example.com" } as AppSession["user"];
    return <ProfilePage username={username} currentUser={fakeUser} initialIsFollowing={false} />;
  }

  // Get current user session for authentication checks
  const session = await auth();

  const apiBaseUrl = getApiBaseUrl();
  const profileRes = await fetch(`${apiBaseUrl}/api/users/${encodeURIComponent(username)}`, {
    cache: "no-store",
  });

  if (profileRes.status === 404) {
    notFound();
  }

  if (!profileRes.ok) {
    throw new Error(`Failed to load profile (${profileRes.status})`);
  }

  const initialProfile = (await profileRes.json()) as UserProfile;

  const accessToken = (session as unknown as { accessToken?: string } | null)?.accessToken || null;
  const initialIsFollowing = await (async () => {
    if (!accessToken) return false;
    const res = await fetch(`${apiBaseUrl}/api/users/${encodeURIComponent(username)}/is-following`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { isFollowing?: boolean };
    return Boolean(data.isFollowing);
  })();

  return (
    <ProfilePage
      username={username}
      currentUser={session?.user as AppSession["user"]}
      initialProfile={initialProfile}
      initialIsFollowing={initialIsFollowing}
    />
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: ProfilePageProps) {
  const { username } = await params;

  return {
    title: `${username} - Profile | Isntgram`,
    description: `View ${username}'s profile on Isntgram`,
  };
}

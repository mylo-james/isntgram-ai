import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { type Session } from "next-auth";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string };
};

import ProfilePage from "./ProfilePage";
import ProfilePageSkeleton from "./ProfilePageSkeleton";

interface ProfilePageProps {
  params: {
    username: string;
  };
}

export default async function UserProfilePage({ params }: ProfilePageProps) {
  const { username } = params;

  // Validate username parameter
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    notFound();
  }

  // Get current user session for authentication checks
  const session = await auth();

  return (
    <Suspense fallback={<ProfilePageSkeleton />}>
      <ProfilePage username={username} currentUser={session?.user as AppSession["user"]} />
    </Suspense>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: ProfilePageProps) {
  const { username } = params;

  return {
    title: `${username} - Profile | Isntgram`,
    description: `View ${username}'s profile on Isntgram`,
  };
}

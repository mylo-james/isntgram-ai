"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string };
};
import { apiClient } from "@/lib/api-client";
import ProfileHeader from "./components/ProfileHeader";
import ProfileActions from "./components/ProfileActions";
import ProfileStats from "./components/ProfileStats";
import ProfilePageSkeleton from "./ProfilePageSkeleton";
import ErrorBoundary from "@/components/common/ErrorBoundary";

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl?: string;
  bio?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfilePageProps {
  username: string;
  currentUser?: AppSession["user"] | null;
}

export default function ProfilePage({ username, currentUser }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const profileData = await apiClient.getUserProfile(username);
        setProfile(profileData);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const handleProfileUpdated = (updated: { fullName: string; username: string }) => {
    setProfile((prev) => (prev ? { ...prev, fullName: updated.fullName, username: updated.username } : prev));
  };

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h1>
          <p className="text-gray-600 mb-6">The user &quot;{username}&quot; could not be found.</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h1>
          <p className="text-gray-600 mb-6">The user &quot;{username}&quot; could not be found.</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <ProfileHeader profile={profile} />
          <ProfileStats profile={profile} />
          <ProfileActions
            profile={profile}
            currentUser={currentUser}
            isOwnProfile={isOwnProfile}
            onProfileUpdated={handleProfileUpdated}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}

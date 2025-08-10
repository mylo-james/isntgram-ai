"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string };
};

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

interface ProfileActionsProps {
  profile: UserProfile;
  currentUser?: AppSession["user"] | null;
  isOwnProfile: boolean;
}

export default function ProfileActions({ profile, currentUser, isOwnProfile }: ProfileActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleEditProfile = () => {
    router.push(`/${profile.username}/edit`);
  };

  const handleFollow = async () => {
    if (!currentUser) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement follow functionality in Epic 2
      console.log("Follow functionality will be implemented in Epic 2");
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <button
          onClick={() => router.push("/login")}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Log in to interact
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {isOwnProfile ? (
        <button
          onClick={handleEditProfile}
          className="w-full px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
        >
          Edit Profile
        </button>
      ) : (
        <button
          onClick={handleFollow}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? "Following..." : "Follow"}
        </button>
      )}
    </div>
  );
}

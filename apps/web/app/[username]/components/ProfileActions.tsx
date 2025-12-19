"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";
import EditProfileModal from "@/components/profile/EditProfileModal";
import SignOutButton from "@/components/auth/SignOutButton";
import { apiClient, PublicUserProfile } from "@/lib/api-client";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string; isDemoUser?: boolean };
};

interface ProfileActionsProps {
  profile: PublicUserProfile;
  currentUser?: AppSession["user"] | null;
  isOwnProfile: boolean;
  onProfileUpdated?: (profile: { fullName: string; username: string }) => void;
  isFollowing?: boolean | null;
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function ProfileActions({
  profile,
  currentUser,
  isOwnProfile,
  onProfileUpdated,
  isFollowing,
  onFollowChange,
}: ProfileActionsProps) {
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState({ fullName: profile.fullName, username: profile.username });
  const router = useRouter();
  const isDemoUser = Boolean(currentUser?.isDemoUser);

  const handleEditProfile = async () => {
    // Refresh initial values from backend for own profile
    try {
      if (currentUser?.id) {
        const me = await apiClient.getMyProfile();
        setEditInitial({ fullName: me.fullName, username: me.username });
      }
    } catch {
      // If fetch fails, keep existing initial values
      setEditInitial({ fullName: profile.fullName, username: profile.username });
    } finally {
      setIsEditOpen(true);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (isDemoUser) return;

    setIsFollowLoading(true);
    try {
      const response = isFollowing
        ? await apiClient.unfollowUser(profile.username)
        : await apiClient.followUser(profile.username);
      onFollowChange?.(response.isFollowing);
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const checkUsername = async (username: string) => {
    const res = await apiClient.checkUsernameAvailability(username);
    return res.available || username === profile.username; // allow unchanged
  };

  const submitEdit = async (values: { fullName: string; username: string }) => {
    if (!currentUser?.id || isDemoUser) return;
    const updated = await apiClient.updateProfile({
      fullName: values.fullName,
      username: values.username,
    });
    setIsEditOpen(false);
    onProfileUpdated?.({ fullName: updated.fullName, username: updated.username });
    router.refresh();
    if (updated.username !== profile.username) {
      router.push(`/${updated.username}`);
    }
  };

  if (!currentUser) {
    return (
      <div className="mt-6">
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
    <div className="mt-6">
      {isOwnProfile ? (
        <>
          <button
            onClick={handleEditProfile}
            className="w-full px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium disabled:bg-gray-500 disabled:cursor-not-allowed"
            disabled={isDemoUser}
            title={isDemoUser ? "Demo mode: editing disabled" : undefined}
          >
            Edit Profile
          </button>
          <SignOutButton className="w-full" />
          <EditProfileModal
            open={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            initialValues={editInitial}
            checkUsername={checkUsername}
            onSubmit={submitEdit}
            isDemoUser={isDemoUser}
          />
        </>
      ) : (
        <button
          onClick={handleFollowToggle}
          disabled={isFollowLoading || isDemoUser}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
          title={isDemoUser ? "Demo mode: following disabled" : undefined}
        >
          {isFollowLoading
            ? "Updating..."
            : isFollowing
              ? "Unfollow"
              : "Follow"}
        </button>
      )}
    </div>
  );
}

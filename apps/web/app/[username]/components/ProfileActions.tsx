"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { apiClient } from "@/lib/api-client";
import { useDispatch } from "react-redux";
import { setUser } from "@/lib/store/auth-slice";

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
  onProfileUpdated?: (profile: { fullName: string; username: string }) => void;
}

export default function ProfileActions({ profile, currentUser, isOwnProfile, onProfileUpdated }: ProfileActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState({ fullName: profile.fullName, username: profile.username });
  const router = useRouter();
  const dispatch = useDispatch();

  const handleEditProfile = async () => {
    // Refresh initial values from backend for own profile
    try {
      if (currentUser?.id) {
        const me = await apiClient.getMyProfile({ id: currentUser.id });
        setEditInitial({ fullName: me.fullName, username: me.username });
      }
    } catch {
      // If fetch fails, keep existing initial values
      setEditInitial({ fullName: profile.fullName, username: profile.username });
    } finally {
      setIsEditOpen(true);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Follow functionality will be implemented in Epic 2");
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkUsername = async (username: string) => {
    const res = await apiClient.checkUsernameAvailability(username);
    return res.available || username === profile.username; // allow unchanged
  };

  const submitEdit = async (values: { fullName: string; username: string }) => {
    if (!currentUser?.id) return;
    const updated = await apiClient.updateProfile({
      id: currentUser.id,
      fullName: values.fullName,
      username: values.username,
    });
    setIsEditOpen(false);
    onProfileUpdated?.({ fullName: updated.fullName, username: updated.username });
    // Update Redux store
    dispatch(
      setUser({
        id: currentUser.id,
        email: currentUser.email || "",
        username: updated.username,
        fullName: updated.fullName,
      }),
    );
    if (updated.username !== profile.username) {
      router.push(`/${updated.username}`);
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
        <>
          <button
            onClick={handleEditProfile}
            className="w-full px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
          >
            Edit Profile
          </button>
          <EditProfileModal
            open={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            initialValues={editInitial}
            checkUsername={checkUsername}
            onSubmit={submitEdit}
          />
        </>
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

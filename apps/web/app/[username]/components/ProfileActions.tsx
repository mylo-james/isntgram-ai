"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";
import EditProfileModal from "@/components/profile/EditProfileModal";
import SignOutButton from "@/components/auth/SignOutButton";
import { apiClient } from "@/lib/api-client";
import { useDispatch } from "react-redux";
import { setUser, followUsername, unfollowUsername } from "@/lib/store/auth-slice";
import FollowButton from "@/components/profile/FollowButton";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string; isDemoUser?: boolean };
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
  // Note: loading state currently not used; follow/unfollow button manages its own loading
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState({ fullName: profile.fullName, username: profile.username });
  const [isFollowing, setIsFollowing] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();

  const isDemoUser = Boolean(currentUser?.isDemoUser);

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
    // optimistic update
    setIsFollowing(true);
    dispatch(followUsername(profile.username));
    try {
      await apiClient.followUser(profile.username);
    } catch (e) {
      // rollback
      setIsFollowing(false);
      dispatch(unfollowUsername(profile.username));
      throw e;
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    // optimistic update
    setIsFollowing(false);
    dispatch(unfollowUsername(profile.username));
    try {
      await apiClient.unfollowUser(profile.username);
    } catch (e) {
      // rollback
      setIsFollowing(true);
      dispatch(followUsername(profile.username));
      throw e;
    }
  };

  // Fetch initial follow status when logged in
  useEffect(() => {
    const fetchStatus = async () => {
      if (currentUser) {
        try {
          const res = await apiClient.isFollowing(profile.username);
          setIsFollowing(res.isFollowing);
        } catch {
          setIsFollowing(false);
        }
      } else {
        setIsFollowing(false);
      }
    };
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, profile.username]);

  const checkUsername = async (username: string) => {
    const res = await apiClient.checkUsernameAvailability(username);
    return res.available || username === profile.username; // allow unchanged
  };

  const submitEdit = async (values: { fullName: string; username: string }) => {
    if (!currentUser?.id || isDemoUser) return;
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
        <FollowButton
          username={profile.username}
          isFollowing={isFollowing}
          isOwnProfile={isOwnProfile}
          disabled={isDemoUser}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { userError } from "@/lib/user-error";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { apiClient, type PublicUserProfile } from "@/lib/api-client";

interface ProfileActionsProps {
  profile: PublicUserProfile;
  currentUser?: Session["user"] | null;
  isOwnProfile: boolean;
  onProfileUpdated?: (profile: { fullName: string; username: string; profilePictureUrl?: string }) => void;
  isFollowing?: boolean | null;
  followStatus?: "unresolved" | "known" | "error";
  onFollowChange?: (isFollowing: boolean) => void;
  onRetryFollowStatus?: () => void;
}

export default function ProfileActions({
  profile,
  currentUser,
  isOwnProfile,
  onProfileUpdated,
  isFollowing,
  followStatus = typeof isFollowing === "boolean" ? "known" : "unresolved",
  onFollowChange,
  onRetryFollowStatus,
}: ProfileActionsProps) {
  const [hydrated, setHydrated] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState({
    fullName: profile.fullName,
    username: profile.username,
    profilePictureUrl: profile.profilePictureUrl,
  });
  const [followError, setFollowError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleEditProfile = async () => {
    // Refresh initial values from backend for own profile
    try {
      if (currentUser?.id) {
        const me = await apiClient.getMyProfile();
        setEditInitial({
          fullName: me.fullName,
          username: me.username,
          profilePictureUrl: me.profilePictureUrl,
        });
      }
    } catch {
      // If fetch fails, keep existing initial values
      setEditInitial({
        fullName: profile.fullName,
        username: profile.username,
        profilePictureUrl: profile.profilePictureUrl,
      });
    } finally {
      setIsEditOpen(true);
    }
  };

  const handleFollowToggle = async () => {
    if (isFollowLoading) return;
    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (typeof isFollowing !== "boolean") {
      if (followStatus === "error") {
        onRetryFollowStatus?.();
      }
      return;
    }

    setIsFollowLoading(true);
    setFollowError(null);
    try {
      const response = isFollowing
        ? await apiClient.unfollowUser(profile.username)
        : await apiClient.followUser(profile.username);
      if (response.isFollowing !== isFollowing) {
        onFollowChange?.(response.isFollowing);
      }
    } catch (error) {
      setFollowError(userError(error, "Your follow status wasn’t changed. Try again."));
      if (process.env.NODE_ENV !== "production") {
        console.error("Error following user:", error);
      }
    } finally {
      setIsFollowLoading(false);
    }
  };

  const checkUsername = async (username: string) => {
    const normalized = username.trim().toLowerCase();
    const res = await apiClient.checkUsernameAvailability(normalized);
    return res.available || normalized === profile.username; // allow unchanged
  };

  const submitEdit = async (values: { fullName: string; username: string; profilePictureUploadId?: string }) => {
    if (!currentUser?.id) return;
    const updated = await apiClient.updateProfile({
      fullName: values.fullName.trim(),
      username: values.username.trim().toLowerCase(),
      ...(values.profilePictureUploadId ? { profilePictureUploadId: values.profilePictureUploadId } : {}),
    });
    setIsEditOpen(false);
    onProfileUpdated?.({
      fullName: updated.fullName,
      username: updated.username,
      profilePictureUrl: updated.profilePictureUrl,
    });
    router.refresh();
    if (updated.username !== profile.username) {
      router.push(`/${updated.username}`);
    }
  };

  if (!currentUser) {
    return (
      <button type="button" onClick={() => router.push("/login")} className="ui-primary">
        Log In
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOwnProfile ? (
        <>
          <button type="button" onClick={handleEditProfile} disabled={!hydrated} className="ui-secondary">
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
        <div>
          <button
            type="button"
            onClick={handleFollowToggle}
            disabled={!hydrated || isFollowLoading || (followStatus !== "known" && followStatus !== "error")}
            aria-describedby={followError ? "follow-error" : undefined}
            className={["ui-action", isFollowing ? "ui-secondary" : "ui-primary"].join(" ")}
          >
            {isFollowLoading
              ? "Updating..."
              : followStatus === "unresolved"
                ? "Checking follow…"
                : followStatus === "error"
                  ? "Retry follow status"
                  : typeof isFollowing !== "boolean"
                    ? "Follow unavailable"
                    : isFollowing
                      ? "Following"
                      : "Follow"}
          </button>
          {followError ? (
            <div id="follow-error">
              <ErrorNotice
                key={followError}
                message={followError}
                onRetry={() => void handleFollowToggle()}
                pending={isFollowLoading}
                retryLabel="Retry follow"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

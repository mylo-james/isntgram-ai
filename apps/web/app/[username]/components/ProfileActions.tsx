"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import { RiLogoutBoxRLine } from "react-icons/ri";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { apiClient, type PublicUserProfile } from "@/lib/api-client";

interface ProfileActionsProps {
  profile: PublicUserProfile;
  currentUser?: Session["user"] | null;
  isOwnProfile: boolean;
  onProfileUpdated?: (profile: { fullName: string; username: string }) => void;
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState({ fullName: profile.fullName, username: profile.username });
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
      setFollowError("We couldn't update this follow. Please try again.");
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

  const submitEdit = async (values: { fullName: string; username: string }) => {
    if (!currentUser?.id) return;
    const updated = await apiClient.updateProfile({
      fullName: values.fullName.trim(),
      username: values.username.trim().toLowerCase(),
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
      <button
        type="button"
        onClick={() => router.push("/login")}
        className="h-[30px] rounded-sm border border-[#dbdbdb] bg-white px-3 text-sm font-semibold text-[#262626] hover:bg-gray-50"
      >
        Log In
      </button>
    );
  }

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await apiClient.logout().catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Logout API error:", error);
        }
      });

      await signOut({
        redirect: false,
        callbackUrl: "/login",
      });
    } finally {
      router.push("/login");
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isOwnProfile ? (
        <>
          <button
            type="button"
            onClick={handleEditProfile}
            disabled={!hydrated || isSigningOut}
            className="h-[30px] rounded-sm border border-[#dbdbdb] bg-white px-3 text-sm font-semibold text-[#262626] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Edit Profile
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={!hydrated || isSigningOut}
            aria-label="Log out"
            className="rounded-sm p-1 text-[#262626] hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RiLogoutBoxRLine className="h-5 w-5" aria-hidden="true" focusable="false" />
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
            className={[
              "h-[30px] rounded-sm px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
              isFollowing
                ? "border border-[#dbdbdb] bg-white text-[#262626] hover:bg-gray-50"
                : "bg-[#0095f6] text-white hover:bg-[#1877f2]",
            ].join(" ")}
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
            <p id="follow-error" className="mt-1 text-xs text-red-600" role="alert">
              {followError}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

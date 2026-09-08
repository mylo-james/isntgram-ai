"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { userError } from "@/lib/user-error";
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
  const [confirmSignOut, setConfirmSignOut] = useState(false);
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
      <button type="button" onClick={() => router.push("/login")} className="ui-primary">
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
    <div className="flex flex-wrap items-center gap-2">
      {isOwnProfile ? (
        <>
          <button
            type="button"
            onClick={handleEditProfile}
            disabled={!hydrated || isSigningOut}
            className="ui-secondary"
          >
            Edit Profile
          </button>

          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            disabled={!hydrated || isSigningOut}
            aria-label="Log out"
            className="ui-quiet text-gray-700"
          >
            Log out
          </button>

          <Dialog
            open={confirmSignOut}
            onClose={() => {
              if (!isSigningOut) setConfirmSignOut(false);
            }}
            aria-labelledby="logout-title"
            contentClassName="w-full max-w-sm rounded-2xl bg-white p-6"
          >
            <h2 id="logout-title" className="text-lg font-semibold">
              Log out?
            </h2>
            <p className="my-4">You can log in again to return to your account.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" disabled={isSigningOut} onClick={() => setConfirmSignOut(false)}>
                Stay logged in
              </Button>
              <Button loading={isSigningOut} onClick={() => void handleSignOut()}>
                Log out
              </Button>
            </div>
          </Dialog>
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

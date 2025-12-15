"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Session } from "next-auth";
import { useSession } from "next-auth/react";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { apiClient } from "@/lib/api-client";
import { followUserAction, unfollowUserAction } from "../follow-actions";
import type { PublicUserProfile } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Extend the Session type to include username
type AppSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; username?: string; isDemoUser?: boolean };
};

interface ProfileActionsProps {
  profile: PublicUserProfile;
  currentUser?: AppSession["user"] | null;
  isOwnProfile: boolean;
  initialIsFollowing?: boolean;
  onProfileUpdated?: (profile: { fullName: string; username: string }) => void;
  variant?: "mobile" | "desktop";
}

export default function ProfileActions({
  profile,
  currentUser,
  isOwnProfile,
  initialIsFollowing,
  onProfileUpdated,
  variant = "desktop",
}: ProfileActionsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState({ fullName: profile.fullName, username: profile.username });
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  const isDemoUser = Boolean(currentUser?.isDemoUser);
  const isFollowing = Boolean(initialIsFollowing);

  const btnBase =
    "h-[30px] rounded-[3px] border border-[#dfdfdf] bg-transparent px-[9px] py-[5px] text-[14px] font-semibold text-[#262626]";

  const btnDesktop = variant === "desktop" ? "cursor-pointer" : "";
  const btnWidth = variant === "mobile" ? "w-full" : "";

  const handleEditProfile = async () => {
    try {
      const me = await apiClient.getMyProfile();
      setEditInitial({ fullName: me.fullName, username: me.username });
    } catch {
      setEditInitial({ fullName: profile.fullName, username: profile.username });
    } finally {
      setIsEditOpen(true);
    }
  };

  const checkUsername = async (username: string) => {
    const res = await apiClient.checkUsernameAvailability(username);
    return res.available || username === profile.username;
  };

  const submitEdit = async (values: { fullName: string; username: string }) => {
    if (!currentUser?.id || isDemoUser) return;
    const updated = await apiClient.updateProfile({
      fullName: values.fullName,
      username: values.username,
    });
    setIsEditOpen(false);
    onProfileUpdated?.({ fullName: updated.fullName, username: updated.username });

    try {
      if (session?.user) {
        await updateSession({
          user: {
            ...(session.user as Record<string, unknown>),
            name: updated.fullName,
            username: updated.username,
          },
        });
      }
    } catch {
      // ignore
    }

    if (updated.username !== profile.username) {
      router.push(`/${updated.username}`);
    }
  };

  if (!currentUser) {
    return (
      <button
        type="button"
        onClick={() => router.push("/login")}
        className={cn(btnBase, btnDesktop, btnWidth, "border-[#0095f6] text-[#0095f6]")}
      >
        Log in
      </button>
    );
  }

  if (isOwnProfile) {
    return (
      <>
        <button
          type="button"
          onClick={handleEditProfile}
          disabled={isDemoUser}
          title={isDemoUser ? "Demo mode: editing disabled" : undefined}
          className={cn(btnBase, btnDesktop, btnWidth, "disabled:cursor-not-allowed disabled:opacity-60")}
        >
          Edit Profile
        </button>
        <EditProfileModal
          open={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          initialValues={editInitial}
          checkUsername={checkUsername}
          onSubmit={submitEdit}
          isDemoUser={isDemoUser}
        />
      </>
    );
  }

  return (
    <form
      action={(isFollowing ? unfollowUserAction : followUserAction).bind(null, profile.username)}
      className="w-full"
    >
      <button
        type="submit"
        aria-label={isFollowing ? `Unfollow ${profile.username}` : `Follow ${profile.username}`}
        disabled={isDemoUser}
        title={isDemoUser ? "Demo mode: following disabled" : undefined}
        className={cn(
          btnBase,
          btnDesktop,
          variant === "mobile" ? "w-[85px]" : "",
          isFollowing ? "" : "border-[#0096F5] bg-[#0096F5] text-white",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </form>
  );
}

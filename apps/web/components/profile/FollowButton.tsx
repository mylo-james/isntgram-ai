"use client";

import { useState } from "react";
import clsx from "clsx";
import { useToast } from "@/components/ui/ToastProvider";

interface FollowButtonProps {
  username: string;
  isFollowing: boolean;
  isOwnProfile: boolean;
  disabled?: boolean;
  onFollow: () => Promise<void>;
  onUnfollow: () => Promise<void>;
}

export default function FollowButton({
  username,
  isFollowing,
  isOwnProfile,
  disabled,
  onFollow,
  onUnfollow,
}: FollowButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (isOwnProfile) return null;

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await onUnfollow();
      } else {
        await onFollow();
      }
    } catch {
      toast({
        variant: "error",
        title: "Action failed",
        message: isFollowing
          ? "Could not unfollow right now. Please try again."
          : "Could not follow right now. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const label = loading ? (isFollowing ? "Unfollowing..." : "Following...") : isFollowing ? "Following" : "Follow";

  return (
    <button
      aria-label={isFollowing ? `Unfollow ${username}` : `Follow ${username}`}
      onClick={handleClick}
      disabled={disabled || loading}
      className={clsx(
        "w-full px-6 py-3 rounded-lg transition-colors font-medium",
        isFollowing ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : "bg-blue-600 text-white hover:bg-blue-700",
        (disabled || loading) && "disabled:bg-blue-400 disabled:cursor-not-allowed",
      )}
    >
      {label}
    </button>
  );
}

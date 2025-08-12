"use client";

import { useState } from "react";
import clsx from "clsx";

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
  isFollowing: initialFollowing,
  isOwnProfile,
  disabled,
  onFollow,
  onUnfollow,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  if (isOwnProfile) return null;

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await onUnfollow();
        setIsFollowing(false);
      } else {
        await onFollow();
        setIsFollowing(true);
      }
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

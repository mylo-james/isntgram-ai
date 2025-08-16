import React from "react";

interface ProfileStatsProps {
  postCount: number;
  followerCount: number;
  followingCount: number;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
}

export default function ProfileStats({
  postCount,
  followerCount,
  followingCount,
  onFollowersClick,
  onFollowingClick,
}: ProfileStatsProps) {
  return (
    <div className="flex justify-around">
      <div className="text-center">
        <div className="text-2xl font-semibold text-gray-900">{postCount}</div>
        <div className="text-sm text-gray-600">Posts</div>
      </div>

      <button
        type="button"
        onClick={onFollowersClick}
        className="text-center focus:outline-none"
        aria-label="View followers"
      >
        <div className="text-2xl font-semibold text-gray-900">{followerCount}</div>
        <div className="text-sm text-gray-600">Followers</div>
      </button>

      <button
        type="button"
        onClick={onFollowingClick}
        className="text-center focus:outline-none"
        aria-label="View following"
      >
        <div className="text-2xl font-semibold text-gray-900">{followingCount}</div>
        <div className="text-sm text-gray-600">Following</div>
      </button>
    </div>
  );
}

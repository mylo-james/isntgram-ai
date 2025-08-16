"use client";

import React from "react";
import FollowButton from "./FollowButton";

interface UserListItemProps {
  id: string;
  username: string;
  fullName: string;
  profilePictureUrl?: string;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onNavigate: (username: string) => void;
  onFollow: () => Promise<void>;
  onUnfollow: () => Promise<void>;
}

export default function UserListItem(props: UserListItemProps) {
  const { username, fullName, isFollowing, isOwnProfile, onNavigate, onFollow, onUnfollow } = props;
  return (
    <div className="flex items-center justify-between py-2">
      <button className="text-left" onClick={() => onNavigate(username)}>
        <div className="font-medium">{username}</div>
        <div className="text-sm text-gray-600">{fullName}</div>
      </button>
      <FollowButton
        username={username}
        isFollowing={isFollowing}
        isOwnProfile={isOwnProfile}
        onFollow={onFollow}
        onUnfollow={onUnfollow}
      />
    </div>
  );
}

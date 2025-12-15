"use client";

import React, { useEffect, useState } from "react";
import { apiClient, type FollowListResponse } from "@/lib/api-client";
import FollowButton from "./FollowButton";
import Modal from "@/components/ui/Modal";
import { useSession } from "next-auth/react";

interface FollowersModalProps {
  username: string;
  isOpen: boolean;
  onClose: () => void;
  followerCount: number;
  currentUserId?: string;
}

export default function FollowersModal({
  username,
  isOpen,
  onClose,
  followerCount,
  currentUserId,
}: FollowersModalProps) {
  const { data: session } = useSession();
  const isDemoUser = Boolean(session?.user && (session.user as unknown as { isDemoUser?: boolean }).isDemoUser);

  const [users, setUsers] = useState<FollowListResponse["users"]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await apiClient.getFollowers(username, 1, 20);
        setUsers(res.users);
        setPage(1);
        setHasMore(res.pagination.hasMore);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isOpen, username]);

  const loadMore = async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const res = await apiClient.getFollowers(username, nextPage, 20);
      setUsers((prev) => [...prev, ...res.users]);
      setPage(nextPage);
      setHasMore(res.pagination.hasMore);
    } finally {
      setLoading(false);
    }
  };

  const setIsFollowingForUser = (targetUsername: string, nextIsFollowing: boolean) => {
    setUsers((prev) => prev.map((u) => (u.username === targetUsername ? { ...u, isFollowing: nextIsFollowing } : u)));
  };

  const follow = async (targetUsername: string) => {
    await apiClient.followUser(targetUsername);
    setIsFollowingForUser(targetUsername, true);
  };

  const unfollow = async (targetUsername: string) => {
    await apiClient.unfollowUser(targetUsername);
    setIsFollowingForUser(targetUsername, false);
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title={`Followers (${followerCount})`} contentClassName="max-h-[80vh]">
      <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">{u.username}</div>
              <div className="text-sm text-gray-600">{u.fullName}</div>
            </div>
            {currentUserId && u.id !== currentUserId && (
              <FollowButton
                username={u.username}
                isFollowing={u.isFollowing}
                isOwnProfile={false}
                disabled={isDemoUser}
                onFollow={() => follow(u.username)}
                onUnfollow={() => unfollow(u.username)}
              />
            )}
          </div>
        ))}
        {hasMore && (
          <button className="mt-4 w-full rounded bg-gray-100 p-2" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </Modal>
  );
}

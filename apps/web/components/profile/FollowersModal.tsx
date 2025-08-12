"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import FollowButton from "./FollowButton";

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
  const [users, setUsers] = useState<
    Array<{ id: string; username: string; fullName: string; profilePictureUrl?: string; isFollowing: boolean }>
  >([]);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Followers ({followerCount})</h2>
          <button className="text-sm text-gray-600" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="p-4 overflow-auto" style={{ maxHeight: "60vh" }}>
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{u.username}</div>
                <div className="text-sm text-gray-600">{u.fullName}</div>
              </div>
              {u.id !== currentUserId && (
                <FollowButton
                  username={u.username}
                  isFollowing={u.isFollowing}
                  isOwnProfile={false}
                  onFollow={() => apiClient.followUser(u.username)}
                  onUnfollow={() => apiClient.unfollowUser(u.username)}
                />
              )}
            </div>
          ))}
          {hasMore && (
            <button className="mt-4 w-full bg-gray-100 rounded p-2" onClick={loadMore} disabled={loading}>
              {loading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

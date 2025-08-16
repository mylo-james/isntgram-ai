"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PostResponse, apiClient } from "../../lib/api-client";
import Button from "../ui/Button";

interface UserPostsGridProps {
  username: string;
  currentUserId?: string;
}

export function UserPostsGrid({ username, currentUserId }: UserPostsGridProps) {
  const [posts, setPosts] = useState<PostResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const loadPosts = async (pageNum: number, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const newPosts = await apiClient.getUserPosts(username, pageNum, 12);

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(newPosts.length === 12);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
      console.error("Error loading user posts:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadPosts(1, true);
  }, [username]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(nextPage);
  };

  const handleRefresh = () => {
    setPage(1);
    loadPosts(1, true);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-300 animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
        <Button onClick={handleRefresh}>Try Again</Button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg font-medium mb-2">No posts yet</p>
          <p className="text-sm">
            {currentUserId === posts[0]?.userId ? "Share your first post!" : `${username} hasn't posted anything yet`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((post) => (
          <Link key={post.id} href={`/p/${post.id}`} className="aspect-square block relative group overflow-hidden">
            <img
              src={post.imageUrl}
              alt={post.caption || "Post"}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
              <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">{post.likesCount}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">{post.commentsCount}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="text-center py-6">
          <Button onClick={handleLoadMore} loading={loadingMore} loadingText="Loading more..." variant="secondary">
            Load More Posts
          </Button>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">No more posts to show</p>
        </div>
      )}
    </div>
  );
}

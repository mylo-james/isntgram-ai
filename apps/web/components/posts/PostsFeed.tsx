"use client";

import { useState, useEffect } from "react";
import { PostResponse, apiClient } from "../../lib/api-client";
import { PostCard } from "./PostCard";
import Button from "../ui/Button";

interface PostsFeedProps {
  currentUserId?: string;
}

export function PostsFeed({ currentUserId }: PostsFeedProps) {
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

      const newPosts = await apiClient.getFeed(pageNum, 10);

      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setHasMore(newPosts.length === 10);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
      console.error("Error loading posts:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadPosts(1, true);
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(nextPage);
  };

  const handlePostDeleted = () => {
    // Refresh the feed
    setPage(1);
    loadPosts(1, true);
  };

  const handleRefresh = () => {
    setPage(1);
    loadPosts(1, true);
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm animate-pulse">
            <div className="flex items-center space-x-3 p-4">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                <div className="h-3 bg-gray-300 rounded w-16"></div>
              </div>
            </div>
            <div className="bg-gray-300 h-64"></div>
            <div className="p-4">
              <div className="flex items-center space-x-4 mb-3">
                <div className="h-6 bg-gray-300 rounded w-16"></div>
                <div className="h-6 bg-gray-300 rounded w-16"></div>
              </div>
              <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
        <Button onClick={handleRefresh}>Try Again</Button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
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
          <p className="text-sm">Follow some users to see their posts in your feed</p>
        </div>
        <Button onClick={handleRefresh}>Refresh</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} onPostDeleted={handlePostDeleted} />
      ))}

      {hasMore && (
        <div className="text-center py-4">
          <Button onClick={handleLoadMore} loading={loadingMore} loadingText="Loading more..." variant="secondary">
            Load More Posts
          </Button>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          <p>You've reached the end!</p>
        </div>
      )}
    </div>
  );
}

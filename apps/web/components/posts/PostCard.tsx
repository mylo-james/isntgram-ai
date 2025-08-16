"use client";

import { useState } from "react";
import Link from "next/link";
import { PostResponse, apiClient } from "../../lib/api-client";
import Button from "../ui/Button";

interface PostCardProps {
  post: PostResponse;
  currentUserId?: string;
  onPostDeleted?: () => void;
}

export function PostCard({ post, currentUserId, onPostDeleted }: PostCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!currentUserId || currentUserId !== post.userId) return;

    setDeleting(true);
    try {
      await apiClient.deletePost(post.id);
      onPostDeleted?.();
    } catch (error) {
      console.error("Error deleting post:", error);
      // You could add a toast notification here
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;

    return d.toLocaleDateString();
  };

  const canDelete = currentUserId && currentUserId === post.userId;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Post Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          {post.user?.profilePictureUrl ? (
            <img
              src={post.user.profilePictureUrl}
              alt={`${post.user.username}'s profile`}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium text-sm">
                {post.user?.fullName?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
          )}
          <div>
            <Link href={`/${post.user?.username || "user"}`} className="font-medium text-gray-900 hover:underline">
              {post.user?.username || "Unknown User"}
            </Link>
            <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
          </div>
        </div>

        {canDelete && (
          <div className="relative">
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="text-gray-400 hover:text-gray-600 p-1"
              disabled={deleting}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showDeleteConfirm && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 min-w-[120px]">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  loading={deleting}
                  loadingText="Deleting..."
                  className="w-full"
                >
                  Delete Post
                </Button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full text-left px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded mt-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Image */}
      <div className="relative">
        <img
          src={post.imageUrl}
          alt="Post content"
          className="w-full h-auto object-cover"
          style={{ maxHeight: "600px" }}
        />
      </div>

      {/* Post Actions */}
      <div className="p-4">
        <div className="flex items-center space-x-4 mb-3">
          <button className="flex items-center space-x-1 text-gray-600 hover:text-red-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <span className="text-sm">{post.likesCount}</span>
          </button>

          <button className="flex items-center space-x-1 text-gray-600 hover:text-blue-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-sm">{post.commentsCount}</span>
          </button>
        </div>

        {/* Post Caption */}
        {post.caption && (
          <div className="text-gray-900">
            <Link href={`/${post.user?.username || "user"}`} className="font-medium hover:underline mr-2">
              {post.user?.username || "Unknown User"}
            </Link>
            <span className="whitespace-pre-wrap">{post.caption}</span>
          </div>
        )}
      </div>
    </div>
  );
}

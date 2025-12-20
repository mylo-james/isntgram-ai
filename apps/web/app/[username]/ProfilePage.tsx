"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";

import { apiClient, type PublicUserProfile, type PostItem } from "@/lib/api-client";
import Button from "@/components/ui/Button";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import PostCard from "@/components/posts/PostCard";
import ProfileHeader from "./components/ProfileHeader";
import ProfileActions from "./components/ProfileActions";
import ProfileStats from "./components/ProfileStats";

interface ProfilePageProps {
  username: string;
  currentUser?: Session["user"] | null;
  initialProfile: PublicUserProfile;
  initialPosts: PostItem[];
  initialCursor?: string;
  initialIsFollowing?: boolean | null;
}

export default function ProfilePage({
  username,
  currentUser,
  initialProfile,
  initialPosts,
  initialCursor,
  initialIsFollowing,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<PublicUserProfile>(initialProfile);
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [postsCursor, setPostsCursor] = useState<string | undefined>(initialCursor);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(initialIsFollowing ?? null);
  const router = useRouter();

  const isOwnProfile = currentUser?.id ? currentUser.id === profile.id : currentUser?.username === username;

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    setPosts(initialPosts);
    setPostsCursor(initialCursor);
    setPostsLoading(false);
    setPostsError(null);
  }, [initialPosts, initialCursor]);

  useEffect(() => {
    setIsFollowing(initialIsFollowing ?? null);
  }, [initialIsFollowing, username]);

  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (!currentUser || isOwnProfile || initialIsFollowing !== null) {
        return;
      }

      try {
        const status = await apiClient.getFollowStatus(username);
        setIsFollowing(status.isFollowing);
      } catch {
        setIsFollowing(null);
      }
    };

    fetchFollowStatus();
  }, [currentUser, isOwnProfile, username, initialIsFollowing]);

  const handleProfileUpdated = (updated: { fullName: string; username: string }) => {
    setProfile((prev) => ({ ...prev, fullName: updated.fullName, username: updated.username }));
  };

  const handleFollowChange = (next: boolean) => {
    setIsFollowing(next);
    setProfile((prev) => ({
      ...prev,
      followerCount: Math.max(0, prev.followerCount + (next ? 1 : -1)),
    }));
  };

  const loadMorePosts = async () => {
    if (!postsCursor) return;
    try {
      setPostsLoading(true);
      setPostsError(null);
      const response = await apiClient.getUserPosts(username, { cursor: postsCursor });
      setPosts((prev) => [...prev, ...response.items]);
      setPostsCursor(response.nextCursor);
    } catch (err) {
      setPostsError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setPostsLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h1>
          <p className="text-gray-600 mb-6">The user &quot;{username}&quot; could not be found.</p>
          <Button onClick={() => router.push("/")} type="button">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ProfileHeader profile={profile} />
            <ProfileStats profile={profile} />
            <ProfileActions
              profile={profile}
              currentUser={currentUser}
              isOwnProfile={isOwnProfile}
              onProfileUpdated={handleProfileUpdated}
              isFollowing={isFollowing}
              onFollowChange={handleFollowChange}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Posts</h2>
              {postsError ? <span className="text-xs text-red-600">{postsError}</span> : null}
            </div>

            {postsLoading && posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                Loading posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                No posts yet.
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {postsCursor ? (
              <button
                type="button"
                onClick={loadMorePosts}
                disabled={postsLoading}
                className="w-full rounded-full border border-slate-300 bg-white py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {postsLoading ? "Loading..." : "Load more"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

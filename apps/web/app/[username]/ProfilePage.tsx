"use client";

import ErrorNotice from "@/components/ui/ErrorNotice";
import { userError } from "@/lib/user-error";

import { postDescription, postLinkLabel } from "@/lib/post-description";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";

import { apiClient, type PublicUserProfile, type PostItem } from "@/lib/api-client";
import Button from "@/components/ui/Button";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import ProfileActions from "./components/ProfileActions";

interface ProfilePageProps {
  username: string;
  currentUser?: Session["user"] | null;
  initialProfile: PublicUserProfile;
  initialPosts: PostItem[];
  initialCursor?: string;
  initialPostsError?: boolean;
  initialIsFollowing?: boolean | null;
}

export default function ProfilePage({
  username,
  currentUser,
  initialProfile,
  initialPosts,
  initialCursor,
  initialPostsError = false,
  initialIsFollowing,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<PublicUserProfile>(initialProfile);
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [postsCursor, setPostsCursor] = useState<string | undefined>(initialCursor);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(
    initialPostsError ? "Posts couldn’t load. Try again." : null,
  );
  const [isFollowing, setIsFollowing] = useState<boolean | null>(initialIsFollowing ?? null);
  const [followStatus, setFollowStatus] = useState<"unresolved" | "known" | "error">(
    typeof initialIsFollowing === "boolean" ? "known" : "unresolved",
  );
  const router = useRouter();

  const isOwnProfile = currentUser?.id ? currentUser.id === profile.id : currentUser?.username === username;

  const initials = useMemo(() => {
    const fullName = profile?.fullName ?? "";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return parts
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [profile?.fullName]);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    setPosts(initialPosts);
    setPostsCursor(initialCursor);
    setPostsLoading(false);
    setPostsError(initialPostsError ? "Posts couldn’t load. Try again." : null);
  }, [initialPosts, initialCursor, initialPostsError]);

  useEffect(() => {
    setIsFollowing(initialIsFollowing ?? null);
    setFollowStatus(typeof initialIsFollowing === "boolean" ? "known" : "unresolved");
  }, [initialIsFollowing, username]);

  const refreshFollowStatus = useCallback(async () => {
    if (!currentUser || isOwnProfile) return;

    setFollowStatus("unresolved");
    try {
      const status = await apiClient.getFollowStatus(username);
      if (typeof status.isFollowing !== "boolean") {
        throw new Error("Invalid follow status");
      }
      setIsFollowing(status.isFollowing);
      setFollowStatus("known");
    } catch {
      setIsFollowing(null);
      setFollowStatus("error");
    }
  }, [currentUser, isOwnProfile, username]);

  useEffect(() => {
    if (!currentUser || isOwnProfile || typeof initialIsFollowing === "boolean") {
      return;
    }

    void refreshFollowStatus();
  }, [currentUser, isOwnProfile, initialIsFollowing, refreshFollowStatus]);

  const handleProfileUpdated = (updated: { fullName: string; username: string }) => {
    setProfile((prev) => ({ ...prev, fullName: updated.fullName, username: updated.username }));
  };

  const handleFollowChange = (next: boolean) => {
    if (isFollowing === next) return;
    setIsFollowing(next);
    setFollowStatus("known");
    setProfile((prev) => ({
      ...prev,
      followerCount: Math.max(0, prev.followerCount + (next ? 1 : -1)),
    }));
  };

  const loadMorePosts = useCallback(async () => {
    if ((!postsCursor && !postsError) || postsLoading) return;
    try {
      setPostsLoading(true);
      setPostsError(null);
      const response = await apiClient.getUserPosts(username, { cursor: postsCursor });
      setPosts((prev) => [...prev, ...response.items]);
      setPostsCursor(response.nextCursor);
    } catch (err) {
      setPostsError(userError(err, "More posts couldn’t load. The posts already shown are still here. Try again."));
    } finally {
      setPostsLoading(false);
    }
  }, [postsCursor, postsLoading, postsError, username]);

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
      <div className="mx-auto w-full max-w-[935px] px-5 pb-10 pt-6">
        <header className="flex flex-col gap-5 pb-8 pt-4 sm:flex-row sm:gap-8">
          <div className="flex shrink-0 items-center sm:justify-center">
            <div className="h-[96px] w-[96px] overflow-hidden rounded-full sm:h-[150px] sm:w-[150px]">
              {profile.profilePictureUrl ? (
                <Image
                  src={profile.profilePictureUrl}
                  alt={`${profile.username}'s profile picture`}
                  width={150}
                  height={150}
                  sizes="(max-width: 640px) 96px, 150px"
                  className="h-full w-full object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-900 text-xl font-semibold text-white sm:text-2xl">
                  {initials || "U"}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-all text-[28px] font-normal text-[#262626]">{profile.username}</h1>
              <ProfileActions
                profile={profile}
                currentUser={currentUser}
                isOwnProfile={isOwnProfile}
                onProfileUpdated={handleProfileUpdated}
                isFollowing={isFollowing}
                followStatus={followStatus}
                onFollowChange={handleFollowChange}
                onRetryFollowStatus={() => void refreshFollowStatus()}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#262626] sm:gap-10">
              <span>
                <span className="font-semibold">{profile.postCount}</span> posts
              </span>
              <span>
                <span className="font-semibold">{profile.followerCount}</span> followers
              </span>
              <span>
                <span className="font-semibold">{profile.followingCount}</span> following
              </span>
            </div>

            <div className="mt-4 space-y-1 text-sm text-[#262626]">
              <div className="font-semibold">{profile.fullName}</div>
              {profile.bio ? <div className="whitespace-pre-wrap">{profile.bio}</div> : null}
            </div>
          </div>
        </header>

        <div className="border-t border-gray-300 pt-5">
          <h2 className="text-lg font-semibold">Posts</h2>
          {postsError ? (
            <ErrorNotice
              key={postsError}
              message={postsError}
              onRetry={() => void loadMorePosts()}
              pending={postsLoading}
            />
          ) : null}

          {postsLoading && posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading posts...</p>
          ) : posts.length === 0 && !postsError ? (
            <div className="py-10 text-center text-gray-700">
              <p>No posts yet.</p>
              {isOwnProfile ? (
                <Link href="/upload" className="ui-action mt-3 text-blue-700 underline">
                  Create your first post
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-3 gap-1 pb-14 sm:gap-6 sm:pb-0">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="relative aspect-square w-full overflow-hidden bg-gray-100"
                  aria-label={postLinkLabel(post)}
                >
                  {post.mediaUrl ? (
                    <Image
                      src={post.mediaUrl}
                      alt={postDescription(post)}
                      fill
                      sizes="(max-width: 640px) 33vw, 293px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-gray-600">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-6 w-6 text-gray-400">
                        <path fill="currentColor" d="M4 4h16v2H4V4zm0 4h16v12H4V8zm2 2v8h12v-8H6z" />
                      </svg>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600">
                        Text post
                      </span>
                      {post.content ? (
                        <span className="max-w-full overflow-hidden text-ellipsis">
                          {post.content.trim().length > 90
                            ? `${post.content.trim().slice(0, 90)}…`
                            : post.content.trim()}
                        </span>
                      ) : null}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}

          {postsLoading && posts.length > 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading...</p>
          ) : null}

          {postsCursor && !postsError ? (
            <button
              type="button"
              onClick={loadMorePosts}
              disabled={postsLoading}
              className="ui-action mx-auto mt-5 border border-gray-400"
            >
              {postsLoading ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </div>
      </div>
    </ErrorBoundary>
  );
}

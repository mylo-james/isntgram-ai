"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [followStatus, setFollowStatus] = useState<"unresolved" | "known" | "error">(
    typeof initialIsFollowing === "boolean" ? "known" : "unresolved",
  );
  const router = useRouter();
  const postsSentinelRef = useRef<HTMLDivElement | null>(null);
  const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";

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
    setPostsError(null);
  }, [initialPosts, initialCursor]);

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
    if (!postsCursor || postsLoading) return;
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
  }, [postsCursor, postsLoading, username]);

  useEffect(() => {
    if (!postsCursor) return;
    const el = postsSentinelRef.current;
    if (!el) return;

    if (!supportsIntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        loadMorePosts();
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMorePosts, postsCursor, supportsIntersectionObserver]);

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
        <header className="flex gap-8 pb-8 pt-4">
          <div className="flex shrink-0 items-center justify-center">
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
              <h1 className="truncate text-[28px] font-normal text-[#262626]">{profile.username}</h1>
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

            <div className="mt-5 flex gap-6 text-sm text-[#262626] sm:gap-10">
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
              {profile.bio ? (
                <div className="whitespace-pre-wrap">{profile.bio}</div>
              ) : isOwnProfile ? (
                <div className="text-gray-500">Add a bio to tell people about yourself.</div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="border-t border-gray-300 pt-5">
          {postsError ? <p className="text-sm text-red-600">{postsError}</p> : null}

          {postsLoading && posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">No posts yet.</p>
          ) : (
            <div className="mt-5 grid grid-cols-3 gap-1 pb-14 sm:gap-6 sm:pb-0">
              {posts.map((post, index) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="relative aspect-square w-full overflow-hidden bg-gray-100"
                  aria-label={`View post ${index + 1}`}
                >
                  {post.mediaUrl ? (
                    <Image
                      src={post.mediaUrl}
                      alt=""
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

          <div ref={postsSentinelRef} aria-hidden="true" className="h-1" />

          {postsLoading && posts.length > 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading...</p>
          ) : null}

          {!supportsIntersectionObserver && postsCursor ? (
            <button
              type="button"
              onClick={loadMorePosts}
              disabled={postsLoading}
              className="mx-auto block w-full max-w-[300px] rounded-sm border border-gray-300 bg-white py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-600 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {postsLoading ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </div>
      </div>
    </ErrorBoundary>
  );
}

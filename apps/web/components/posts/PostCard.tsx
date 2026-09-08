"use client";

import ErrorNotice from "@/components/ui/ErrorNotice";
import { userError } from "@/lib/user-error";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { apiClient, type PostItem } from "@/lib/api-client";
import PostOptions from "@/components/posts/PostOptions";
import { postDescription } from "@/lib/post-description";
import { CommentIcon, HeartIcon } from "@/components/posts/PostIcons";

function formatPostDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    dateTime: parsed.toISOString(),
    visibleLabel: parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    accessibleLabel: parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
}

export default function PostCard({ post }: { post: PostItem }) {
  const [likedByViewer, setLikedByViewer] = useState(Boolean(post.likedByViewer));
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const commentCount = post.commentCount ?? 0;
  const [isLiking, setIsLiking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const initials = useMemo(() => {
    const parts = post.author.fullName.trim().split(/\s+/).filter(Boolean);
    return parts
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [post.author.fullName]);

  const createdAt = useMemo(() => formatPostDate(post.createdAt), [post.createdAt]);

  const handleToggleLike = async () => {
    if (isLiking) return;

    const previousLiked = likedByViewer;
    const previousCount = likeCount;
    const nextLiked = !previousLiked;

    setLikedByViewer(nextLiked);
    setLikeCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));
    setIsLiking(true);
    setError(null);

    try {
      const status = nextLiked ? await apiClient.likePost(post.id) : await apiClient.unlikePost(post.id);
      setLikedByViewer(status.isLiked);
      setLikeCount(status.likeCount);
    } catch (err) {
      setLikedByViewer(previousLiked);
      setLikeCount(previousCount);
      setError(userError(err, "Your like wasn’t changed. Try again."));
    } finally {
      setIsLiking(false);
    }
  };

  const previewComments = useMemo(() => {
    const comments = post.previewComments ?? [];
    if (comments.length === 0) return [];
    // API provides newest-first; render oldest-first for readability.
    return [...comments].reverse();
  }, [post.previewComments]);

  return (
    <article className="social-surface w-full">
      <header className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:px-5">
        <Link href={`/${post.author.username}`} className="flex min-w-0 items-center gap-3">
          {post.author.profilePictureUrl ? (
            <Image
              src={post.author.profilePictureUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white"
              aria-hidden="true"
            >
              {initials || "U"}
            </div>
          )}
          <span className="break-all text-sm font-semibold text-gray-800">{post.author.username}</span>
        </Link>

        <div className="flex items-center gap-3">
          {createdAt ? (
            <time dateTime={createdAt.dateTime} className="text-xs text-gray-500">
              <span aria-hidden="true">{createdAt.visibleLabel}</span>
              <span className="sr-only">Posted {createdAt.accessibleLabel}</span>
            </time>
          ) : (
            <span className="text-xs text-gray-500" />
          )}
          <button
            type="button"
            aria-label="More options"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="ui-action post-action text-gray-600 hover:text-gray-900"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5 fill-current">
              <circle cx="6" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="18" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {post.mediaUrl ? (
        <div className="relative aspect-square w-full bg-gray-100">
          <Image
            src={post.mediaUrl}
            alt={postDescription(post)}
            fill
            sizes="(max-width: 640px) 100vw, 600px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="post-body">
        <div className="post-actions">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={isLiking}
            aria-pressed={likedByViewer}
            aria-label={likedByViewer ? "Unlike" : "Like"}
            className={[
              "ui-action post-action transition-transform duration-150 active:scale-95",
              isLiking ? "cursor-not-allowed opacity-60" : "hover:opacity-70",
            ].join(" ")}
          >
            <HeartIcon
              filled={likedByViewer}
              className={[
                "h-6 w-6 transition-transform duration-150",
                likedByViewer ? "text-[#ed4956]" : "text-[#262626]",
              ].join(" ")}
            />
            <span className="text-sm">{likedByViewer ? "Liked" : "Like"}</span>
          </button>

          <Link href={`/post/${post.id}`} aria-label="Comment" className="ui-action post-action">
            <CommentIcon className="h-6 w-6 text-[#262626]" />
            <span className="text-sm">Comment</span>
          </Link>
        </div>

        <p className="mt-2 text-sm font-semibold text-gray-900">
          {likeCount} {likeCount === 1 ? "like" : "likes"}
        </p>

        {post.content ? (
          <p className="post-caption">
            <Link href={`/${post.author.username}`} className="font-semibold text-gray-900">
              {post.author.username}
            </Link>{" "}
            {post.content}
          </p>
        ) : null}

        <div className="mt-2 space-y-1">
          {previewComments.length > 0 ? (
            <ul className="space-y-1">
              {previewComments.map((comment) => (
                <li key={comment.id} className="text-sm text-gray-800">
                  <Link href={`/${comment.author.username}`} className="font-semibold text-gray-900">
                    {comment.author.username}
                  </Link>{" "}
                  {comment.content}
                </li>
              ))}
            </ul>
          ) : null}

          <Link href={`/post/${post.id}`} className="ui-action quiet-link">
            {commentCount === 0 ? "Be the first to comment" : `View all ${commentCount} comments`}
          </Link>
        </div>

        {error ? (
          <ErrorNotice
            key={error}
            message={error}
            onRetry={() => void handleToggleLike()}
            pending={isLiking}
            retryLabel="Retry like"
          />
        ) : null}
      </div>

      {menuOpen ? (
        <PostOptions postId={post.id} open={menuOpen} onClose={() => setMenuOpen(false)} showPostLink />
      ) : null}
    </article>
  );
}

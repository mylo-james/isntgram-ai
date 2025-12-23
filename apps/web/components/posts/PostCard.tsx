"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { apiClient, type PostItem } from "@/lib/api-client";
import Dialog from "@/components/ui/Dialog";
import { CommentIcon, HeartIcon } from "@/components/posts/PostIcons";

function formatDateLabel(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PostCard({ post }: { post: PostItem }) {
  const [likedByViewer, setLikedByViewer] = useState(Boolean(post.likedByViewer));
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const commentCount = post.commentCount ?? 0;
  const [isLiking, setIsLiking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const initials = useMemo(() => {
    const parts = post.author.fullName.trim().split(/\s+/).filter(Boolean);
    return parts
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [post.author.fullName]);

  const createdAtLabel = useMemo(() => formatDateLabel(post.createdAt), [post.createdAt]);

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
      setError(err instanceof Error ? err.message : "Failed to update like");
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

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="w-full bg-white sm:rounded-sm sm:border sm:border-gray-300">
      <header className="flex h-[60px] items-center justify-between px-4">
        <Link href={`/${post.author.username}`} className="flex items-center gap-3">
          {post.author.profilePictureUrl ? (
            <Image
              src={post.author.profilePictureUrl}
              alt={post.author.fullName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
              {initials || "U"}
            </div>
          )}
          <span className="text-sm font-semibold text-gray-800">{post.author.username}</span>
        </Link>

        <div className="flex items-center gap-3">
          <span aria-label="Post date" className="text-xs text-gray-500">
            {createdAtLabel}
          </span>
          <button
            type="button"
            aria-label="More options"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="rounded-sm p-1 text-gray-600 hover:text-gray-900"
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
            alt="Post media"
            fill
            sizes="(max-width: 640px) 100vw, 600px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={isLiking}
            aria-pressed={likedByViewer}
            aria-label={likedByViewer ? "Unlike" : "Like"}
            className={[
              "p-1 transition-transform duration-150 active:scale-95",
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
          </button>

          <Link href={`/post/${post.id}`} aria-label="Comment" className="p-1 hover:opacity-70">
            <CommentIcon className="h-6 w-6 text-[#262626]" />
          </Link>
        </div>

        <p className="mt-2 text-sm font-semibold text-gray-900">
          {likeCount} {likeCount === 1 ? "like" : "likes"}
        </p>

        {post.content ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
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

          <Link href={`/post/${post.id}`} className="block text-sm text-gray-500 hover:text-gray-700">
            View all {commentCount} comments
          </Link>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      {menuOpen ? (
        <Dialog
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          aria-label="Post options"
          contentClassName="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl"
        >
          <Link
            href={`/post/${post.id}`}
            onClick={() => setMenuOpen(false)}
            className="block w-full border-b border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Go to post
          </Link>
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="w-full px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Cancel
          </button>
        </Dialog>
      ) : null}
    </article>
  );
}

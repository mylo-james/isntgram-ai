"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiClient, type Comment, type PostItem } from "@/lib/api-client";
import Dialog from "@/components/ui/Dialog";
import { CommentIcon, HeartIcon } from "@/components/posts/PostIcons";

function formatDateLabel(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    dateTime: parsed.toISOString(),
    visibleLabel: parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    accessibleLabel: parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
}

export default function PostDetailClient({
  post,
  initialComments,
  initialCursor,
}: {
  post: PostItem;
  initialComments: Comment[];
  initialCursor?: string;
}) {
  const [likedByViewer, setLikedByViewer] = useState(Boolean(post.likedByViewer));
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [isLiking, setIsLiking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [comments, setComments] = useState<Comment[]>(initialComments ?? []);
  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(initialCursor);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [pendingCommentLikes, setPendingCommentLikes] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const commentsSentinelRef = useRef<HTMLDivElement | null>(null);
  const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const createdAtLabel = useMemo(() => formatDateLabel(post.createdAt), [post.createdAt]);

  const initials = useMemo(() => {
    const parts = post.author.fullName.trim().split(/\s+/).filter(Boolean);
    return parts
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [post.author.fullName]);

  const commentsChronological = useMemo(() => {
    const list = comments ?? [];
    if (list.length === 0) return [];
    return [...list].reverse();
  }, [comments]);

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

  const handleFocusComment = () => {
    const input = commentInputRef.current;
    if (!input) return;
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleLoadMoreComments = useCallback(async () => {
    if (!commentsCursor || commentsLoading) return;
    setCommentsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getComments(post.id, { cursor: commentsCursor });
      setComments((prev) => [...prev, ...(response.items ?? [])]);
      setCommentsCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  }, [commentsCursor, commentsLoading, post.id]);

  useEffect(() => {
    if (!commentsCursor) return;
    const el = commentsSentinelRef.current;
    if (!el) return;

    if (!supportsIntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        handleLoadMoreComments();
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [commentsCursor, handleLoadMoreComments, supportsIntersectionObserver]);

  const handleToggleCommentLike = async (commentId: string) => {
    if (pendingCommentLikes[commentId]) return;

    const current = comments.find((comment) => comment.id === commentId);
    if (!current) return;

    const previousLiked = Boolean(current.likedByViewer);
    const previousCount = current.likeCount ?? 0;
    const nextLiked = !previousLiked;

    setPendingCommentLikes((prev) => ({ ...prev, [commentId]: true }));
    setError(null);

    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              likedByViewer: nextLiked,
              likeCount: Math.max(0, previousCount + (nextLiked ? 1 : -1)),
            }
          : comment,
      ),
    );

    try {
      const status = nextLiked
        ? await apiClient.likeComment(post.id, commentId)
        : await apiClient.unlikeComment(post.id, commentId);
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, likedByViewer: status.isLiked, likeCount: status.likeCount }
            : comment,
        ),
      );
    } catch (err) {
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId ? { ...comment, likedByViewer: previousLiked, likeCount: previousCount } : comment,
        ),
      );
      setError(err instanceof Error ? err.message : "Failed to update comment like");
    } finally {
      setPendingCommentLikes((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
    }
  };

  const handleSubmitComment = async () => {
    const content = commentDraft.trim();
    if (!content || isSubmittingComment) return;

    setIsSubmittingComment(true);
    setCommentError(null);
    try {
      const created = await apiClient.createComment(post.id, { content });
      setComments((prev) => [created, ...prev]);
      setCommentDraft("");
      setCommentCount((prev) => prev + 1);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
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
          {createdAtLabel ? (
            <time dateTime={createdAtLabel.dateTime} className="text-xs text-gray-500">
              <span aria-hidden="true">{createdAtLabel.visibleLabel}</span>
              <span className="sr-only">Posted {createdAtLabel.accessibleLabel}</span>
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

          <button type="button" aria-label="Comment" onClick={handleFocusComment} className="p-1 hover:opacity-70">
            <CommentIcon className="h-6 w-6 text-[#262626]" />
          </button>
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

        <div className="mt-3 space-y-2">
          {commentsChronological.length === 0 && !commentsLoading ? (
            <p className="text-sm text-gray-500">No comments yet.</p>
          ) : (
            <ul className="space-y-2">
              {commentsChronological.map((comment) => (
                <li key={comment.id} className="flex items-start justify-between gap-3 text-sm text-gray-800">
                  <div className="min-w-0">
                    <Link href={`/${comment.author.username}`} className="font-semibold text-gray-900">
                      {comment.author.username}
                    </Link>{" "}
                    {comment.content}
                    {comment.likeCount ? (
                      <div className="mt-1 text-xs text-gray-500">{comment.likeCount} likes</div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleCommentLike(comment.id)}
                    disabled={Boolean(pendingCommentLikes[comment.id])}
                    aria-pressed={Boolean(comment.likedByViewer)}
                    aria-label={comment.likedByViewer ? "Unlike comment" : "Like comment"}
                    className={[
                      "shrink-0 p-1 transition-transform duration-150 active:scale-95",
                      pendingCommentLikes[comment.id] ? "cursor-not-allowed opacity-60" : "hover:opacity-70",
                    ].join(" ")}
                  >
                    <HeartIcon
                      filled={Boolean(comment.likedByViewer)}
                      className={comment.likedByViewer ? "h-4 w-4 text-[#ed4956]" : "h-4 w-4 text-[#262626]"}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div ref={commentsSentinelRef} aria-hidden="true" className="h-1" />

          {commentsLoading ? <p className="text-sm text-gray-500">Loading...</p> : null}

          {!supportsIntersectionObserver && commentsCursor ? (
            <button
              type="button"
              onClick={handleLoadMoreComments}
              disabled={commentsLoading}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {commentsLoading ? "Loading..." : "Load more comments"}
            </button>
          ) : null}
        </div>

        <div className="mt-4 border-t border-gray-200 pt-3">
          <div className="flex items-center gap-2">
            <label htmlFor="comment-draft" className="sr-only">
              Add a comment
            </label>
            <input
              id="comment-draft"
              ref={commentInputRef}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a comment..."
              aria-invalid={Boolean(commentError)}
              aria-describedby={commentError ? "comment-error" : undefined}
              className="flex-1 rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400"
              maxLength={1000}
              disabled={isSubmittingComment}
            />
            <button
              type="button"
              onClick={handleSubmitComment}
              disabled={isSubmittingComment || commentDraft.trim().length === 0}
              className="text-sm font-semibold text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmittingComment ? "Posting..." : "Post"}
            </button>
          </div>

          {commentError ? (
            <p id="comment-error" role="alert" className="mt-2 text-sm text-red-600">
              {commentError}
            </p>
          ) : null}

          <p className="mt-2 text-xs text-gray-500">Comments: {commentCount}</p>
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

"use client";

import ErrorNotice from "@/components/ui/ErrorNotice";
import { userError } from "@/lib/user-error";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { apiClient, type Comment, type PostItem } from "@/lib/api-client";
import PostOptions from "@/components/posts/PostOptions";
import { postDescription } from "@/lib/post-description";
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
  initialCommentsError = false,
}: {
  post: PostItem;
  initialComments: Comment[];
  initialCursor?: string;
  initialCommentsError?: boolean;
}) {
  const [likedByViewer, setLikedByViewer] = useState(Boolean(post.likedByViewer));
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [isLiking, setIsLiking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [comments, setComments] = useState<Comment[]>(initialComments ?? []);
  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(initialCursor);
  const [commentsLoadError, setCommentsLoadError] = useState(initialCommentsError);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [pendingCommentLikes, setPendingCommentLikes] = useState<Record<string, boolean>>({});
  const [failedReaction, setFailedReaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

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
      setFailedReaction("post");
      setError(userError(err, "Your like wasn’t changed. Try again."));
    } finally {
      setIsLiking(false);
    }
  };

  const handleFocusComment = () => {
    const input = commentInputRef.current;
    if (!input) return;
    input.focus();
    input.scrollIntoView({ block: "center" });
  };

  const handleLoadMoreComments = useCallback(async () => {
    if ((!commentsCursor && !commentsLoadError) || commentsLoading) return;
    setCommentsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getComments(post.id, { cursor: commentsCursor });
      setComments((prev) => [...prev, ...(response.items ?? [])]);
      setCommentsCursor(response.nextCursor);
      setCommentsLoadError(false);
    } catch {
      setCommentsLoadError(true);
    } finally {
      setCommentsLoading(false);
    }
  }, [commentsCursor, commentsLoading, commentsLoadError, post.id]);

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
      setFailedReaction(commentId);
      setError(userError(err, "Your comment like wasn’t changed. Try again."));
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
      setCommentError(userError(err, "Your comment wasn’t added. Your text is still here. Try again."));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <article className="w-full bg-white sm:rounded-sm sm:border sm:border-gray-300">
      <header className="grid min-h-[64px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
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
            className="ui-action rounded-sm text-gray-600 hover:text-gray-900"
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

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={isLiking}
            aria-pressed={likedByViewer}
            aria-label={likedByViewer ? "Unlike" : "Like"}
            className={[
              "ui-action transition-transform duration-150 active:scale-95",
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

          <button
            type="button"
            aria-label="Comment"
            onClick={handleFocusComment}
            className="ui-action hover:opacity-70"
          >
            <CommentIcon className="h-6 w-6 text-[#262626]" />
            <span className="text-sm">Comment</span>
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

        {error && failedReaction === "post" ? (
          <ErrorNotice
            key={error}
            message={error}
            onRetry={() => void handleToggleLike()}
            pending={isLiking}
            retryLabel="Retry like"
          />
        ) : null}
        <section className="mt-5 space-y-3" aria-label="Comments">
          <h2 className="text-lg font-semibold">Comments ({commentCount})</h2>
          {commentsChronological.length === 0 && !commentsLoading && !commentsLoadError ? (
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
                    {error && failedReaction === comment.id ? (
                      <ErrorNotice
                        key={error}
                        message={error}
                        onRetry={() => void handleToggleCommentLike(comment.id)}
                        pending={Boolean(pendingCommentLikes[comment.id])}
                        retryLabel="Retry comment like"
                      />
                    ) : null}
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
                      "ui-action shrink-0 transition-transform duration-150 active:scale-95",
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

          {commentsLoading ? <p className="text-sm text-gray-500">Loading...</p> : null}

          {commentsLoadError ? (
            <ErrorNotice
              message="Comments couldn’t load. Earlier comments are still here. Try again."
              onRetry={() => void handleLoadMoreComments()}
              pending={commentsLoading}
              retryLabel="Retry comments"
            />
          ) : null}
          {commentsCursor && !commentsLoadError ? (
            <button
              type="button"
              onClick={handleLoadMoreComments}
              disabled={commentsLoading}
              className="ui-action border border-gray-400"
            >
              {commentsLoading ? "Loading..." : "Load more comments"}
            </button>
          ) : null}
        </section>

        <div className="mt-4 border-t border-gray-200 pt-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmitComment();
            }}
            className="space-y-3"
          >
            <label htmlFor="comment-draft" className="block font-medium">
              Add a comment
            </label>
            <textarea
              id="comment-draft"
              ref={commentInputRef}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a comment..."
              aria-invalid={Boolean(commentError)}
              aria-describedby={commentError ? "comment-help comment-error" : "comment-help"}
              className="ui-field min-h-24"
              maxLength={1000}
              disabled={isSubmittingComment}
            />
            <button
              type="submit"
              disabled={isSubmittingComment || commentDraft.trim().length === 0}
              className="ui-action bg-blue-700 text-white disabled:opacity-60"
            >
              {isSubmittingComment ? "Posting..." : "Post comment"}
            </button>
            <p id="comment-help" className="text-sm text-gray-700">
              Up to 1,000 characters. {commentDraft.length}/1000.
            </p>
          </form>

          {commentError ? (
            <ErrorNotice
              id="comment-error"
              key={commentError}
              message={commentError}
              onRetry={() => void handleSubmitComment()}
              pending={isSubmittingComment}
              retryLabel="Try posting comment again"
            />
          ) : null}

          <p className="mt-2 text-xs text-gray-500">Comments: {commentCount}</p>
        </div>
      </div>

      {menuOpen ? <PostOptions postId={post.id} open={menuOpen} onClose={() => setMenuOpen(false)} /> : null}
    </article>
  );
}

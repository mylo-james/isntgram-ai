"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient, type CommentView, type FeedPost } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import LikeButton from "@/components/posts/LikeButton";
import { useSession } from "next-auth/react";
import { postPlaceholderImage } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";
import { AiOutlineEllipsis } from "react-icons/ai";

function timeSince(iso: string): string {
  const timeStamp = new Date(iso);
  const now = new Date();

  const secondsPast = (now.getTime() - timeStamp.getTime()) / 1000;
  if (secondsPast < 60) return `${Math.max(0, Math.floor(secondsPast))}s`;
  if (secondsPast < 3600) return `${Math.floor(secondsPast / 60)}m`;
  if (secondsPast <= 86400) return `${Math.floor(secondsPast / 3600)}h`;

  const day = timeStamp.getDate();
  const month = timeStamp.toDateString().split(" ")[1] ?? "";
  const year = timeStamp.getFullYear() === now.getFullYear() ? "" : ` ${timeStamp.getFullYear()}`;
  return `${day} ${month}${year}`;
}

export default function PostDetail({
  postId,
  initialPost,
  initialComments,
}: {
  postId: string;
  initialPost?: FeedPost | null;
  initialComments?: CommentView[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = (session?.user as unknown as { id?: string } | undefined)?.id;
  const isDemoUser = Boolean(session?.user && (session.user as unknown as { isDemoUser?: boolean }).isDemoUser);

  const [post, setPost] = useState<FeedPost | null>(() => initialPost ?? null);
  const [loading, setLoading] = useState(() => !initialPost);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<CommentView[]>(() => initialComments ?? []);
  const [commentsLoading, setCommentsLoading] = useState(() => !initialComments);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const canDelete = useMemo(() => {
    if (!post || !currentUserId) return false;
    return post.author.id === currentUserId && !isDemoUser;
  }, [post, currentUserId, isDemoUser]);

  useEffect(() => {
    const run = async () => {
      if (initialPost) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.getPostById(postId);
        setPost(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load post");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [postId, initialPost]);

  useEffect(() => {
    const run = async () => {
      if (initialComments) return;
      setCommentsLoading(true);
      setCommentError(null);
      try {
        const res = await apiClient.getComments(postId, 1, 20);
        setComments(res.comments);
      } catch (err: unknown) {
        setCommentError(err instanceof Error ? err.message : "Failed to load comments");
      } finally {
        setCommentsLoading(false);
      }
    };

    void run();
  }, [postId, initialComments]);

  const onDelete = async () => {
    if (!canDelete || !post) return;
    setDeleting(true);
    setError(null);
    try {
      await apiClient.deletePost(post.id);
      router.push("/feed");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const onSubmitComment = async () => {
    const text = commentText.trim();
    if (!text || isDemoUser) return;

    setCommentSubmitting(true);
    setCommentError(null);
    try {
      const created = await apiClient.createComment(postId, text);
      setComments((prev) => [...prev, created]);
      setCommentText("");
      setPost((prev) => (prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev));
    } catch (err: unknown) {
      setCommentError(err instanceof Error ? err.message : "Failed to create comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const onDeleteComment = async (commentId: string) => {
    if (!post || !currentUserId || isDemoUser) return;
    setCommentError(null);
    try {
      await apiClient.deleteComment(post.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPost((prev) => (prev ? { ...prev, commentsCount: Math.max(prev.commentsCount - 1, 0) } : prev));
    } catch (err: unknown) {
      setCommentError(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[600px] bg-white px-4 py-6 text-sm text-gray-600 min-[640px]:rounded-[3px] min-[640px]:border min-[640px]:border-[#dfdfdf]">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[600px] rounded-[3px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!post) return null;

  const imageSrc = postPlaceholderImage(post.id);
  const profileHref = `/${post.author.username}`;
  const postHref = `/posts/${post.id}`;

  return (
    <article className="mx-auto w-full max-w-[600px] bg-white min-[640px]:rounded-[3px] min-[640px]:border min-[640px]:border-[#dfdfdf]">
      <div className="flex h-[60px] items-center justify-between px-4">
        <Link href={profileHref} className="flex items-center">
          <div className="flex h-[37px] w-[37px] items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {post.author.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.author.profilePictureUrl}
                alt="avatar"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-gray-700">
                {post.author.username.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="pl-[10px] text-[14px] font-semibold text-[#262626]">{post.author.username}</div>
        </Link>

        <div className="flex items-center gap-2">
          {canDelete ? (
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={deleting}
              aria-label="Delete post"
              className="rounded-[3px] border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
          <button type="button" className="m-0 border-0 bg-transparent p-0 text-[#262626]" aria-label="More options">
            <AiOutlineEllipsis size="2em" aria-hidden />
          </button>
        </div>
      </div>

      <Link href={postHref} aria-label="Open post" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="w-full object-cover" src={imageSrc} alt="feed-post" />
      </Link>

      <div className="flex h-[40px] items-center justify-between px-[10px] py-[5px]">
        <div className="flex items-center gap-3">
          <LikeButton
            postId={post.id}
            initialLiked={post.likedByMe}
            initialCount={post.likesCount}
            showCount={false}
            disabled={isDemoUser}
            onError={(m) => setError(m)}
            className="border-0 px-0 py-0 hover:bg-transparent"
          />
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="text-[14px] font-semibold text-[#262626]">{post.likesCount} likes</div>
        <div className="mt-1 text-[14px] text-[#262626]">
          <Link href={profileHref} className="pr-2 font-semibold">
            {post.author.username}
          </Link>
          {post.content}
        </div>

        <div className="mt-2 space-y-1">
          {commentError ? (
            <div className="rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {commentError}
            </div>
          ) : null}

          {commentsLoading ? (
            <div className="text-sm text-gray-600">Loading comments…</div>
          ) : comments.length === 0 ? null : (
            comments.map((c) => {
              const canDeleteComment = Boolean(currentUserId && c.author.id === currentUserId && !isDemoUser);
              return (
                <div key={c.id} className="flex items-start justify-between gap-3 text-[14px] leading-[18px]">
                  <div className="min-w-0 text-[#262626]">
                    <Link href={`/${c.author.username}`} className="pr-2 font-semibold">
                      {c.author.username}
                    </Link>
                    {c.text}
                  </div>
                  {canDeleteComment ? (
                    <button
                      type="button"
                      onClick={() => void onDeleteComment(c.id)}
                      className="shrink-0 rounded-[3px] border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-[5px] text-[11px] text-[#8e8e8e]">{timeSince(post.createdAt)}</div>
      </div>

      <div className="hidden border-t border-[#dfdfdf] px-4 py-3 min-[735px]:block">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmitComment();
          }}
          className="flex items-center gap-3"
        >
          <input
            aria-label="Add a comment"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={isDemoUser ? "Demo mode is read-only" : "Add a comment..."}
            disabled={isDemoUser}
            className="w-full flex-1 border-0 p-0 text-[14px] text-[#262626] outline-none placeholder:text-gray-400 disabled:bg-transparent"
          />
          <button
            type="submit"
            aria-label="Post comment"
            disabled={isDemoUser || commentSubmitting || commentText.trim().length === 0}
            className={cn(
              "border-0 bg-transparent p-0 text-[14px] font-semibold text-[#0095f5]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {commentSubmitting ? "Posting…" : "Post"}
          </button>
        </form>
      </div>

      {/* Keep the existing E2E selector working (link name "Open"). */}
      <Link href={postHref} className="sr-only">
        Open
      </Link>
    </article>
  );
}

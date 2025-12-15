"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setPostLikeAction } from "./like-actions";
import { RiHeartLine } from "react-icons/ri";

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
  disabled,
  onError,
  className,
  showCount = true,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  disabled?: boolean;
  onError?: (message: string) => void;
  className?: string;
  showCount?: boolean;
}) {
  const [base, setBase] = useState(() => ({ liked: initialLiked, count: initialCount }));
  const [optimistic, addOptimistic] = useOptimistic(base, (state, next: { liked: boolean }) => {
    if (next.liked === state.liked) return state;
    return {
      liked: next.liked,
      count: Math.max(state.count + (next.liked ? 1 : -1), 0),
    };
  });
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    if (disabled || isPending) return;

    const nextLiked = !optimistic.liked;
    startTransition(async () => {
      addOptimistic({ liked: nextLiked });
      try {
        const res = await setPostLikeAction(postId, nextLiked);
        setBase({ liked: res.likedByMe, count: res.likesCount });
      } catch (err: unknown) {
        setBase((prev) => ({ ...prev }));
        onError?.(err instanceof Error ? err.message : "Failed to update like");
      }
    });
  };

  const liked = optimistic.liked;
  const count = optimistic.count;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || isPending}
      aria-label={liked ? "Unlike post" : "Like post"}
      className={cn(
        "inline-flex items-center gap-2 border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <RiHeartLine size={24} aria-hidden className={cn(liked ? "text-[rgb(237,73,86)]" : "text-[#262626]")} />
      {showCount ? (
        <span className="tabular-nums">{count}</span>
      ) : (
        <span className="sr-only tabular-nums">{count}</span>
      )}
    </button>
  );
}

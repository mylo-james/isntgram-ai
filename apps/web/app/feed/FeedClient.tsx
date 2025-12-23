"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, FeedResponse, PostItem } from "@/lib/api-client";
import PostCard from "@/components/posts/PostCard";

interface FeedClientProps {
  initialFeed: FeedResponse;
}

export default function FeedClient({ initialFeed }: FeedClientProps) {
  const [items, setItems] = useState<PostItem[]>(initialFeed.items);
  const [nextCursor, setNextCursor] = useState(initialFeed.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);

    try {
      const response = await apiClient.getFeed({ cursor: nextCursor });
      setItems((prev) => [...prev, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more posts");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  useEffect(() => {
    if (!nextCursor) return;
    const el = sentinelRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        handleLoadMore();
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore, nextCursor]);

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6">
      <h1 className="sr-only">Feed</h1>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-sm border border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            Your feed is empty. Follow someone or post a photo to get started.
          </div>
        ) : (
          items.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div ref={sentinelRef} aria-hidden="true" className="h-1" />

      {isLoadingMore ? <p className="mt-6 text-center text-sm text-gray-500">Loading...</p> : null}

      {!nextCursor && items.length > 0 ? (
        <p className="mt-6 text-center text-sm text-gray-500">You&apos;re all caught up.</p>
      ) : null}
    </div>
  );
}

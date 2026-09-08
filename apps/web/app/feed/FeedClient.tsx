"use client";

import ErrorNotice from "@/components/ui/ErrorNotice";
import { userError } from "@/lib/user-error";

import { useCallback, useState } from "react";
import { apiClient, FeedResponse, PostItem } from "@/lib/api-client";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PostCard from "@/components/posts/PostCard";

interface FeedClientProps {
  initialFeed: FeedResponse;
}

export default function FeedClient({ initialFeed }: FeedClientProps) {
  const [items, setItems] = useState<PostItem[]>(initialFeed.items);
  const [nextCursor, setNextCursor] = useState(initialFeed.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);

    try {
      const response = await apiClient.getFeed({ cursor: nextCursor });
      setItems((prev) => [...prev, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (err) {
      setError(userError(err, "More posts couldn’t load. The posts above are still here. Try again."));
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  return (
    <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6">
      <div className="page-header">
        <h1 className="page-heading">Home</h1>
        <Link href="/upload" className="ui-primary">
          Create post
        </Link>
      </div>

      <div className="space-y-6">
        {items.length === 0 ? (
          <div className="social-surface p-8 text-center text-sm text-gray-600">
            <h2 className="text-lg font-semibold text-gray-900">No posts yet</h2>
            <p className="my-3 text-gray-700">Follow people to fill your feed.</p>
            <Link className="ui-action text-blue-700 underline" href="/explore">
              Find people
            </Link>
            <Link className="ui-action text-blue-700 underline" href="/upload">
              Create a post
            </Link>
          </div>
        ) : (
          items.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {error ? (
        <ErrorNotice key={error} message={error} onRetry={() => void handleLoadMore()} pending={isLoadingMore} />
      ) : null}
      {nextCursor && !error ? (
        <Button className="mt-6" variant="secondary" onClick={() => void handleLoadMore()} loading={isLoadingMore}>
          Load more posts
        </Button>
      ) : null}

      {isLoadingMore ? <p className="mt-6 text-center text-sm text-gray-500">Loading...</p> : null}

      {!nextCursor && items.length > 0 ? (
        <p className="mt-6 text-center text-sm text-gray-500">You&apos;re all caught up.</p>
      ) : null}
    </div>
  );
}

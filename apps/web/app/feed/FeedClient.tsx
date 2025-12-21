"use client";

import { useState } from "react";
import { apiClient, FeedResponse, PostItem } from "@/lib/api-client";
import PostComposer from "@/components/posts/PostComposer";
import PostCard from "@/components/posts/PostCard";

interface FeedClientProps {
  initialFeed: FeedResponse;
  isDemoUser?: boolean;
}

export default function FeedClient({ initialFeed, isDemoUser }: FeedClientProps) {
  const [items, setItems] = useState<PostItem[]>(initialFeed.items);
  const [nextCursor, setNextCursor] = useState(initialFeed.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePostCreated = (post: PostItem) => {
    setItems((prev) => [post, ...prev]);
  };

  const handleLoadMore = async () => {
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Daily Signal</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Your curated feed</h1>
            <p className="mt-2 text-sm text-slate-500">Posts from the people you follow and your own latest updates.</p>
          </div>

          <PostComposer onPostCreated={handlePostCreated} isDemoUser={isDemoUser} />

          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Your feed is empty. Create the first post or follow someone to get started.
              </div>
            ) : (
              items.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {nextCursor ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full rounded-full border border-slate-300 bg-white py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </div>

        <aside className="w-full max-w-sm space-y-6 lg:sticky lg:top-10 lg:h-fit">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Focus</h2>
            <p className="mt-3 text-sm text-slate-700">
              Keep your feed intentional. Post thoughtful updates, follow people you want to learn from, and build a
              signal-first network.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Quick tips</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Share one insight per day.</li>
              <li>• Use images to highlight key moments.</li>
              <li>• Keep posts under 2,000 characters.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

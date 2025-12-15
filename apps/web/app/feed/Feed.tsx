"use client";

import { useEffect, useState } from "react";
import { apiClient, type FeedPost, type FeedResponse } from "@/lib/api-client";
import InstagramPostCard from "@/components/posts/InstagramPostCard";

const PAGE_SIZE = 10;

export default function Feed({ initialFeed }: { initialFeed?: FeedResponse }) {
  const [posts, setPosts] = useState<FeedPost[]>(() => initialFeed?.posts ?? []);
  const [page, setPage] = useState(() => initialFeed?.pagination.page ?? 1);
  const [hasMore, setHasMore] = useState(() => initialFeed?.pagination.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextPage: number, replace = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getFeed(nextPage, PAGE_SIZE);
      setPosts((prev) => (replace ? res.posts : [...prev, ...res.posts]));
      setPage(res.pagination.page);
      setHasMore(res.pagination.hasMore);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialFeed) return;
    void load(1, true);
  }, [initialFeed]);

  return (
    <>
      {error ? (
        <div className="mb-4 w-full max-w-[600px] rounded-[3px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="flex w-full flex-col items-center">
        {posts.length === 0 && !loading ? (
          <div className="w-full max-w-[600px] bg-white px-4 py-6 text-sm text-gray-600 min-[640px]:rounded-[3px] min-[640px]:border min-[640px]:border-[#dfdfdf]">
            No posts yet. Create one from the Upload tab to get started.
          </div>
        ) : null}

        {posts.map((post) => (
          <InstagramPostCard key={post.id} post={post} variant="feed" />
        ))}
      </section>

      <div className="mt-2 flex justify-center pb-6">
        {hasMore ? (
          <button
            type="button"
            onClick={() => void load(page + 1)}
            disabled={loading}
            className="rounded-[3px] border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-semibold text-[#262626] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : posts.length > 0 ? (
          <div className="text-sm text-gray-500">You’re all caught up.</div>
        ) : null}
      </div>
    </>
  );
}

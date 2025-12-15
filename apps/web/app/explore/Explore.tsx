"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, type FeedPost, type SearchResponse, type UserSummary } from "@/lib/api-client";
import InstagramPostTile from "@/components/posts/InstagramPostTile";

const PAGE_SIZE = 12;

function toLabelCount(n: number, label: string): string {
  return `${n} ${label}${n === 1 ? "" : "s"}`;
}

export default function Explore() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ users: UserSummary[]; posts: FeedPost[] } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const loadExplore = async (nextPage: number, replace = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getExplore(nextPage, PAGE_SIZE);
      setPosts((prev) => (replace ? res.posts : [...prev, ...res.posts]));
      setPage(res.pagination.page);
      setHasMore(res.pagination.hasMore);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load explore feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExplore(1, true);
  }, []);

  const onSearchChange = async (value: string) => {
    setQuery(value);
    setSearchError(null);

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setSearchResults(null);
      return;
    }

    try {
      const res: SearchResponse = await apiClient.search(trimmed, "all", 1, 10);
      setSearchResults({ users: res.users, posts: res.posts });
    } catch (err: unknown) {
      setSearchResults({ users: [], posts: [] });
      setSearchError(err instanceof Error ? err.message : "Search failed");
    }
  };

  const showExploreGrid = !searchResults && query.trim().length === 0;

  return (
    <main className="pb-[54px] pt-[10px] min-[475px]:pb-0">
      <div className="mx-auto mb-[10px] w-[95vw] max-w-[614px] min-[614px]:px-0">
        <div className="flex justify-center min-[614px]:justify-start">
          <input
            name="search"
            placeholder="Search"
            value={query}
            onChange={(e) => void onSearchChange(e.target.value)}
            className="w-[200px] rounded-[3px] border border-[#dfdfdf] px-2 py-1 text-[14px] text-[#262626] outline-none placeholder:text-gray-500"
          />
        </div>
      </div>

      {showExploreGrid ? (
        <section className="mx-auto mb-[10vh] w-[95vw] max-w-[614px]">
          {error ? (
            <div className="mb-4 rounded-[3px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-[1vw]">
            {posts.map((post) => (
              <div key={post.id} className="aspect-square overflow-hidden">
                <InstagramPostTile post={post} />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            {hasMore ? (
              <button
                type="button"
                onClick={() => void loadExplore(page + 1)}
                disabled={loading}
                className="rounded-[3px] border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-semibold text-[#262626] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            ) : posts.length > 0 ? (
              <div className="text-sm text-gray-500">You’ve reached the end.</div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="mx-auto w-[95vw] max-w-[614px] pb-8">
          <div className="mb-[10px]">
            <h1 className="text-[16px] font-semibold text-[#262626]">
              {searchResults && searchResults.users.length + searchResults.posts.length === 0
                ? "No Results Found"
                : `Search Results for: ${query}`}
            </h1>
            {searchError ? <div className="mt-2 text-sm text-red-700">{searchError}</div> : null}
          </div>

          {searchResults ? (
            <div className="space-y-6">
              <div>
                <div className="mb-2 text-sm font-semibold text-gray-700">
                  Users ({toLabelCount(searchResults.users.length, "result")})
                </div>
                {searchResults.users.length === 0 ? (
                  <div className="text-sm text-gray-600">No users found.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {searchResults.users.map((u) => (
                      <Link
                        key={u.id}
                        href={`/${u.username}`}
                        className="rounded-[3px] border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#262626] hover:bg-gray-50"
                      >
                        <span className="font-semibold">{u.username}</span>{" "}
                        <span className="text-gray-600">{u.fullName}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-gray-700">
                  Posts ({toLabelCount(searchResults.posts.length, "result")})
                </div>
                {searchResults.posts.length === 0 ? (
                  <div className="text-sm text-gray-600">No posts found.</div>
                ) : (
                  <div className="grid grid-cols-3 gap-[1vw]">
                    {searchResults.posts.map((p) => (
                      <div key={p.id} className="aspect-square overflow-hidden">
                        <InstagramPostTile post={p} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}

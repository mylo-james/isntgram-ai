"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiClient, type PostItem, type UserSearchItem } from "@/lib/api-client";

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function ExploreClient({
  initialItems,
  initialCursor,
}: {
  initialItems: PostItem[];
  initialCursor?: string;
}) {
  const [items, setItems] = useState<PostItem[]>(initialItems ?? []);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiClient.searchUsers({ q, limit: 8 });
        setResults(response.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const rows = useMemo(
    () =>
      chunk(
        items.filter((post) => Boolean(post.mediaUrl)),
        3,
      ),
    [items],
  );

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const response = await apiClient.getExplore({ cursor: nextCursor });
      setItems((prev) => [...prev, ...(response.items ?? [])]);
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
    <div className="pt-2.5">
      <div className="relative mx-auto mb-2.5 w-[95vw] max-w-[614px] max-[614px]:flex max-[614px]:justify-center">
        <input
          name="search"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-[200px] rounded-sm border border-gray-300 px-2 py-1 transition-colors focus:border-gray-400 focus:outline-none"
          aria-label="Search users"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
        />

        {query.trim().length > 0 ? (
          <div className="absolute left-1/2 top-full z-20 mt-2 w-[200px] -translate-x-1/2 overflow-hidden rounded-sm border border-gray-200 bg-white shadow">
            {isSearching ? (
              <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No results.</div>
            ) : (
              <ul className="max-h-[260px] overflow-auto py-1">
                {results.map((user) => (
                  <li key={user.id}>
                    <Link href={`/${user.username}`} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.profilePictureUrl ?? "/assets/profile.jpeg"}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">{user.username}</div>
                        <div className="truncate text-xs text-gray-500">{user.fullName}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="mx-auto mb-[10vh] w-[95vw] max-w-[614px]">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">Nothing to explore yet.</p>
        ) : (
          <div className="space-y-[1vw]">
            {rows.map((row, rowIndex) => (
              <div
                // Matches legacy Explore/Layout1 row geometry.
                key={`row-${rowIndex}`}
                className="grid h-[calc(100vw/3)] max-h-[204px] grid-cols-[1fr_0.97fr_1fr] gap-[1vw] overflow-hidden"
              >
                {row.map((post, colIndex) => (
                  <Link
                    key={`img-${rowIndex}-${colIndex}`}
                    href={`/post/${post.id}`}
                    aria-label={`View post ${rowIndex * 3 + colIndex + 1}`}
                    className="block h-full w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="h-full w-full object-cover"
                      draggable={false}
                      src={post.mediaUrl ?? ""}
                      alt={post.content ?? ""}
                    />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div ref={sentinelRef} aria-hidden="true" className="h-1" />

        {isLoadingMore ? <p className="mt-6 text-center text-sm text-gray-500">Loading...</p> : null}

        {!nextCursor && rows.length > 0 ? (
          <p className="mt-6 text-center text-sm text-gray-600">Yay! You have seen it all</p>
        ) : null}
      </div>
    </div>
  );
}

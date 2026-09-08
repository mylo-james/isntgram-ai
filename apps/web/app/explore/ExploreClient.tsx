"use client";

import ErrorNotice from "@/components/ui/ErrorNotice";
import { userError } from "@/lib/user-error";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postDescription, postLinkLabel } from "@/lib/post-description";
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

  const [searchRetry, setSearchRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [isClientReady, setIsClientReady] = useState(false);
  const [results, setResults] = useState<UserSearchItem[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "success" | "empty" | "error">("idle");
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  useEffect(() => {
    const generation = searchGenerationRef.current + 1;
    searchGenerationRef.current = generation;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearchState("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setSearchState("loading");
      try {
        const response = await apiClient.searchUsers({ q, limit: 8 });
        if (searchGenerationRef.current !== generation) return;
        const nextResults = response.items ?? [];
        setResults(nextResults);
        setSearchState(nextResults.length === 0 ? "empty" : "success");
      } catch {
        if (searchGenerationRef.current !== generation) return;
        setResults([]);
        setSearchState("error");
      } finally {
        if (searchGenerationRef.current === generation) {
          setSearchState((state) => (state === "loading" ? "empty" : state));
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, searchRetry]);

  const searchStatus = !isClientReady
    ? "Preparing search…"
    : searchState === "loading"
      ? "Searching..."
      : searchState === "empty"
        ? "No results."
        : searchState === "success"
          ? results.length === 1
            ? "1 result available."
            : `${results.length} results available.`
          : "";

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
      setError(userError(err, "More photos couldn’t load. Your earlier results are still here. Try again."));
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  return (
    <div className="px-4 py-6">
      <h1 className="page-heading mx-auto mb-5 max-w-[614px]">Explore</h1>
      <div className="mx-auto mb-8 w-full max-w-[614px]">
        <label htmlFor="search-users" className="mb-2 block font-medium">
          Search people
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearchRetry((n) => n + 1);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            id="search-users"
            name="search"
            placeholder="Search"
            value={query}
            onChange={(event) => {
              if (!isClientReady) return;
              setQuery(event.target.value);
            }}
            disabled={!isClientReady}
            className="ui-field min-w-0 flex-1"
            aria-label="Search users"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="ui-action border border-gray-400" disabled={!isClientReady || !query.trim()} type="submit">
            Search
          </button>
          {query ? (
            <button className="ui-action" type="button" onClick={() => setQuery("")}>
              Clear search
            </button>
          ) : null}
        </form>
        <p className="mt-2 text-sm text-gray-700" role="status" aria-live="polite">
          {searchStatus}
        </p>

        {query.trim().length > 0 ? (
          <div className="mt-3 w-full rounded-md border border-gray-300 bg-white">
            {searchState === "loading" ? (
              <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
            ) : searchState === "error" ? (
              <ErrorNotice
                message="People couldn’t load. Your search is still here. Try again."
                onRetry={() => setSearchRetry((n) => n + 1)}
              />
            ) : searchState === "empty" ? (
              <div className="px-3 py-2 text-sm text-gray-500">No results.</div>
            ) : (
              <ul className="py-1">
                {results.map((user) => (
                  <li key={user.id}>
                    <Link href={`/${user.username}`} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={user.profilePictureUrl ?? "/assets/default-avatar.svg"}
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

      <div className="mx-auto mb-8 w-full max-w-[614px]">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            No photos yet. Search for people above or create the first photo post.
          </p>
        ) : (
          <div className="space-y-[1vw]">
            {rows.map((row, rowIndex) => (
              <div
                // Matches legacy Explore/Layout1 row geometry.
                key={`row-${rowIndex}`}
                className="grid grid-cols-3 gap-1"
              >
                {row.map((post, colIndex) => (
                  <Link
                    key={`img-${rowIndex}-${colIndex}`}
                    href={`/post/${post.id}`}
                    aria-label={postLinkLabel(post)}
                    className="block aspect-square w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="h-full w-full object-cover"
                      draggable={false}
                      src={post.mediaUrl ?? ""}
                      alt={postDescription(post)}
                    />
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}

        {error ? (
          <ErrorNotice key={error} message={error} onRetry={() => void handleLoadMore()} pending={isLoadingMore} />
        ) : null}
        {nextCursor && !error ? (
          <button
            className="ui-action mt-5 border border-gray-400"
            onClick={() => void handleLoadMore()}
            disabled={isLoadingMore}
          >
            Load more photos
          </button>
        ) : null}

        {isLoadingMore ? <p className="mt-6 text-center text-sm text-gray-500">Loading...</p> : null}

        {!nextCursor && rows.length > 0 ? (
          <p className="mt-6 text-center text-sm text-gray-600">You’ve seen all available photos.</p>
        ) : null}
      </div>
    </div>
  );
}

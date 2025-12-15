"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SearchBar from "@/components/search/SearchBar";
import PostContent from "@/components/posts/PostContent";
import { apiClient, FeedPost, UserSummary } from "@/lib/api-client";

export default function SearchPageClient() {
  const searchParams = useSearchParams();
  const q = useMemo(() => (searchParams.get("q") || "").trim(), [searchParams]);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!q) {
        setUsers([]);
        setPosts([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.search(q, "all", 1, 12);
        setUsers(res.users);
        setPosts(res.posts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [q]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Search</h1>
          <p className="mt-1 text-sm text-gray-600">
            Try searching for a user (e.g. <span className="font-medium">@demo</span>) or a hashtag (e.g.{" "}
            <span className="font-medium">#react</span>).
          </p>
        </div>
        <SearchBar initialQuery={q} />
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {!q ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Enter a search query to get started.
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Searching…</div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Users</h2>
              <div className="text-xs text-gray-500">{users.length} result(s)</div>
            </div>

            {users.length === 0 ? (
              <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
                No users found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/${u.username}`}
                    className="rounded-md border border-gray-200 bg-white p-4 hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{u.fullName}</div>
                    <div className="text-sm text-gray-600">@{u.username}</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Posts</h2>
              <div className="text-xs text-gray-500">{posts.length} result(s)</div>
            </div>

            {posts.length === 0 ? (
              <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
                No posts found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <article key={post.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/${post.author.username}`}
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          {post.author.fullName}
                        </Link>
                        <div className="text-xs text-gray-500">@{post.author.username}</div>
                      </div>
                      <Link
                        href={`/posts/${post.id}`}
                        className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Open
                      </Link>
                    </div>
                    <PostContent content={post.content} className="mt-3 line-clamp-4" />
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

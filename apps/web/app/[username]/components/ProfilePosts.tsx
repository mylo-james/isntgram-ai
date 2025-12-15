"use client";

import { useEffect, useState } from "react";
import { apiClient, type FeedPost } from "@/lib/api-client";
import InstagramPostTile from "@/components/posts/InstagramPostTile";

export default function ProfilePosts({ username }: { username: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.getUserPosts(username, 1, 12);
        setPosts(res.posts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [username]);

  if (error) {
    return (
      <div className="mx-auto mt-5 w-[95vw] max-w-[975px] rounded-[3px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <section className="mt-5 grid grid-cols-3 gap-1 pb-[53px] min-[735px]:gap-6 min-[735px]:pb-0">
      {loading ? (
        Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-[3px] border border-[#dfdfdf] bg-gray-50" />
        ))
      ) : posts.length === 0 ? (
        <div className="col-span-3 rounded-[3px] border border-[#dfdfdf] bg-white px-4 py-6 text-sm text-gray-600">
          No posts yet.
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="aspect-square overflow-hidden">
            <InstagramPostTile post={post} />
          </div>
        ))
      )}
    </section>
  );
}

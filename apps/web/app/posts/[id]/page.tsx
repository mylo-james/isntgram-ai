import { auth, type AppSession } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base-url";
import type { CommentsResponse, FeedPost } from "@/lib/api-client";
import { notFound, redirect } from "next/navigation";
import PostDetail from "./post-detail";

const COMMENTS_PAGE_SIZE = 20;

async function getPost(postId: string, accessToken: string): Promise<FeedPost> {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL(`/api/posts/${encodeURIComponent(postId)}`, apiBaseUrl);

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) notFound();
  if (!res.ok) {
    const message = await res
      .json()
      .catch(() => ({}))
      .then((body: unknown) => (body as { message?: string })?.message);
    throw new Error(message || `Failed to load post (${res.status})`);
  }

  return (await res.json()) as FeedPost;
}

async function getInitialComments(postId: string): Promise<CommentsResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL(`/api/posts/${encodeURIComponent(postId)}/comments`, apiBaseUrl);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(COMMENTS_PAGE_SIZE));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    // Comments are non-critical; fall back to empty list for resilience.
    return { comments: [], pagination: { page: 1, limit: COMMENTS_PAGE_SIZE, total: 0, hasMore: false } };
  }

  return (await res.json()) as CommentsResponse;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const isVisualTestMode = process.env.VISUAL_TEST_MODE === "true";
  if (isVisualTestMode) {
    return (
      <main className="mx-auto w-full max-w-[600px] px-0 pb-[54px] pt-5 min-[475px]:pb-0">
        <PostDetail postId={id} />
      </main>
    );
  }

  const session = (await auth()) as AppSession | null;
  const accessToken = session?.accessToken;
  if (!accessToken) redirect("/login");

  const [post, comments] = await Promise.all([getPost(id, accessToken), getInitialComments(id)]);

  return (
    <main className="mx-auto w-full max-w-[600px] px-0 pb-[54px] pt-5 min-[475px]:pb-0">
      <PostDetail postId={id} initialPost={post} initialComments={comments.comments} />
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import LegacyNav from "@/components/legacy/LegacyNav";
import { auth } from "@/lib/auth";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import PostDetailClient from "./PostDetailClient";

type PostPageProps = {
  params: { postId: string } | Promise<{ postId: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const postId = resolvedParams?.postId;
  if (typeof postId !== "string" || postId.trim().length === 0) {
    notFound();
  }

  const session = await auth();
  const accessToken = await getApiAccessToken();
  const requestId = await getRequestId();

  if (!session?.user?.id || !accessToken) {
    redirect(session?.user?.id ? "/login?reauth=1" : "/login");
  }

  const headers = { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId };

  const [
    { data: me, response: meResponse },
    { data: post, response: postResponse },
    { data: comments, response: commentsResponse },
  ] = await Promise.all([
    internalApi.GET("/api/users/me", { headers, cache: "no-store" }),
    internalApi.GET("/api/posts/{postId}", {
      params: { path: { postId } },
      headers,
      cache: "no-store",
    }),
    internalApi.GET("/api/posts/{postId}/comments", {
      params: { path: { postId }, query: { limit: 50 } },
      headers,
      cache: "no-store",
    }),
  ]);

  if (postResponse.status === 401 || commentsResponse.status === 401)
    redirect(session?.user?.id ? "/login?reauth=1" : "/login");
  if (postResponse.status === 404) notFound();
  if (!postResponse.ok || !post) throw new Error("Post unavailable");

  const avatarSrc = me?.profilePictureUrl ?? "/assets/default-avatar.svg";
  const profileHref =
    meResponse.ok && typeof me?.username === "string" && me.username.length > 0 ? `/${me.username}` : "/feed";

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main
        id="main-content"
        tabIndex={-1}
        className="social-page min-h-screen bg-[#fafafa]"
        style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 72px)" }}
      >
        <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6">
          <div className="page-header justify-start">
            <Link className="return-link -ml-2" href="/feed" aria-label="Back to Home">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m14 7-5 5 5 5" />
              </svg>
              Home
            </Link>
            <span className="h-5 w-px bg-gray-300" aria-hidden="true" />
            <h1 className="page-heading">Post</h1>
          </div>
          <PostDetailClient
            initialCommentsError={!commentsResponse.ok}
            post={post}
            initialComments={comments?.items ?? []}
            initialCursor={comments?.nextCursor}
          />
        </div>
      </main>
    </>
  );
}

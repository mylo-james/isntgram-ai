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
    redirect("/login");
  }

  const headers = { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId };

  const [{ data: me, response: meResponse }, { data: post, response: postResponse }, { data: comments }] =
    await Promise.all([
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

  if (!postResponse.ok || !post) {
    notFound();
  }

  const avatarSrc = me?.profilePictureUrl ?? "/assets/default-avatar.svg";
  const profileHref =
    meResponse.ok && typeof me?.username === "string" && me.username.length > 0 ? `/${me.username}` : "/feed";

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main className="min-h-screen bg-[#fafafa]" style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 54px)" }}>
        <div className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6">
          <PostDetailClient post={post} initialComments={comments?.items ?? []} initialCursor={comments?.nextCursor} />
        </div>
      </main>
    </>
  );
}

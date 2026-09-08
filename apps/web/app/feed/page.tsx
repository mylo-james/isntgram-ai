import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FeedClient from "./FeedClient";
import { getApiAccessToken, getRequestId, internalApi } from "@/lib/server-api";
import type { FeedResponse } from "@/lib/api-client";
import LegacyNav from "@/components/legacy/LegacyNav";

const FEED_REQUEST_TIMEOUT_MS = 5_000;

function isFeedResponse(value: unknown): value is FeedResponse {
  return typeof value === "object" && value !== null && Array.isArray((value as FeedResponse).items);
}

async function requestWithinDeadline<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      request(controller.signal),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Feed request timed out"));
        }, FEED_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function FeedLoadError() {
  return (
    <section className="mx-auto w-full max-w-[600px] px-4 pb-10 pt-6" aria-live="polite">
      <div role="alert" className="rounded-sm border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
        <p>We couldn&apos;t load your feed. Please try again.</p>
        {/* A native anchor deliberately reloads the server page instead of reusing stale client props. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- retry must force a document navigation. */}
        <a href="/feed" className="mt-3 inline-block font-medium underline">
          Retry feed
        </a>
      </div>
    </section>
  );
}

export default async function FeedPage() {
  const session = await auth();
  const accessToken = await getApiAccessToken();
  const requestId = await getRequestId();

  if (!session?.user?.id || !accessToken) {
    redirect("/login");
  }

  const headers = { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId };
  const getFeed = (signal: AbortSignal) => internalApi.GET("/api/posts/feed", { headers, cache: "no-store", signal });
  let initialFeed: FeedResponse | null = null;
  let feedResponse: Awaited<ReturnType<typeof getFeed>> | null = null;

  try {
    feedResponse = await requestWithinDeadline(getFeed);
  } catch {
    // The error surface below deliberately treats transport and deadline failures alike.
  }

  if (feedResponse?.response.status === 401) {
    redirect("/login");
  }

  if (feedResponse?.response.ok && isFeedResponse(feedResponse.data)) {
    initialFeed = feedResponse.data;
  }

  if (!initialFeed) {
    return (
      <main className="min-h-screen bg-[#fafafa]" style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 54px)" }}>
        <FeedLoadError />
      </main>
    );
  }

  let avatarSrc = "/assets/default-avatar.svg";
  let profileHref = "/feed";
  try {
    const me = await requestWithinDeadline((signal) =>
      internalApi.GET("/api/users/me", { headers, cache: "no-store", signal }),
    );
    if (me.response.ok && typeof me.data?.profilePictureUrl === "string") {
      avatarSrc = me.data.profilePictureUrl;
    }
    if (me.response.ok && typeof me.data?.username === "string" && me.data.username.length > 0) {
      profileHref = `/${me.data.username}`;
    }
  } catch {
    // Profile decoration is optional and must not hide a valid feed.
  }

  return (
    <>
      <LegacyNav avatarSrc={avatarSrc} profileHref={profileHref} />
      <main className="min-h-screen bg-[#fafafa]" style={{ paddingTop: "calc(var(--demo-banner-height, 0px) + 54px)" }}>
        <FeedClient initialFeed={initialFeed} />
      </main>
    </>
  );
}

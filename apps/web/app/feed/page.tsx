import { auth, type AppSession } from "@/lib/auth";
import type { FeedResponse } from "@/lib/api-client";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { redirect } from "next/navigation";
import Feed from "./Feed";

const PAGE_SIZE = 10;

async function getInitialFeed(accessToken: string): Promise<FeedResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const url = new URL("/api/posts/feed", apiBaseUrl);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(PAGE_SIZE));

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const message = await response
      .json()
      .catch(() => ({}))
      .then((body: unknown) => (body as { message?: string })?.message);

    throw new Error(message || `Failed to load feed (${response.status})`);
  }

  return (await response.json()) as FeedResponse;
}

export default async function FeedPage() {
  const isVisualTestMode = process.env.VISUAL_TEST_MODE === "true";
  if (isVisualTestMode) {
    return (
      <main className="flex w-full flex-col items-center pb-[54px] pt-5 min-[475px]:pb-0">
        <Feed />
      </main>
    );
  }

  const session = (await auth()) as AppSession | null;
  const accessToken = session?.accessToken;
  if (!accessToken) redirect("/login");

  const initialFeed = await getInitialFeed(accessToken);
  return (
    <main className="flex w-full flex-col items-center pb-[54px] pt-5 min-[475px]:pb-0">
      <Feed initialFeed={initialFeed} />
    </main>
  );
}

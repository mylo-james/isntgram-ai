import { NextResponse } from "next/server";
import { getApiAccessToken, internalApi } from "@/lib/server-api";

export async function GET(request: Request) {
  const accessToken = await getApiAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = url.searchParams.get("limit");
  const parsedLimit = limit ? Number(limit) : undefined;

  const { data, error, response } = await internalApi.GET("/api/posts/feed", {
    params: {
      query: {
        cursor,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      },
    },
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return NextResponse.json(data ?? error ?? {}, { status: response.status });
}

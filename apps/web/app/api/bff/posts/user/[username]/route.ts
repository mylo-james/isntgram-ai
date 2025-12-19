import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";

interface Params {
  params: Promise<{ username: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { username } = await params;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = url.searchParams.get("limit");
  const parsedLimit = limit ? Number(limit) : undefined;

  const { data, error, response } = await internalApi.GET("/api/posts/user/{username}", {
    params: {
      path: { username },
      query: {
        cursor,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      },
    },
  });

  return NextResponse.json(data ?? error ?? {}, { status: response.status });
}

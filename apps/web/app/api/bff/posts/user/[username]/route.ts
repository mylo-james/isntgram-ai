import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId } from "@/lib/bff";

interface Params {
  params: Promise<{ username: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const { username } = await params;
  const normalizedUsername = username.trim().toLowerCase();
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = url.searchParams.get("limit");
  const parsedLimit = limit ? Number(limit) : undefined;

  const { data, error, response } = await internalApi.GET("/api/posts/user/{username}", {
    params: {
      path: { username: normalizedUsername },
      query: {
        cursor,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      },
    },
    headers: { "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

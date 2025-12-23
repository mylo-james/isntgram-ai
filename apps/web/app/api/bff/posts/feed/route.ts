import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth } from "@/lib/bff";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

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
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

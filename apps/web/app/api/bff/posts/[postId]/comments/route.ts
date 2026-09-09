import { NextResponse } from "next/server";
import { getApiAccessToken, internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth, requireCsrf } from "@/lib/bff";

interface Params {
  params: Promise<{ postId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const { postId } = await params;
  const normalizedPostId = postId.trim();
  const accessToken = await getApiAccessToken();

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = url.searchParams.get("limit");
  const parsedLimit = limit ? Number(limit) : undefined;

  const { data, error, response } = await internalApi.GET("/api/posts/{postId}/comments", {
    params: {
      path: { postId: normalizedPostId },
      query: {
        cursor,
        limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      },
    },
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "x-request-id": requestId,
    },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

export async function POST(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  const { postId } = await params;
  const normalizedPostId = postId.trim();

  let body;
  try {
    body = await request.json();
  } catch {
    return attachRequestId(NextResponse.json({ message: "Invalid JSON body" }, { status: 400 }), requestId);
  }
  const { data, error, response } = await internalApi.POST("/api/posts/{postId}/comments", {
    params: { path: { postId: normalizedPostId } },
    body,
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

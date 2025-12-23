import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth, requireCsrf } from "@/lib/bff";

interface Params {
  params: Promise<{ postId: string; commentId: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  const { postId, commentId } = await params;
  const normalizedPostId = postId.trim();
  const normalizedCommentId = commentId.trim();

  const { data, error, response } = await internalApi.POST("/api/posts/{postId}/comments/{commentId}/like", {
    params: { path: { postId: normalizedPostId, commentId: normalizedCommentId } },
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  const { postId, commentId } = await params;
  const normalizedPostId = postId.trim();
  const normalizedCommentId = commentId.trim();

  const { data, error, response } = await internalApi.DELETE("/api/posts/{postId}/comments/{commentId}/like", {
    params: { path: { postId: normalizedPostId, commentId: normalizedCommentId } },
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

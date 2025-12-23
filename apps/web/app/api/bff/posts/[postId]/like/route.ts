import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth, requireCsrf } from "@/lib/bff";

interface Params {
  params: Promise<{ postId: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  const { postId } = await params;
  const normalizedPostId = postId.trim();

  const { data, error, response } = await internalApi.POST("/api/posts/{postId}/like", {
    params: { path: { postId: normalizedPostId } },
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

  const { postId } = await params;
  const normalizedPostId = postId.trim();

  const { data, error, response } = await internalApi.DELETE("/api/posts/{postId}/like", {
    params: { path: { postId: normalizedPostId } },
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

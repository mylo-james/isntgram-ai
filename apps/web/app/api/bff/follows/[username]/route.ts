import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth, requireCsrf } from "@/lib/bff";

interface Params {
  params: Promise<{ username: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  const { username } = await params;
  const normalizedUsername = username.trim().toLowerCase();
  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  const { data, error, response } = await internalApi.POST("/api/follows/{username}", {
    params: {
      path: { username: normalizedUsername },
    },
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  const { username } = await params;
  const normalizedUsername = username.trim().toLowerCase();
  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  const { data, error, response } = await internalApi.DELETE("/api/follows/{username}", {
    params: {
      path: { username: normalizedUsername },
    },
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

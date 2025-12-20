import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth } from "@/lib/bff";

interface Params {
  params: Promise<{ username: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const { username } = await params;
  const normalizedUsername = username.trim().toLowerCase();
  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  const { data, error, response } = await internalApi.GET("/api/follows/{username}/status", {
    params: {
      path: { username: normalizedUsername },
    },
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

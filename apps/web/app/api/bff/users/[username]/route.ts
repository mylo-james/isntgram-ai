import { NextResponse } from "next/server";
import { getApiAccessToken, internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId } from "@/lib/bff";

interface Params {
  params: Promise<{ username: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const requestId = getRequestId(request);
  const { username } = await params;
  const normalizedUsername = username.trim().toLowerCase();
  const accessToken = await getApiAccessToken();
  const { data, error, response } = await internalApi.GET("/api/users/{username}", {
    params: {
      path: { username: normalizedUsername },
    },
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "x-request-id": requestId,
    },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

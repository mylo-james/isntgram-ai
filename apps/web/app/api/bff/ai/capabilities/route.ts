import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth } from "@/lib/bff";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);
  const { data, error, response } = await internalApi.GET("/api/ai/capabilities", {
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });
  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

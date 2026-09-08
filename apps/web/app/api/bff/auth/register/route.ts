import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireCsrf } from "@/lib/bff";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  let body;
  try {
    body = await request.json();
  } catch {
    return attachRequestId(NextResponse.json({ message: "Invalid JSON body" }, { status: 400 }), requestId);
  }

  const { data, error, response } = await internalApi.POST("/api/auth/register", {
    body,
    headers: { "x-request-id": requestId },
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

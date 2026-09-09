import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth, requireCsrf } from "@/lib/bff";

export async function PUT(request: Request) {
  const requestId = getRequestId(request);
  const csrfError = await requireCsrf(request);
  if (csrfError) return attachRequestId(csrfError, requestId);

  const accessToken = await requireApiAuth();
  if (accessToken instanceof Response) return attachRequestId(accessToken, requestId);

  let body;
  try {
    body = await request.json();
  } catch {
    return attachRequestId(NextResponse.json({ message: "Invalid JSON body" }, { status: 400 }), requestId);
  }

  const { data, error, response } = await internalApi.PUT("/api/users/profile", {
    body,
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";
import { attachRequestId, getRequestId, requireApiAuth, requireCsrf } from "@/lib/bff";

export async function POST(request: Request) {
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
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    (body.mediaAltText !== undefined && (typeof body.mediaAltText !== "string" || body.mediaAltText.length > 1000))
  ) {
    return attachRequestId(
      NextResponse.json({ message: "Photo description must be text of up to 1,000 characters." }, { status: 400 }),
      requestId,
    );
  }
  const { data, error, response } = await internalApi.POST("/api/posts", {
    body,
    headers: { Authorization: `Bearer ${accessToken}`, "x-request-id": requestId },
    cache: "no-store",
  });

  return attachRequestId(NextResponse.json(data ?? error ?? {}, { status: response.status }), requestId);
}

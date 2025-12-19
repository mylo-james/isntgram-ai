import { NextResponse } from "next/server";
import { getApiAccessToken, internalApi } from "@/lib/server-api";

export async function POST(request: Request) {
  const accessToken = await getApiAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, error, response } = await internalApi.POST("/api/posts", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return NextResponse.json(data ?? error ?? {}, { status: response.status });
}

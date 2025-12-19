import { NextResponse } from "next/server";
import { getApiAccessToken, internalApi } from "@/lib/server-api";

export async function GET() {
  const accessToken = await getApiAccessToken();

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error, response } = await internalApi.GET("/api/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return NextResponse.json(data ?? error ?? {}, { status: response.status });
}

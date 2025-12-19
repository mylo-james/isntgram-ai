import { NextResponse } from "next/server";
import { getApiAccessToken, internalApi } from "@/lib/server-api";

interface Params {
  params: Promise<{ username: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { username } = await params;
  const accessToken = await getApiAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error, response } = await internalApi.GET("/api/follows/{username}/status", {
    params: {
      path: { username },
    },
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return NextResponse.json(data ?? error ?? {}, { status: response.status });
}

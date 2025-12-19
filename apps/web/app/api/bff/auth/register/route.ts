import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";

export async function POST(request: Request) {
  const body = await request.json();

  const { data, error, response } = await internalApi.POST("/api/auth/register", {
    body,
  });

  return NextResponse.json(data ?? error ?? {}, { status: response.status });
}

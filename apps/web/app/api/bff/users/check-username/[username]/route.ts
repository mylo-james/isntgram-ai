import { NextResponse } from "next/server";
import { internalApi } from "@/lib/server-api";

interface Params {
  params: Promise<{ username: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { username } = await params;
  const { data, error, response } = await internalApi.GET("/api/users/check-username/{username}", {
    params: {
      path: { username },
    },
  });

  return NextResponse.json(data ?? error ?? {}, { status: response.status });
}

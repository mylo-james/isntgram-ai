import "server-only";
import { headers } from "next/headers";
import { getToken, type JWT } from "next-auth/jwt";
import createClient from "openapi-fetch";
import type { ApiPaths } from "@isntgram-ai/shared-types";

type AppJwtToken = JWT & { accessToken?: string };

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const internalApi = createClient<ApiPaths>({ baseUrl: API_BASE_URL });

export async function getApiAccessToken(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  const reqHeaders = await headers();
  const token = (await getToken({
    req: { headers: reqHeaders },
    secret,
  })) as AppJwtToken | null;

  return token?.accessToken ?? null;
}

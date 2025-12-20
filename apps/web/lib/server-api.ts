import "server-only";
import { headers } from "next/headers";
import { getToken, type JWT } from "next-auth/jwt";
import createClient from "openapi-fetch";
import type { ApiPaths } from "@isntgram-ai/shared-types";

type AppJwtToken = JWT & { accessToken?: string };

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const internalApi = createClient<ApiPaths>({ baseUrl: API_BASE_URL });

function getJwtExpirySeconds(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const exp = getJwtExpirySeconds(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSeconds;
}

export async function getApiAccessToken(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  const reqHeaders = await headers();
  const token = (await getToken({
    req: { headers: reqHeaders },
    secret,
  })) as AppJwtToken | null;

  const accessToken = token?.accessToken ?? null;
  if (!accessToken) return null;
  if (isJwtExpired(accessToken)) return null;
  return accessToken;
}

export async function getRequestId(): Promise<string> {
  const reqHeaders = await headers();
  const incoming = reqHeaders.get("x-request-id");
  if (incoming && incoming.trim().length > 0) return incoming;
  return crypto.randomUUID();
}

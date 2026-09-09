import "server-only";
import { headers, cookies } from "next/headers";
import { createHmac } from "crypto";
import { isIP } from "node:net";
import { getToken, type JWT } from "next-auth/jwt";
import createClient from "openapi-fetch";
import type { ApiPaths } from "@isntgram-ai/shared-types";

type AppJwtToken = JWT & { accessToken?: string };

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function signedVisitorHeaders(source: Headers, method: string, pathname: string): HeadersInit {
  if (process.env.VERCEL !== "1") return {};
  const secret = process.env.BFF_PROXY_SECRET;
  const address = source.get("x-vercel-forwarded-for")?.trim();
  if (!secret || secret.length < 32 || !address || isIP(address.replace(/^\[|\]$/g, "")) === 0) return {};
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}\n${method.toUpperCase()}\n${pathname}\n${address}`)
    .digest("hex");
  return {
    "x-isntgram-client-address": address,
    "x-isntgram-client-timestamp": timestamp,
    "x-isntgram-client-signature": signature,
  };
}

const internalFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const source = await headers();
  const outbound = new Headers(request.headers);
  for (const [name, value] of Object.entries(
    signedVisitorHeaders(source, request.method, new URL(request.url).pathname),
  )) {
    outbound.set(name, value);
  }
  return fetch(new Request(request, { headers: outbound }));
};

export const internalApi = createClient<ApiPaths>({ baseUrl: API_BASE_URL, fetch: internalFetch });

function getJwtExpirySeconds(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload !== "object" || payload === null || !("exp" in payload)) return null;
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const exp = getJwtExpirySeconds(token);
  if (exp === null) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSeconds;
}

export async function getApiAccessToken(): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  const reqHeaders = await headers();
  const reqCookies = await cookies();

  const token = (await getToken({
    // `getToken` expects a Next.js/Node request object. In the App Router we only
    // have access to `headers()`/`cookies()`, so provide the subsets it needs.
    req: {
      headers: reqHeaders,
      cookies: reqCookies,
    } as unknown as Parameters<typeof getToken>[0]["req"],
    secret,
  })) as AppJwtToken | null;

  const accessToken = token?.accessToken ?? null;
  if (typeof accessToken !== "string" || !accessToken) return null;
  if (isJwtExpired(accessToken)) return null;
  return accessToken;
}

export async function getRequestId(): Promise<string> {
  const reqHeaders = await headers();
  const incoming = reqHeaders.get("x-request-id");
  if (incoming && incoming.trim().length > 0) return incoming;
  return crypto.randomUUID();
}

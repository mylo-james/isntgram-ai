import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiAccessToken } from "@/lib/server-api";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_TOKEN_TTL_MS,
  isStateChangingMethod,
  parseCsrfToken,
} from "@/lib/csrf";

function buildAllowedOrigins(request: Request): string[] {
  const allowed = new Set<string>();

  if (process.env.NEXTAUTH_URL) {
    try {
      allowed.add(new URL(process.env.NEXTAUTH_URL).origin);
    } catch {
      // ignore malformed env
    }
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
    } catch {
      // ignore malformed env
    }
  }

  const host = request.headers.get("host");
  if (host) {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    allowed.add(`${protocol}://${host}`);
  }

  return [...allowed];
}

function isSameOrigin(request: Request): boolean {
  const allowed = buildAllowedOrigins(request);
  if (allowed.length === 0) return true;

  const origin = request.headers.get("origin");
  if (origin) {
    return allowed.includes(origin);
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return allowed.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}

export async function requireCsrf(request: Request): Promise<NextResponse | null> {
  if (!isStateChangingMethod(request.method)) return null;

  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json({ message: "Invalid CSRF token" }, { status: 403 });
  }

  const parsed = parseCsrfToken(csrfCookie);
  if (!parsed || Date.now() - parsed.issuedAt > CSRF_TOKEN_TTL_MS) {
    return NextResponse.json({ message: "Expired CSRF token" }, { status: 403 });
  }

  return null;
}

export function getRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  if (incoming && incoming.trim().length > 0) return incoming;
  return crypto.randomUUID();
}

export function attachRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set("x-request-id", requestId);
  return response;
}

export async function requireApiAuth(): Promise<string | NextResponse> {
  const accessToken = await getApiAccessToken();
  if (!accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return accessToken;
}

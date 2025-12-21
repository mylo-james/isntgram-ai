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

  const addEnvOrigin = (value: string | undefined) => {
    if (!value) return;
    try {
      allowed.add(new URL(value).origin);
    } catch {
      // ignore malformed env
    }
  };

  addEnvOrigin(process.env.NEXTAUTH_URL);
  addEnvOrigin(process.env.NEXT_PUBLIC_APP_URL);

  // In production, require an explicit allowlist (NEXTAUTH_URL / NEXT_PUBLIC_APP_URL)
  // so CSRF protection fails closed if configuration is missing.
  if ((process.env.NODE_ENV ?? "development") !== "production") {
    const host = request.headers.get("host");
    if (host) {
      allowed.add(`http://${host}`);
    }
  }

  return [...allowed];
}

function isSameOrigin(request: Request, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true;
  const origin = request.headers.get("origin");
  if (origin) {
    return allowedOrigins.includes(origin);
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return allowedOrigins.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}

export async function requireCsrf(request: Request): Promise<NextResponse | null> {
  if (!isStateChangingMethod(request.method)) return null;

  const allowedOrigins = buildAllowedOrigins(request);
  if ((process.env.NODE_ENV ?? "development") === "production" && allowedOrigins.length === 0) {
    return NextResponse.json({ message: "CSRF protection misconfigured" }, { status: 500 });
  }

  if (!isSameOrigin(request, allowedOrigins)) {
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

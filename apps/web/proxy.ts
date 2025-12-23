import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CSRF_COOKIE_NAME, CSRF_TOKEN_TTL_MS, parseCsrfToken } from "@/lib/csrf";

function shouldUseSecureCookies(request: NextRequest): boolean {
  if ((process.env.NODE_ENV ?? "development") !== "production") return false;

  const hostname = request.nextUrl.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;

  if (request.nextUrl.protocol === "https:") return true;

  // Support common proxy setups where TLS is terminated before Next.js.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    const first = forwardedProto.split(",")[0]?.trim().toLowerCase();
    return first === "https";
  }

  return false;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value}.${Date.now()}`;
}

function shouldRotateToken(existing: string | undefined): boolean {
  if (!existing) return true;
  const parsed = parseCsrfToken(existing);
  if (!parsed) return true;
  return Date.now() - parsed.issuedAt > CSRF_TOKEN_TTL_MS;
}

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const response = NextResponse.next();

  if (shouldRotateToken(existing)) {
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: generateToken(),
      httpOnly: false,
      sameSite: "lax",
      secure: shouldUseSecureCookies(request),
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

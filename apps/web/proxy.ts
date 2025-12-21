import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CSRF_COOKIE_NAME, CSRF_TOKEN_TTL_MS, parseCsrfToken } from "@/lib/csrf";

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
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

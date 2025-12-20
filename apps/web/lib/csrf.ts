export const CSRF_COOKIE_NAME = "isntgram-csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export function isStateChangingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookieValue = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!cookieValue) return null;

  return decodeURIComponent(cookieValue.split("=")[1] ?? "");
}

export function parseCsrfToken(token: string): { value: string; issuedAt: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt)) return null;
  return { value: parts[0], issuedAt };
}

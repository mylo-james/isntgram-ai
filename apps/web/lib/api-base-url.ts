export function getApiBaseUrl(): string {
  const internal = process.env.INTERNAL_API_URL;
  if (internal) return internal;

  const publicBase = process.env.NEXT_PUBLIC_API_URL;
  if (publicBase) return publicBase;

  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) {
    try {
      return new URL(nextAuthUrl).origin;
    } catch {
      return nextAuthUrl;
    }
  }

  return "http://localhost:3001";
}

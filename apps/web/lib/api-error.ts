export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim().length > 0) return msg;
  }

  return fallback;
}

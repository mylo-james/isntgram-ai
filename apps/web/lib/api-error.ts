export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error && typeof error === "object") {
    if ("errors" in error) {
      const errors = (error as { errors?: unknown }).errors;
      if (Array.isArray(errors) && errors.every((entry) => typeof entry === "string") && errors.length > 0) {
        return errors[0] ?? fallback;
      }
    }

    if ("message" in error) {
      const msg = (error as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim().length > 0) return msg;
      if (Array.isArray(msg) && msg.every((entry) => typeof entry === "string") && msg.length > 0) {
        return msg[0] ?? fallback;
      }
    }
  }

  return fallback;
}

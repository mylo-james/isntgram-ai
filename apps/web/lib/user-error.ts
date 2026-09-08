import { ApiRequestError } from "./api-error";

export function userError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return "Your session has expired. Log in again to continue.";
    if (error.status === 403)
      return "You don’t have permission to complete this action. Your changes have not been saved.";
    if (error.status === 429) return "Too many attempts. Wait a moment, then try again. Your entries are still here.";
  }
  return fallback;
}

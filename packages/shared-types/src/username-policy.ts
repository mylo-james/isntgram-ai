/** Static application routes that cannot be claimed as public profile names. */
export const RESERVED_USERNAMES = Object.freeze([
  "_next",
  "api",
  "auth",
  "explore",
  "feed",
  "health",
  "login",
  "notifications",
  "post",
  "register",
  "upload",
] as const);

const reservedUsernameSet = new Set<string>(RESERVED_USERNAMES);

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isReservedUsername(value: string): boolean {
  return reservedUsernameSet.has(normalizeUsername(value));
}

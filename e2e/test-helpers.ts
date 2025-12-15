export function makeUniqueId(): string {
  // Keep IDs short so usernames stay within API validation limits (<= 30 chars).
  // Base36 keeps it URL/username safe (a-z0-9).
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${timePart}${randomPart}`;
}


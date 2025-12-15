function escapeXml(input: string): string {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function svgDataUri(label: string, bg: string, fg: string): string {
  const safeLabel = escapeXml(label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect width="100%" height="100%" fill="${bg}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="48" fill="${fg}">
        ${safeLabel}
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function hashString(input: string): number {
  // djb2
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

const POST_PALETTE = [
  { bg: "#fef9c3", fg: "#854d0e" }, // yellow
  { bg: "#e0f2fe", fg: "#0c4a6e" }, // sky
  { bg: "#ede9fe", fg: "#4c1d95" }, // violet
  { bg: "#dcfce7", fg: "#14532d" }, // green
  { bg: "#fce7f3", fg: "#9d174d" }, // pink
] as const;

export function postPlaceholderImage(postId: string): string {
  const numeric = Number.parseInt(postId, 10);
  const isPlainInt = Number.isFinite(numeric) && String(numeric) === postId;
  const idx = isPlainInt
    ? (((numeric - 101) % POST_PALETTE.length) + POST_PALETTE.length) % POST_PALETTE.length
    : hashString(postId) % POST_PALETTE.length;
  const { bg, fg } = POST_PALETTE[idx] ?? POST_PALETTE[0];
  const label = postId.length <= 12 ? `Post ${postId}` : `Post ${postId.slice(0, 8)}`;
  return svgDataUri(label, bg, fg);
}

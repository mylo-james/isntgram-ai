/** @type {import('next').NextConfig} */
const defaultMediaHosts = "localhost:9000,127.0.0.1:9000,cdn.isntgram.ai,picsum.photos";
const rawMediaHosts = process.env.NEXT_PUBLIC_MEDIA_HOSTS || defaultMediaHosts;
const localMedia = process.env.NODE_ENV === "development" && process.env.ISNTGRAM_LOCAL_MEDIA === "true";
const configuredAppOrigin = process.env.NEXT_PUBLIC_APP_URL;
let allowedDevOrigins;
if (localMedia && configuredAppOrigin?.startsWith("https:")) {
  const origin = new URL(configuredAppOrigin);
  if (origin.origin !== configuredAppOrigin || !origin.hostname.endsWith(".ts.net") ||
      origin.username || origin.password || origin.search || origin.hash) {
    throw new Error("Invalid private development origin");
  }
  allowedDevOrigins = [origin.hostname];
}

const mediaPatterns = rawMediaHosts
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      const hasProtocol = value.includes("://");
      const url = new URL(
        hasProtocol
          ? value
          : `${value.includes("localhost") || value.startsWith("127.0.0.1") ? "http" : "https"}://${value}`,
      );
      return {
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
        port: url.port || undefined,
        pathname: "/**",
      };
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const nextConfig = {
  turbopack: {},
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  images: {
    // Local published bytes already pass the API decoder. Let the browser load
    // them directly without opening Next's optimizer to private network fetches.
    unoptimized: localMedia,
    remotePatterns: mediaPatterns.length > 0 ? mediaPatterns : undefined,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

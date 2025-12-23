/** @type {import('next').NextConfig} */
const defaultMediaHosts = "localhost:9000,127.0.0.1:9000,cdn.isntgram.ai,picsum.photos";
const rawMediaHosts = process.env.NEXT_PUBLIC_MEDIA_HOSTS || defaultMediaHosts;

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
  images: {
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

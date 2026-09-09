import portfolioEmbed from "./portfolio-embed-config.cjs";
const portfolioOrigin = portfolioEmbed.portfolioEmbedOrigin(process.env);
/** @type {import('next').NextConfig} */
const defaultMediaHosts = "localhost:9000,127.0.0.1:9000,cdn.isntgram.ai,picsum.photos";
const deploymentEnv = process.env.DEPLOYMENT_ENV || "development";
const rawMediaHosts = process.env.NEXT_PUBLIC_MEDIA_HOSTS || (deploymentEnv === "development" ? defaultMediaHosts : "");
if (["preview", "production"].includes(deploymentEnv) && !rawMediaHosts) {
  throw new Error("Public deployments require exact NEXT_PUBLIC_MEDIA_HOSTS");
}
const isolatedLocalTest = deploymentEnv === "local-test" && process.env.NEXT_PUBLIC_APP_URL === "http://127.0.0.1:4520" && portfolioOrigin === "http://127.0.0.1:4510";
if (deploymentEnv === "local-test" && !isolatedLocalTest) throw new Error("Invalid isolated browser-test origins");
const localMedia = isolatedLocalTest || (process.env.NODE_ENV === "development" && process.env.ISNTGRAM_LOCAL_MEDIA === "true");
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
  devIndicators: portfolioOrigin ? false : undefined,
  turbopack: {},
  env: {
    NEXT_PUBLIC_PORTFOLIO_ORIGIN: portfolioOrigin,
    NEXT_PUBLIC_DEPLOYMENT_DEMO: ["preview", "production", "local-test"].includes(deploymentEnv) ? "true" : "false",
  },
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
          ...portfolioEmbed.portfolioFrameHeaders(portfolioOrigin),
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

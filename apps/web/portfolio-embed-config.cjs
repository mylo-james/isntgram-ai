function portfolioEmbedOrigin(env) {
  const raw = env.ISNTGRAM_PORTFOLIO_ORIGIN;
  if (!raw) return "";
  if (env.NEXT_PUBLIC_DEMO_ENABLED !== "true") {
    throw new Error("Portfolio embedding requires the demo environment");
  }
  const url = new URL(raw);
  const deployment = env.DEPLOYMENT_ENV || "development";
  const app = new URL(env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:4320");
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const privateHost = url.protocol === "https:" && url.hostname.endsWith(".ts.net") && url.hostname === app.hostname;
  const expected = deployment === "production"
    ? { parent: ["https://mjames.dev", "https://www.mjames.dev"], child: "https://isntgram.mjames.dev" }
    : deployment === "preview"
      ? { parent: ["https://preview.mjames.dev"], child: "https://isntgram-preview.mjames.dev" }
      : null;
  const localTest = deployment === "local-test" && raw === "http://127.0.0.1:4510" && app.origin === "http://127.0.0.1:4520";
  const privatePreview = deployment === "development" && env.NODE_ENV === "development" && (loopback || privateHost);
  const approvedDeployment = expected && expected.parent.includes(raw) && app.origin === expected.child;
  if ((!approvedDeployment && !privatePreview && !localTest) || url.origin !== raw || url.username || url.password || url.search || url.hash) {
    throw new Error("Portfolio embedding requires an exact approved notebook origin");
  }
  return url.origin;
}

function portfolioFrameHeaders(origin) {
  return origin
    ? [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${origin}` }]
    : [{ key: "X-Frame-Options", value: "DENY" }];
}

module.exports = { portfolioEmbedOrigin, portfolioFrameHeaders };

import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { assertNoTestDotenv } = require("./scripts/test-env.cjs") as {
  assertNoTestDotenv: (directory: string) => void;
};
assertNoTestDotenv(root);

// TA06: the legacy AppModule uses a fresh in-memory SQLite database under NODE_ENV=test.
// Each native child starts with an explicit environment, never inherited v1 credentials.
const nodeBin = path.join(path.dirname(root), "001-verifiable-local-journey/.local/journey/tools/node-v24.20.0-darwin-arm64/bin");
const webOrigin = "http://127.0.0.1:3100";
const apiOrigin = "http://127.0.0.1:4011";
const reportDirectory = path.join(root, ".local/v1/evidence/legacy-a11y", randomUUID());
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const environment = {
  HOME: process.env.HOME || "/Users/io",
  PATH: `${nodeBin}:/usr/bin:/bin:/usr/sbin:/sbin`,
  LC_ALL: "C", LANG: "C", TMPDIR: process.env.TMPDIR || "/tmp",
  NEXT_TELEMETRY_DISABLED: "1",
};
const command = (variables: Record<string, string>, entry: string, args: string[]) =>
  ["env", "-i", ...Object.entries({ ...environment, ...variables }).map(([key, value]) => `${key}=${quote(value)}`),
    quote(path.join(nodeBin, "node")), quote(entry), ...args.map(quote)].join(" ");

export default defineConfig({
  testDir: "./e2e", testMatch: "a11y.test.ts", fullyParallel: false,
  workers: 1, retries: 0, forbidOnly: true, timeout: 90_000,
  outputDir: path.join(reportDirectory, "artifacts"),
  reporter: [["list"], ["json", { outputFile: path.join(reportDirectory, "results.json") }]],
  use: {
    ...devices["Desktop Chrome"], channel: "chrome", baseURL: webOrigin,
    viewport: { width: 1280, height: 900 }, headless: true,
    trace: "off", video: "off", screenshot: "off",
  },
  webServer: [
    {
      command: command({
        NODE_ENV: "test", HOST: "127.0.0.1", PORT: "4011",
        JWT_SECRET: "test_jwt_secret_for_e2e_only", JWT_EXPIRES_IN: "7d",
        CORS_ORIGIN: webOrigin, DEMO_ENABLED: "false", AI_PROVIDER: "mock",
        METRICS_ENABLED: "false", REQUEST_LOGGING: "false",
      }, "dist/main.js", []),
      cwd: path.join(root, "apps/api"), url: `${apiOrigin}/api/ready`,
      reuseExistingServer: false, timeout: 60_000, stdout: "ignore", stderr: "pipe",
    },
    {
      command: command({
        NODE_ENV: "production", HOST: "127.0.0.1", PORT: "3100",
        NEXTAUTH_URL: webOrigin, NEXT_PUBLIC_APP_URL: webOrigin,
        NEXTAUTH_SECRET: "test_secret_for_e2e_only", AUTH_SECRET: "test_secret_for_e2e_only",
        NEXT_PUBLIC_API_URL: apiOrigin, INTERNAL_API_URL: apiOrigin,
        NEXT_PUBLIC_DEMO_ENABLED: "false", AI_PROVIDER: "mock",
      }, "node_modules/next/dist/bin/next", ["start", "--hostname", "127.0.0.1", "--port", "3100"]),
      cwd: path.join(root, "apps/web"), url: `${webOrigin}/login`,
      reuseExistingServer: false, timeout: 60_000, stdout: "ignore", stderr: "pipe",
    },
  ],
});

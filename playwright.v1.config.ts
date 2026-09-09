import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const require = createRequire(import.meta.url);
const config = require("./apps/api/scripts/v1/config.cjs") as {
  STATE: string;
  load: () => { webOrigin: string; phoneView?: { webOrigin: string } };
};

// Loading the guarded configuration validates checkout and private-config shape.
// It does not start, reuse, or stop an application process.
const runtime = config.load();
const runId = randomUUID();

export default defineConfig({
  testDir: "./v1-e2e",
  testMatch: "core-journey.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 90_000,
  outputDir: path.join(config.STATE, "evidence", "v1-e2e", runId, "artifacts"),
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: runtime.phoneView?.webOrigin ?? runtime.webOrigin,
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "off",
    video: "off",
    screenshot: "off",
  },
});

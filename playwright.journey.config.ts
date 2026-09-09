import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const require = createRequire(import.meta.url);
const { JOURNEY, loadPrivateEnvironment } = require("./apps/api/scripts/journey/config.cjs") as {
  JOURNEY: { evidenceDirectory: string };
  loadPrivateEnvironment: () => {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_APP_URL: string;
  };
};

// This command is intentionally private-config-only. It neither starts nor reuses services.
const environment = loadPrivateEnvironment();
const evidenceDirectory = JOURNEY.evidenceDirectory;

export default defineConfig({
  testDir: "./journey-e2e",
  testMatch: "local-journey.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 90_000,
  outputDir: path.join(evidenceDirectory, "playwright-artifacts"),
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: environment.NEXT_PUBLIC_APP_URL,
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

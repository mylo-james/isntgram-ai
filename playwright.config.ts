import fs from "node:fs";
import { defineConfig, devices, firefox } from "@playwright/test";

const webPort = process.env.E2E_WEB_PORT || "3100";
const webBaseUrl = process.env.E2E_WEB_URL || `http://127.0.0.1:${webPort}`;
const apiPort = process.env.E2E_API_PORT || "4011";
const apiBaseUrl = process.env.E2E_API_URL || `http://127.0.0.1:${apiPort}`;
const configuredWorkers = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : undefined;
const defaultWorkers = 1; // SQLite :memory: in the API is not safe under parallel write load.
const workers =
  Number.isFinite(configuredWorkers) && (configuredWorkers as number) > 0
    ? (configuredWorkers as number)
    : defaultWorkers;

process.env.E2E_WEB_PORT = webPort;
process.env.E2E_WEB_URL = webBaseUrl;
process.env.E2E_API_PORT = apiPort;
process.env.E2E_API_URL = apiBaseUrl;

const hasFirefox = fs.existsSync(firefox.executablePath());
if (!process.env.CI && !hasFirefox) {
  console.warn(
    "[playwright] Firefox not installed; skipping Firefox project. Run `pnpm exec playwright install firefox`.",
  );
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Keep local runs deterministic by default. Opt into concurrency via PW_WORKERS. */
  workers,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: webBaseUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot only on failures */
    screenshot: "only-on-failure",

    /* Record video only on failures */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: process.env.CI
    ? [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        ...(hasFirefox
          ? [
              {
                name: "firefox",
                use: { ...devices["Desktop Firefox"] },
              },
            ]
          : []),
        /* Test against mobile viewports. */
        {
          name: "Mobile Chrome",
          use: { ...devices["Pixel 5"] },
        },
      ],

  /* Run your local dev servers before starting the tests */
  webServer: [
    {
      command: `PORT=${webPort} pnpm --filter web start`,
      url: webBaseUrl,
      // Default to deterministic runs. Opt into reuse with PW_REUSE_EXISTING_SERVER=true.
      reuseExistingServer: process.env.PW_REUSE_EXISTING_SERVER === "true" && !process.env.CI,
      timeout: 300 * 1000,
      stdout: "ignore",
      stderr: "ignore",
      env: {
        NEXTAUTH_URL: webBaseUrl,
        NEXTAUTH_SECRET: "test_secret_for_e2e_only",
        AUTH_SECRET: "test_secret_for_e2e_only",
        NEXT_PUBLIC_DEMO_ENABLED: "true",
        NEXT_PUBLIC_DEMO_EMAIL: "demo@isntgram.ai",
        NEXT_PUBLIC_DEMO_PASSWORD: "demo",
        NEXT_PUBLIC_API_URL: apiBaseUrl,
        INTERNAL_API_URL: apiBaseUrl,
        E2E_API_URL: apiBaseUrl,
      },
    },
    {
      command: `NODE_ENV=test PORT=${apiPort} pnpm --filter api start:prod`,
      url: `${apiBaseUrl}/api`,
      reuseExistingServer: process.env.PW_REUSE_EXISTING_SERVER === "true" && !process.env.CI,
      timeout: 300 * 1000,
      stdout: "ignore",
      stderr: "ignore",
      env: {
        JWT_SECRET: "test_jwt_secret_for_e2e_only",
        JWT_EXPIRES_IN: "7d",
        DEMO_ENABLED: "true",
        E2E_API_URL: apiBaseUrl,
        S3_ENDPOINT: "http://127.0.0.1:9000",
        S3_PUBLIC_BASE_URL: "http://127.0.0.1:9000/isntgram-e2e",
        S3_BUCKET: "isntgram-e2e",
        S3_REGION: "us-east-1",
        S3_ACCESS_KEY_ID: "e2e-access",
        S3_SECRET_ACCESS_KEY: "e2e-secret-for-disposable-tests",
        MEDIA_ALLOWED_HOSTS: "127.0.0.1:9000,picsum.photos",
      },
    },
  ],
});

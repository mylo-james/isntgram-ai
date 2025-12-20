import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.E2E_API_PORT || "4011";
const apiBaseUrl = process.env.E2E_API_URL || `http://127.0.0.1:${apiPort}`;

process.env.E2E_API_PORT = apiPort;
process.env.E2E_API_URL = apiBaseUrl;

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
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/results.xml" }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://127.0.0.1:3000",

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
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        /* Test against mobile viewports. */
        {
          name: "Mobile Chrome",
          use: { ...devices["Pixel 5"] },
        },
      ],

  /* Run your local dev servers before starting the tests */
  webServer: [
    {
      command: "PORT=3000 pnpm --filter web start",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 300 * 1000,
      stdout: "ignore",
      stderr: "ignore",
      env: {
        NEXTAUTH_URL: "http://127.0.0.1:3000",
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
      reuseExistingServer: !process.env.CI,
      timeout: 300 * 1000,
      stdout: "ignore",
      stderr: "ignore",
      env: {
        JWT_SECRET: "test_jwt_secret_for_e2e_only",
        JWT_EXPIRES_IN: "7d",
        DEMO_ENABLED: "true",
        E2E_API_URL: apiBaseUrl,
      },
    },
  ],
});

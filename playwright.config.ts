import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://localhost:3000",

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
      // Use direct command so Playwright owns and reliably stops the server
      command: "cd apps/web && PORT=3000 pnpm exec next start",
      url: "http://localhost:3000",
      reuseExistingServer: false,
      timeout: 300 * 1000,
      stdout: "ignore",
      stderr: "ignore",
      env: {
        NEXTAUTH_URL: "http://localhost:3000",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "development_only_do_not_use_in_prod",
        AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "development_only_do_not_use_in_prod",
        NEXT_PUBLIC_API_URL: "http://localhost:3001",
        NEXT_PUBLIC_DEMO_EMAIL: process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@isntgram.ai",
        NEXT_PUBLIC_DEMO_PASSWORD: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "changeme",
      },
    },
    {
      // Start NestJS directly to avoid npm wrapper processes lingering
      command: "cd apps/api && NODE_ENV=test PORT=3001 node dist/main",
      url: "http://localhost:3001/api",
      reuseExistingServer: false,
      timeout: 300 * 1000,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-visual",
  testMatch: ["web.vs-react-app.test.ts"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "playwright-report/web-visual-results.json" }],
  ],
  snapshotPathTemplate: "e2e-visual/react-app.screenshots.test.ts-snapshots/{arg}{-projectName}{-platform}.png",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      'bash -lc "cd apps/web && pnpm run build && rm -rf .next/standalone/apps/web/.next/static && mkdir -p .next/standalone/apps/web/.next && cp -R .next/static .next/standalone/apps/web/.next/ && PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/apps/web/server.js"',
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 300 * 1000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "test",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "development_only_do_not_use_in_prod",
      AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "development_only_do_not_use_in_prod",
      NEXT_PUBLIC_API_URL: "",
      INTERNAL_API_URL: "",
      VISUAL_TEST_MODE: "true",
      NEXT_PUBLIC_VISUAL_TEST_MODE: "true",
      NEXT_PUBLIC_VISUAL_TEST_USERNAME: "demo_user",
    },
  },
});


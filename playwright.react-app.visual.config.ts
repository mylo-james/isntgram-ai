import { defineConfig, devices } from "@playwright/test";

const REACT_APP_PORT = Number.parseInt(process.env.REACT_APP_VISUAL_PORT ?? "4173", 10);
const reactAppBaseUrl = `http://localhost:${REACT_APP_PORT}`;

export default defineConfig({
  testDir: "./e2e-visual",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "playwright-report/react-app-visual-results.json" }],
  ],
  use: {
    baseURL: reactAppBaseUrl,
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
    command: `bash -lc "cd react-app && (test -d node_modules || npm ci) && npm run build && node ../scripts/serve-spa.mjs --dir build --port ${REACT_APP_PORT}"`,
    url: reactAppBaseUrl,
    reuseExistingServer: false,
    timeout: 300 * 1000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      SKIP_PREFLIGHT_CHECK: "true",
      NODE_OPTIONS: "--openssl-legacy-provider",
    },
  },
});


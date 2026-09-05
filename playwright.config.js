// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";

/**
 * E2E defaults for __APP_NAME__ (SaaS scaffold).
 * Set PLAYWRIGHT_BASE_URL when testing against staging.
 */
module.exports = defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    storageState: process.env.PLAYWRIGHT_STORAGE ? process.env.PLAYWRIGHT_STORAGE : undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer:
    process.env.CI || process.env.PLAYWRIGHT_SKIP_WEBSERVER
      ? undefined
      : {
          command: process.env.PW_DEV_COMMAND || "npm run dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120000,
        },
});

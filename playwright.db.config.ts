import { defineConfig, devices } from "@playwright/test";

/**
 * DB-backed E2E suite.
 *
 * Runs against a real local Supabase stack (see scripts/e2e-db-server.sh)
 * instead of the fixture smoke mode, so it exercises the real schema, RLS
 * policies, and RPC functions. Run with `npm run test:e2e:db`.
 */
export default defineConfig({
  testDir: "./e2e/db",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  outputDir: "output/playwright/db-test-results",
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.PLAYWRIGHT_DISABLE_VIDEO ? "off" : "retain-on-failure",
  },
  webServer: {
    command: "bash scripts/e2e-db-server.sh",
    url: "http://localhost:3101",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL,
      },
    },
  ],
});

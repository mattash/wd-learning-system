import { defineConfig, devices } from "@playwright/test";

/**
 * DB-backed E2E suite.
 *
 * Runs against a real local Supabase stack (see scripts/e2e-db-server.sh)
 * instead of the fixture smoke mode, exercising the real schema,
 * constraints, foreign keys, RPC functions, and the app's own parish-scoping
 * logic. Note: the app connects with the service-role key, which bypasses
 * RLS, so RLS policies themselves are not exercised here.
 * Run with `npm run test:e2e:db`.
 */
export default defineConfig({
  testDir: "./e2e/db",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // First navigation compiles the dev-server route tree; give it headroom.
  timeout: 60_000,
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
    // Always run the script so the DB is reset/seeded before each run,
    // rather than silently reusing a possibly-stale 3101 server.
    reuseExistingServer: false,
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

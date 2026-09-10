import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * The phase 12 smoke suite.
 *
 * Runs against a production build rather than the dev server: middleware,
 * redirects and route handlers behave differently under `next dev`, and those
 * are exactly what these tests assert. Reusing an already-running server
 * locally keeps the loop fast; CI always starts its own.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

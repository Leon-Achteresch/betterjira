import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "1420";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  workers: 2,
  timeout: 35_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.E2E_BROWSER_CHANNEL ?? "msedge",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "narrow-dark-reduced", use: { ...devices["Desktop Chrome"], viewport: { width: 760, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" } },
  ],
  webServer: { command: `bun run dev --host 127.0.0.1 --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true },
});

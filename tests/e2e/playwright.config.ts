import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against production builds of the student web app (:3000)
 * and admin dashboard (:3001), both in demo/sandbox mode (no Supabase needed).
 * Build first: pnpm --filter @campusnav/web build && pnpm --filter @campusnav/admin build
 */
export default defineConfig({
  testDir: "./specs",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, testMatch: /student\..*\.spec\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /(admin|security)\..*\.spec\.ts/ },
  ],
  webServer: [
    { command: "pnpm --filter @campusnav/web start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 60_000 },
    { command: "pnpm --filter @campusnav/admin start", url: "http://localhost:3001", reuseExistingServer: true, timeout: 60_000 },
  ],
});

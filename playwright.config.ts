import { defineConfig, devices } from "@playwright/test";

// End-to-end tests of the QA Hub itself. Locally they run against the dev server
// (E2E_BASE_URL=http://localhost:3000 npm run e2e); in CI against a production build.
const CI = Boolean(process.env.CI);
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  // The tests share one seeded database, so they run one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, dependencies: ["setup"], testIgnore: /phone\.spec\.ts/ },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false }, dependencies: ["setup"], testMatch: /phone\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run start -- -p ${port}`, url: `${baseURL}/login`, reuseExistingServer: !CI, timeout: 120_000 },
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    reuseExistingServer: true,
    env: {
      // The browser suite drives the paid endpoints as a visitor, with no
      // mailbox to read a sign-in code from. Running the test server with the
      // gate open keeps these journeys about the product; the gate has its own
      // unit, contract and acceptance coverage, and production is unaffected —
      // an unset AUTH_MODE still means "required".
      AUTH_MODE: "disabled",
      RATE_LIMIT_DISABLED: "true",
    },
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});

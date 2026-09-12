import { defineConfig, devices } from "@playwright/test";

// Runs against an already-running stack; never starts a server of its own, so a
// second checkout's dev server can never be reused by mistake.
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});

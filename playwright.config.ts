import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8080";
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== "false";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 8080",
    url: baseURL,
    reuseExistingServer,
    timeout: 120000,
  },
});

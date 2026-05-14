import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:5180",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx vite --port 5180",
    port: 5180,
    reuseExistingServer: false,
    timeout: 15000,
  },
});

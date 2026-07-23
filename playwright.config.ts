import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm --workspace @greenlight/api run dev",
      url: "http://127.0.0.1:4000/api/v1/health",
      reuseExistingServer: !process.env.CI,
      env: {
        GREENLIGHT_ADMIN_TOKEN: "playwright-admin",
        GITHUB_TOKEN: "playwright-github-token",
        GITHUB_REPOSITORY: "demo/lms",
        SIGNOZ_API_KEY: "playwright-signoz",
        LMS_PATH: "/tmp/lms",
      },
    },
    {
      command: "npm --workspace @greenlight/web run preview",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
  ],
});

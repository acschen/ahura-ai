import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-iphone",
      use: {
        ...devices["iPhone 14"],
        // Use Chromium engine with iPhone viewport/UA
        browserName: "chromium",
      },
    },
    {
      name: "mobile-iphone-landscape",
      use: {
        ...devices["iPhone 14 landscape"],
        browserName: "chromium",
      },
    },
    {
      name: "mobile-android",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
      },
    },
    {
      name: "tablet-ipad",
      use: {
        ...devices["iPad (gen 7)"],
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30000,
  },
});

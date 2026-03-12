import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

/**
 * PR-Test-Agent Playwright Configuration
 * Copied and simplified from automation-tests-2.0
 */
dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  // Test directories - includes both mcpTests and e2e
  testDir: "./",
  testMatch: ["mcpTests/**/*.spec.ts", "e2e/**/*.spec.ts"],
  
  /* Run tests in files in parallel */
  fullyParallel: false,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use */
  reporter: [["html", { open: "never" }], ["list"]],

  /* Shared settings for all the projects below */
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "https://staging.rocketium.com",
    trace: "on-first-retry",
    video: {
      mode: "retain-on-failure",
      size: { width: 1280, height: 720 },
    },
    screenshot: "only-on-failure",
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  
  /* Configure projects */
  projects: [
    {
      name: "mcp-tests",
      testDir: "./mcpTests",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
    {
      name: "e2e",
      testDir: "./e2e",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
  
  /* Output directory */
  outputDir: "test-results/",

  /* Snapshot configuration */
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}",

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 3500,
      threshold: 0.2,
    },
  },

  /* Test timeout */
  timeout: 300000,
});

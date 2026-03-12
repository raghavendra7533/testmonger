import { Browser, BrowserContext, expect, Page, test } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3001";

/**
 * Auto-generated E2E test for 142
 * PR: [ACME-142] Fix: dashboard stat delta colour always showing green
 * PR #1 in raghavendra7533/sample-saas-app
 * Files changed: 2 (+5 -1)
 * Bug fix type: title-detected
 * Affected features: settings, design-system
 * Generated: 2026-02-27T18:46:48.147Z
 */

test.describe.serial("142: [ACME-142] Fix: dashboard stat delta colour always showing green", () => {
  let context: BrowserContext;
  let sharedPage: Page;

  test.setTimeout(120000);

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    sharedPage = await context.newPage();
    sharedPage.setDefaultTimeout(15000);
    sharedPage.setDefaultNavigationTimeout(30000);

    // LocalStorage-based auth
    await sharedPage.goto(BASE_URL);
    await sharedPage.evaluate(() => {
      localStorage.setItem("acme_session", "{\"user\":{\"name\":\"Demo User\",\"email\":\"demo@acme.com\",\"role\":\"admin\"},\"loggedIn\":true}");
    });
    await sharedPage.reload();
    await sharedPage.waitForLoadState("networkidle");
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("142 - Verify PR changes", async () => {

    // Feature: settings
    await sharedPage.goto(BASE_URL + "/pages/settings.html");
    await sharedPage.waitForLoadState("networkidle");

    // Feature: design-system

    // Verify related selectors from PR diff
    await expect(sharedPage.locator('[data-testid="alert-threshold-input"]')).toBeVisible();
    await expect(sharedPage.locator('[data-testid="save-notifications-btn"]')).toBeVisible();

    // Visual regression screenshot
    await expect(sharedPage).toHaveScreenshot("142-verify.png", {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test("Cleanup and verify no console errors", async () => {
    const errors: string[] = [];
    sharedPage.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await sharedPage.goto(BASE_URL);
    await sharedPage.waitForLoadState("networkidle");

    // Allow some known console errors (e.g., third-party scripts)
    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("third-party")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

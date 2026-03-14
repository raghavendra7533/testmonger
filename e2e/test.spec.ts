import { test, expect, BrowserContext, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3001/sample-saas-app";

test.describe.serial("ACME-142 Dashboard and Settings Verification", () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;
  const consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    sharedPage = await sharedContext.newPage();
    sharedPage.setDefaultTimeout(15000);
    sharedPage.setDefaultNavigationTimeout(30000);

    sharedPage.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate directly to BASE_URL
    await sharedPage.goto(`${BASE_URL}/`);
    await sharedPage.waitForLoadState("networkidle");
  });

  test("Verify stat delta colors and settings constraints", async () => {
    // 1. Verify Dashboard Stat Delta Fix
    await sharedPage.goto(`${BASE_URL}/pages/dashboard.html`);
    await sharedPage.waitForLoadState("networkidle");

    const ticketDelta = sharedPage.locator('[data-cy="stat-tickets-delta"]');
    await expect(ticketDelta).toBeVisible();
    
    // Verify the fix: upward trend for tickets should be negative (red)
    await expect(ticketDelta).toHaveClass(/negative/);
    
    // Verify CSS specificity fix (color: #c53030 -> rgb(197, 48, 48))
    await expect(ticketDelta).toHaveCSS("color", "rgb(197, 48, 48)");
    await expect(ticketDelta).toHaveCSS("font-weight", "500");

    // 2. Verify Settings Threshold Constraints
    await sharedPage.goto(`${BASE_URL}/pages/settings.html`);
    await sharedPage.waitForLoadState("networkidle");

    const thresholdInput = sharedPage.locator('[data-cy="alert-threshold-input"]');
    const saveBtn = sharedPage.locator('[data-cy="save-notifications-btn"]');

    await expect(thresholdInput).toBeVisible();
    await expect(saveBtn).toBeVisible();

    // Verify min/max attributes added in PR
    await expect(thresholdInput).toHaveAttribute("min", "1");
    await expect(thresholdInput).toHaveAttribute("max", "100");

    // Visual regression check
    await expect(sharedPage).toHaveScreenshot("settings-page-validation.png");
  });

  test("Cleanup and console error check", async () => {
    await sharedPage.goto(`${BASE_URL}/`);
    await sharedPage.waitForLoadState("networkidle");

    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("third-party") &&
        !e.includes("404") &&
        !e.includes("Failed to load resource")
    );

    expect(criticalErrors, `Found critical console errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });
});
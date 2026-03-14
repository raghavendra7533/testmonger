import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3001/sample-saas-app";

test.describe.serial("ACME-142 Dashboard Stat Delta and Settings Constraints", () => {
  let context: BrowserContext;
  let sharedPage: Page;
  const errors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    sharedPage = await context.newPage();
    
    // Set timeouts as per requirements
    sharedPage.setDefaultTimeout(15000);
    sharedPage.setDefaultNavigationTimeout(30000);

    // Monitor console errors for cleanup test
    sharedPage.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    sharedPage.on("pageerror", (err) => {
      errors.push(err.message);
    });

    // Authentication Setup: No auth — navigate directly to BASE_URL
    await sharedPage.goto(BASE_URL);
    await sharedPage.waitForLoadState("networkidle");
  });

  test("Verify stat delta colors and settings input constraints", async () => {
    // 1. Verify Dashboard Stat Delta Fix
    await sharedPage.goto(`${BASE_URL}/pages/dashboard.html`);
    await sharedPage.waitForLoadState("networkidle");

    const ticketDelta = sharedPage.locator('[data-cy="stat-tickets-delta"]');
    await expect(ticketDelta).toBeVisible();
    
    // Verify the fix: upward trend for tickets should be negative (red)
    // CSS specificity fix check: color #c53030 is rgb(197, 48, 48)
    await expect(ticketDelta).toHaveClass(/negative/);
    await expect(ticketDelta).toHaveCSS("color", "rgb(197, 48, 48)");
    await expect(ticketDelta).toHaveCSS("font-weight", "500");

    // 2. Verify Settings Input Constraints
    await sharedPage.goto(`${BASE_URL}/pages/settings.html`);
    await sharedPage.waitForLoadState("networkidle");

    const thresholdInput = sharedPage.locator('[data-cy="alert-threshold-input"]');
    const saveBtn = sharedPage.locator('[data-cy="save-notifications-btn"]');

    await expect(thresholdInput).toBeVisible();
    await expect(saveBtn).toBeVisible();

    // Verify min/max attributes added in PR
    await expect(thresholdInput).toHaveAttribute("min", "1");
    await expect(thresholdInput).toHaveAttribute("max", "100");

    // Visual Regression Check
    await expect(sharedPage).toHaveScreenshot("dashboard-settings-validation.png");
  });

  test("Cleanup and console error check", async () => {
    await sharedPage.goto(BASE_URL);
    await sharedPage.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) => 
        !e.includes("favicon") && 
        !e.includes("third-party") && 
        !e.includes("404") && 
        !e.includes("Failed to load resource")
    );

    expect(criticalErrors, `Found critical console errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
  });

  test.afterAll(async () => {
    await context.close();
  });
});
import { test, expect, BrowserContext, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";

test.describe.serial("ACME-142 Dashboard Stat Delta and Settings Constraints", () => {
  let context: BrowserContext;
  let sharedPage: Page;
  const errors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    sharedPage = await context.newPage();
    sharedPage.setDefaultTimeout(15000);
    sharedPage.setDefaultNavigationTimeout(30000);

    sharedPage.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    sharedPage.on("pageerror", (err) => errors.push(err.message));

    // No auth — navigate directly to BASE_URL
    await sharedPage.goto(BASE_URL);
    await sharedPage.waitForLoadState("networkidle");
  });

  test("Verify dashboard stat delta colors and settings input constraints", async () => {
    // 1. Verify Dashboard Fix: Open Tickets delta should be negative (red)
    // Navigating to the affected feature area
    await sharedPage.goto(`${BASE_URL}/pages/dashboard.html`);
    await sharedPage.waitForLoadState("networkidle");

    const ticketDelta = sharedPage.locator('[data-cy="stat-tickets-delta"]');
    await expect(ticketDelta).toBeVisible();
    
    // Test specific behavior: Apply .negative class to [data-testid="stat-tickets-delta"]
    // Note: Using data-cy as per selector convention instructions
    await expect(ticketDelta).toHaveClass(/negative/);
    
    // Test specific behavior: Increase specificity of .stat-delta.negative rules
    // #c53030 translates to rgb(197, 48, 48)
    const color = await ticketDelta.evaluate((el) => window.getComputedStyle(el).color);
    expect(color).toBe("rgb(197, 48, 48)");

    // 2. Verify Settings Fix: Alert Threshold input constraints
    // Navigating to the affected feature area
    await sharedPage.goto(`${BASE_URL}/pages/settings.html`);
    await sharedPage.waitForLoadState("networkidle");

    const thresholdInput = sharedPage.locator('[data-cy="alert-threshold-input"]');
    const saveBtn = sharedPage.locator('[data-cy="save-notifications-btn"]');

    await expect(thresholdInput).toBeVisible();
    await expect(saveBtn).toBeVisible();
    
    // Test specific behavior: Add min=1 max=100 constraints
    await expect(thresholdInput).toHaveAttribute("min", "1");
    await expect(thresholdInput).toHaveAttribute("max", "100");

    // Visual regression screenshot
    await expect(sharedPage).toHaveScreenshot("dashboard-settings-verification.png");
  });

  test("Cleanup and console error check", async () => {
    await sharedPage.goto(BASE_URL);
    await sharedPage.waitForLoadState("networkidle");

    const criticalErrors = errors.filter((e) => 
      !e.includes("favicon") && 
      !e.includes("third-party") && 
      !e.includes("404") && 
      !e.includes("Failed to load resource")
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });
});
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3001/sample-saas-app";

test.describe.serial("ACME-142: Dashboard Stat Delta and Settings Validation", () => {
  let sharedContext: BrowserContext;
  let sharedPage: Page;
  const consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    sharedPage = await sharedContext.newPage();

    // Set timeouts
    sharedPage.setDefaultTimeout(15000);
    sharedPage.setDefaultNavigationTimeout(30000);

    // Monitor console errors
    sharedPage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    sharedPage.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    // No auth required - navigate to base
    await sharedPage.goto(BASE_URL);
    await sharedPage.waitForLoadState("networkidle");
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test("Verify dashboard stat delta colors and settings input constraints", async () => {
    test.setTimeout(120000);

    // 1. Verify Dashboard Stat Delta Fix
    await sharedPage.goto(`${BASE_URL}/pages/dashboard.html`);
    await sharedPage.waitForLoadState("networkidle");

    const ticketDelta = sharedPage.locator('[data-cy="stat-tickets-delta"]');
    await expect(ticketDelta).toBeVisible();

    // Verify the fix: upward trend in tickets should have .negative class and red color
    await expect(ticketDelta).toHaveClass(/negative/);
    
    // Verify CSS specificity fix (color: #c53030 -> rgb(197, 48, 48))
    const color = await ticketDelta.evaluate((el) => window.getComputedStyle(el).color);
    expect(color).toBe("rgb(197, 48, 48)");

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

    // Visual regression check
    await expect(sharedPage).toHaveScreenshot("settings-page-validation.png");
  });

  test("Cleanup and console error check", async () => {
    await sharedPage.goto(BASE_URL);
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
});
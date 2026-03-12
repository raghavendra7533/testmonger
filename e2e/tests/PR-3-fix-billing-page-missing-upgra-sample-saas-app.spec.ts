import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "https://demo.pristinedata.ai";

test.describe.serial("Billing Page Action Buttons E2E", () => {
  let context: BrowserContext;
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    sharedPage = await context.newPage();
    
    sharedPage.setDefaultTimeout(15000);
    sharedPage.setDefaultNavigationTimeout(30000);

    // Authentication Setup
    await sharedPage.goto(`${BASE_URL}/login`);
    await sharedPage.locator('input[name="email"]').fill(process.env.TEST_EMAIL || "jayashree@nexla.com");
    await sharedPage.locator('input[name="password"]').fill(process.env.TEST_PASSWORD || "Pristinedata@2025");
    await sharedPage.locator('button[type="submit"]').click();
    await sharedPage.waitForLoadState("networkidle");
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("should display upgrade and cancel plan buttons on the billing page", async () => {
    // Feature Navigation
    await sharedPage.goto(`${BASE_URL}/pages/billing.html`);
    await sharedPage.waitForSelector('[data-testid="billing-page"]');
    await sharedPage.waitForLoadState("networkidle");

    // Assertions for the fix (ACME-201)
    const planActions = sharedPage.locator('[data-testid="plan-actions"]');
    const upgradeBtn = sharedPage.locator('[data-testid="upgrade-plan-btn"]');
    const cancelBtn = sharedPage.locator('[data-testid="cancel-plan-btn"]');

    await expect(planActions).toBeVisible();
    await expect(upgradeBtn).toBeVisible();
    await expect(upgradeBtn).toHaveText("Upgrade Plan");
    
    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toHaveText("Cancel Plan");

    // Verify layout/styles via visual regression
    await expect(sharedPage).toHaveScreenshot("billing-plan-actions.png");
  });

  test("cleanup and check for critical console errors", async () => {
    const errors: string[] = [];
    sharedPage.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    sharedPage.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await sharedPage.goto(BASE_URL);
    await sharedPage.waitForLoadState("networkidle");

    const criticalErrors = errors.filter((e) => 
      !e.includes("favicon") && 
      !e.includes("third-party") && 
      !e.includes("404") && 
      !e.includes("Failed to load resource")
    );

    expect(criticalErrors, `Found critical console errors: ${criticalErrors.join(", ")}`).toHaveLength(0);
  });
});
import type { AppConfig, PRAnalysis } from '../store';
import { generateTestWithAI, type PRData } from './aiGenerator';

export async function generateTest(
  analysis: PRAnalysis,
  config: AppConfig,
  prData?: PRData,
): Promise<{ code: string; filename: string }> {
  const identifier = analysis.ticketId || `PR-${analysis.prNumber}`;
  const cleanTitle = analysis.prTitle
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 30);
  const repoName = analysis.repo.replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `${config.outputDirectory}${identifier}-${cleanTitle}-${repoName}.spec.ts`;

  // ── Try AI generation first ───────────────────────────────────────────────
  if (config.aiApiKey && prData) {
    try {
      const aiCode = await generateTestWithAI(analysis, config, prData);
      return { code: aiCode, filename };
    } catch (err: any) {
      console.warn('[generator] AI generation failed, falling back to rule-based:', err.message);
    }
  }

  // ── Rule-based fallback ───────────────────────────────────────────────────
  const lines: string[] = [];

  // Import block
  lines.push('import { Browser, BrowserContext, expect, Page, test } from "@playwright/test";');
  lines.push('');

  // Config constants
  lines.push(`const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "${config.baseUrl}";`);
  lines.push('');

  // Info comment block
  lines.push('/**');
  lines.push(` * Auto-generated E2E test for ${identifier}`);
  lines.push(` * PR: ${analysis.prTitle}`);
  lines.push(` * PR #${analysis.prNumber} in ${analysis.owner}/${analysis.repo}`);
  lines.push(` * Files changed: ${analysis.filesChanged} (+${analysis.additions} -${analysis.deletions})`);
  if (analysis.bugFixType) {
    lines.push(` * Bug fix type: ${analysis.bugFixType}`);
  }
  if (analysis.affectedFeatures.length > 0) {
    lines.push(` * Affected features: ${analysis.affectedFeatures.join(', ')}`);
  }
  if (analysis.changedComponents.length > 0) {
    lines.push(` * Changed components: ${analysis.changedComponents.join(', ')}`);
  }
  if (analysis.changedFunctions.length > 0) {
    lines.push(` * Changed functions: ${analysis.changedFunctions.join(', ')}`);
  }
  lines.push(` * Generated: ${new Date().toISOString()}`);
  lines.push(' */');
  lines.push('');

  // Test describe block
  const title = analysis.prTitle.replace(/"/g, '\\"');
  lines.push(`test.describe.serial("${identifier}: ${title}", () => {`);
  lines.push('  let context: BrowserContext;');
  lines.push('  let sharedPage: Page;');
  lines.push('');

  // Timeout config
  lines.push(`  test.setTimeout(${config.playwright.testTimeout});`);
  lines.push('');

  // beforeAll
  lines.push('  test.beforeAll(async ({ browser }) => {');
  lines.push('    context = await browser.newContext({');
  lines.push(`      viewport: { width: ${config.playwright.viewportWidth}, height: ${config.playwright.viewportHeight} },`);
  lines.push('    });');
  lines.push('    sharedPage = await context.newPage();');
  lines.push(`    sharedPage.setDefaultTimeout(${config.playwright.actionTimeout});`);
  lines.push(`    sharedPage.setDefaultNavigationTimeout(${config.playwright.navigationTimeout});`);

  if (config.authStrategy === 'form-login') {
    const fl = config.formLogin;
    lines.push('');
    lines.push('    // Form-based login');
    lines.push(`    await sharedPage.goto(BASE_URL + "${fl.loginPath}");`);
    lines.push(`    await sharedPage.locator("${fl.emailSelector}").fill(process.env.TEST_EMAIL || "${fl.testEmail}");`);
    lines.push(`    await sharedPage.locator("${fl.passwordSelector}").fill(process.env.TEST_PASSWORD || "${fl.testPassword}");`);
    lines.push(`    await sharedPage.locator("${fl.submitSelector}").click();`);
    if (fl.postLoginWait === 'networkidle') {
      lines.push('    await sharedPage.waitForLoadState("networkidle");');
    } else if (fl.postLoginWait === 'url-match') {
      lines.push('    await sharedPage.waitForURL(/.*dashboard|home|editor.*/);');
    } else if (fl.postLoginWait === 'selector-visible') {
      lines.push('    // TODO: Add selector to wait for after login');
      lines.push('    await sharedPage.waitForLoadState("networkidle");');
    }
  } else if (config.authStrategy === 'localstorage') {
    lines.push('');
    lines.push('    // LocalStorage-based auth');
    lines.push(`    await sharedPage.goto(BASE_URL);`);
    lines.push('    await sharedPage.evaluate(() => {');
    for (const entry of config.localStorageAuth.entries) {
      const escapedKey = entry.key.replace(/"/g, '\\"');
      const escapedValue = entry.value.replace(/"/g, '\\"');
      lines.push(`      localStorage.setItem("${escapedKey}", "${escapedValue}");`);
    }
    lines.push('    });');
    lines.push('    await sharedPage.reload();');
    lines.push('    await sharedPage.waitForLoadState("networkidle");');
  } else {
    lines.push('');
    lines.push('    // No authentication configured');
    lines.push(`    await sharedPage.goto(BASE_URL);`);
    lines.push('    await sharedPage.waitForLoadState("networkidle");');
  }

  lines.push('  });');
  lines.push('');

  // afterAll
  lines.push('  test.afterAll(async () => {');
  lines.push('    await context?.close();');
  lines.push('  });');
  lines.push('');

  // Main test
  lines.push(`  test("${identifier} - Verify PR changes", async () => {`);

  // Feature navigation and assertions
  const matchedFeatures = analysis.affectedFeatures
    .map((featureName) => config.featureMappings.find((fm) => fm.name === featureName))
    .filter(Boolean);

  if (matchedFeatures.length > 0) {
    for (const feature of matchedFeatures) {
      if (!feature) continue;
      lines.push('');
      lines.push(`    // Feature: ${feature.name}`);
      if (feature.entryUrl) {
        lines.push(`    await sharedPage.goto(BASE_URL + "${feature.entryUrl}");`);
        lines.push('    await sharedPage.waitForLoadState("networkidle");');
      }
      if (feature.entrySelector) {
        lines.push(`    await expect(sharedPage.locator('${feature.entrySelector}')).toBeVisible();`);
      }
      for (const step of feature.navigationSteps) {
        if (step.trim()) {
          lines.push(`    ${step}`);
        }
      }
    }
  } else {
    lines.push('');
    lines.push('    // No specific feature mapping matched; navigate to base URL');
    lines.push(`    await sharedPage.goto(BASE_URL);`);
    lines.push('    await sharedPage.waitForLoadState("networkidle");');
  }

  // Related selectors
  if (analysis.relatedSelectors.length > 0) {
    lines.push('');
    lines.push('    // Verify related selectors from PR diff');
    const selectorAttr = config.selectorConvention === 'custom'
      ? config.customSelectorAttribute
      : config.selectorConvention;
    for (const selector of analysis.relatedSelectors) {
      lines.push(`    await expect(sharedPage.locator('[${selectorAttr}="${selector}"]')).toBeVisible();`);
    }
  }

  // Screenshot
  lines.push('');
  lines.push('    // Visual regression screenshot');
  lines.push(`    await expect(sharedPage).toHaveScreenshot("${identifier}-verify.png", {`);
  lines.push(`      maxDiffPixels: ${config.playwright.screenshotDiffPixels},`);
  lines.push(`      threshold: ${config.playwright.screenshotThreshold},`);
  lines.push('    });');

  lines.push('  });');
  lines.push('');

  // Cleanup test
  lines.push('  test("Cleanup and verify no console errors", async () => {');
  lines.push('    const errors: string[] = [];');
  lines.push('    sharedPage.on("console", (msg) => {');
  lines.push('      if (msg.type() === "error") errors.push(msg.text());');
  lines.push('    });');
  lines.push('');
  lines.push(`    await sharedPage.goto(BASE_URL);`);
  lines.push('    await sharedPage.waitForLoadState("networkidle");');
  lines.push('');
  lines.push('    // Allow some known non-critical console errors');
  lines.push('    const criticalErrors = errors.filter(');
  lines.push('      (e) =>');
  lines.push('        !e.includes("favicon") &&');
  lines.push('        !e.includes("third-party") &&');
  lines.push('        !e.includes("404") &&');
  lines.push('        !e.includes("Failed to load resource")');
  lines.push('    );');
  lines.push('    expect(criticalErrors).toHaveLength(0);');
  lines.push('  });');

  lines.push('});');
  lines.push('');

  return { code: lines.join('\n'), filename };
}

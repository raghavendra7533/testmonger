import { AnalyzedPR } from "../analyzer/pr-analyzer";
import { AgentConfig, DEFAULT_AGENT_CONFIG } from "../config/types";

// ── Path generation ───────────────────────────────────────────────────────────

/**
 * Generate the output file path for the test using config.fileNamingTemplate.
 * Supported tokens: {identifier}, {ticketId}, {cleanTitle}, {repoName}, {prNumber}
 */
export function generateTestPath(
  analysis: AnalyzedPR,
  config: AgentConfig = DEFAULT_AGENT_CONFIG,
): string {
  const { prInfo, ticketId } = analysis;
  const identifier = ticketId || `PR-${prInfo.number}`;

  const cleanTitle = prInfo.title
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 30);

  const repoName = prInfo.repo.replace(/[^a-zA-Z0-9-]/g, "");
  const dir = config.outputDirectory.replace(/\/$/, "");

  const filename = config.fileNamingTemplate
    .replace(/{identifier}/g, identifier)
    .replace(/{ticketId}/g, ticketId || `PR-${prInfo.number}`)
    .replace(/{cleanTitle}/g, cleanTitle)
    .replace(/{repoName}/g, repoName)
    .replace(/{prNumber}/g, String(prInfo.number));

  return `${dir}/${filename}`;
}

// ── Main generator ────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate a Playwright test based on analyzed PR and full file content using Claude 3.5 Sonnet.
 */
export async function generateTest(
  analysis: AnalyzedPR,
  config: AgentConfig = DEFAULT_AGENT_CONFIG,
): Promise<string> {
  const { prInfo } = analysis;

  let combinedContext = "";
  for (const file of prInfo.files) {
    if (file.patch) {
      combinedContext += `--- Changed File: ${file.filename} ---\n`;
      combinedContext += `DIFF:\n${file.patch}\n\n`;
      if (file.content) {
        combinedContext += `FULL FILE CONTENT:\n${file.content}\n\n`;
      }
    }
  }

  // If a live accessibility snapshot was captured via MCP (--use-mcp), include it
  // so Claude uses real selectors rather than guessing from diff text.
  const mcpContext = (analysis as any).mcpContext as { snapshot: string; url: string } | undefined;
  const mcpSection = mcpContext
    ? `\nLIVE PAGE SNAPSHOT (accessibility tree captured from ${mcpContext.url}):\n${mcpContext.snapshot}\n\nUse element roles, names, and accessible text from this snapshot to write precise locators.\nPrefer getByRole/getByLabel/getByText over guessed attribute selectors.\n`
    : "";

  const prompt = `You are a Lead SDET. Based on the following Git Diffs and Full File Contexts from a PR, generate a comprehensive, robust Playwright E2E test in TypeScript.

RULES:
1. Use Page Object Model (POM) patterns where applicable or structure the test cleanly.
2. Focus on verifying the user impact of the changes described in the PR.
3. Prioritize using robust selectors like data-testid or data-cy.
4. ONLY return the valid, compilable TypeScript code blocks. Do not add markdown formatting \`\`\`typescript backticks around your response. Assume the returned string will be written directly to a .spec.ts file.
5. Setup the test with import { test, expect } from '@playwright/test';
6. The test should be descriptive, and include comments explaining what is being verified.

PR Title: ${prInfo.title}
PR Description: ${prInfo.body || "No description provided."}

CHANGES AND CONTEXT:
${combinedContext}${mcpSection}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    // The SDK guarantees text content if that's what was returned by the model
    let generatedCode = "";
    if (response.content[0].type === "text") {
      generatedCode = response.content[0].text;
    }

    // strip any stray markdown codeblocks if claude decides to be "helpful"
    generatedCode = generatedCode.replace(/^\`\`\`typescript\n|\`\`\`ts\n/i, "");
    generatedCode = generatedCode.replace(/\n\`\`\`$/i, "");
    return generatedCode;

  } catch (err) {
    console.error("Failed to generate test using Anthropic:", err);
    throw err;
  }
}

// ── Authenticated test (form-login / localstorage) ───────────────────────────

function generateAuthenticatedTest(analysis: AnalyzedPR, config: AgentConfig): string {
  const { prInfo, ticketId, testContext, affectedFeatures } = analysis;
  const testIdentifier = ticketId || `PR-${prInfo.number}`;
  const describeName = `${testIdentifier}: ${formatDescribeName(prInfo.title)}`;

  const header = buildHeader(prInfo, ticketId, testContext, affectedFeatures, config);
  const authPreamble = buildAuthPreamble(config);
  const beforeAll = buildBeforeAll(config);
  const testSteps = buildFeatureSteps(analysis, config);
  const pw = config.playwright;

  return `import { Browser, BrowserContext, expect, Page, test } from "@playwright/test";

${authPreamble}

${header}

test.describe.serial("${describeName}", () => {
  let sharedPage: Page;
  let browser: Browser;
  let context: BrowserContext;

${beforeAll}

  test.afterAll(async () => {
    console.log("[Cleanup] Closing browser context...");
    if (context) await context.close();
  });

  /**
   * TEST: ${testIdentifier} - Verify fix
   * Source: ${prInfo.owner}/${prInfo.repo}#${prInfo.number}
   */
  test("${testIdentifier}: Verify fix - ${prInfo.title.slice(0, 50)}", async () => {
    console.log("[Test] Starting verification for ${testIdentifier}...");

${testSteps}

    // Visual regression screenshot
    console.log("[Test] Taking verification screenshot...");
    await sharedPage.waitForTimeout(1000);
    await expect(sharedPage).toHaveScreenshot("${prInfo.number}-verification.png", {
      maxDiffPixels: ${pw.screenshotDiffPixels},
      threshold: ${pw.screenshotThreshold},
    });

    console.log("[Test] Test completed!");
  });
});
`;
}

// ── Standalone test (authStrategy: none, no featureMappings) ─────────────────

function generateStandaloneTest(analysis: AnalyzedPR, config: AgentConfig): string {
  const { prInfo, ticketId, testContext } = analysis;
  const testIdentifier = ticketId || `PR-${prInfo.number}`;
  const describeName = `${testIdentifier}: ${formatDescribeName(prInfo.title)}`;
  const pw = config.playwright;

  const header = buildHeader(prInfo, ticketId, testContext, analysis.affectedFeatures, config, true);
  const testCases: string[] = [];
  let n = 1;

  // Navigate & title check
  if (testContext.pageMetadata.title) {
    testCases.push(`
  test("${n}. Page loads with correct title", async () => {
    await sharedPage.goto(BASE_URL, { waitUntil: "networkidle", timeout: ${pw.navigationTimeout} });
    await expect(sharedPage).toHaveTitle("${testContext.pageMetadata.title}");
    console.log("[Test ${n}] ✅ Title verified");
  });`);
    n++;
  }

  // Text content assertions
  if (testContext.textContent.length > 0) {
    const assertions = testContext.textContent
      .slice(0, 5)
      .map((t) => {
        const short = t.replace(/"/g, '\\"').slice(0, 40);
        return `    await expect(sharedPage.getByText("${short}", { exact: false })).toBeVisible({ timeout: 5000 });`;
      })
      .join("\n");

    testCases.push(`
  test("${n}. Key text content is visible", async () => {
${assertions}
    console.log("[Test ${n}] ✅ Text content verified");
  });`);
    n++;
  }

  // Semantic HTML elements
  const stableEls = testContext.jsxElements.filter((el) =>
    ["h1", "h2", "h3", "h4", "h5", "h6", "main", "nav", "header", "footer", "section", "article"].includes(el),
  );
  if (stableEls.length > 0) {
    const assertions = stableEls
      .slice(0, 5)
      .map((el) => `    await expect(sharedPage.locator("${el}").first()).toBeVisible({ timeout: 5000 });`)
      .join("\n");

    testCases.push(`
  test("${n}. Semantic HTML elements exist", async () => {
${assertions || `    await expect(sharedPage.locator("h1, h2, h3").first()).toBeVisible({ timeout: 5000 });`}
    console.log("[Test ${n}] ✅ Semantic elements verified");
  });`);
    n++;
  }

  // Section screenshots
  testCases.push(`
  test("${n}. Visual regression - section screenshots", async () => {
    const mainEl = sharedPage.locator("main").first();
    if (await mainEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(mainEl).toHaveScreenshot("${prInfo.number}-main.png", { maxDiffPixels: ${pw.screenshotDiffPixels} });
    }
    const headerEl = sharedPage.locator("header").first();
    if (await headerEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(headerEl).toHaveScreenshot("${prInfo.number}-header.png", { maxDiffPixels: ${pw.screenshotDiffPixels} });
    }
    console.log("[Test ${n}] ✅ Section screenshots captured");
  });`);
  n++;

  // Full page screenshot
  testCases.push(`
  test("${n}. Full page screenshot", async () => {
    await sharedPage.waitForTimeout(1000);
    await expect(sharedPage).toHaveScreenshot("${prInfo.number}-full-page.png", {
      fullPage: true,
      maxDiffPixels: ${pw.screenshotDiffPixels},
    });
    console.log("[Test ${n}] ✅ Full page screenshot captured");
  });`);
  n++;

  // Responsive (if CSS has media queries)
  const hasResponsive =
    testContext.cssClasses.some((c) =>
      ["mobile", "responsive", "tablet", "desktop"].some((s) => c.toLowerCase().includes(s)),
    ) || prInfo.files.some((f) => f.patch?.includes("@media"));

  if (hasResponsive) {
    testCases.push(`
  test("${n}. Mobile responsive design", async () => {
    await sharedPage.setViewportSize({ width: 375, height: 667 });
    await sharedPage.waitForTimeout(500);
    await expect(sharedPage.locator("main").first()).toBeVisible();
    await expect(sharedPage).toHaveScreenshot("${prInfo.number}-mobile.png", {
      fullPage: true,
      maxDiffPixels: ${pw.screenshotDiffPixels},
    });
    await sharedPage.setViewportSize({ width: ${pw.viewportWidth}, height: ${pw.viewportHeight} });
    console.log("[Test ${n}] ✅ Mobile responsive verified");
  });`);
  }

  return `import { Browser, BrowserContext, expect, Page, test } from "@playwright/test";

${header}

// Run the app locally first, then set TEST_BASE_URL (or TEST_FRONTEND_URL) to its address.
const BASE_URL = process.env.TEST_BASE_URL || process.env.TEST_FRONTEND_URL || "${config.baseUrl}";

test.describe.serial("${describeName}", () => {
  let sharedPage: Page;
  let browser: Browser;
  let context: BrowserContext;

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
    context = await browser.newContext({
      viewport: { width: ${pw.viewportWidth}, height: ${pw.viewportHeight} },
    });
    sharedPage = await context.newPage();
    console.log("[Setup] Navigating to:", BASE_URL);
    await sharedPage.goto(BASE_URL, { waitUntil: "networkidle", timeout: ${pw.navigationTimeout} });
    console.log("[Setup] App loaded");
  });

  test.afterAll(async () => {
    if (context) await context.close();
  });
${testCases.join("\n")}
});
`;
}

// ── Auth preamble helpers ─────────────────────────────────────────────────────

function buildAuthPreamble(config: AgentConfig): string {
  if (config.authStrategy === "form-login") {
    return `// Auth configuration — override via environment variables in CI
const BASE_URL = process.env.TEST_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || "${config.baseUrl}";
const TEST_EMAIL = process.env.TEST_EMAIL || "${config.formLogin.testEmail}";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "${config.formLogin.testPassword}";`;
  }

  if (config.authStrategy === "localstorage") {
    return `// Auth configuration
const BASE_URL = process.env.TEST_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || "${config.baseUrl}";`;
  }

  // none
  return `const BASE_URL = process.env.TEST_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL || "${config.baseUrl}";`;
}

function buildBeforeAll(config: AgentConfig): string {
  const pw = config.playwright;

  if (config.authStrategy === "form-login") {
    const fl = config.formLogin;
    const waitLine = buildPostLoginWait(fl.postLoginWait);

    return `  test.beforeAll(async ({ browser: testBrowser }) => {
    try {
      browser = testBrowser;
      context = await browser.newContext({
        viewport: { width: ${pw.viewportWidth}, height: ${pw.viewportHeight} },
      });
      sharedPage = await context.newPage();

      // Navigate to login page
      console.log("[Setup] Navigating to login page...");
      await sharedPage.goto(\`\${BASE_URL}${fl.loginPath}\`, { waitUntil: "networkidle" });

      // Enter credentials
      console.log("[Setup] Entering credentials...");
      await sharedPage.locator("${fl.emailSelector}").fill(TEST_EMAIL);
      await sharedPage.locator("${fl.passwordSelector}").fill(TEST_PASSWORD);
      await sharedPage.locator("${fl.submitSelector}").click();
${waitLine}
      console.log("[Setup] Login complete");
    } catch (error) {
      console.error("[Setup] Error in beforeAll:", error);
      throw error;
    }
  });`;
  }

  if (config.authStrategy === "localstorage") {
    const entries = config.localStorageAuth.entries;
    const setItems = entries
      .map((e) => `      localStorage.setItem(${JSON.stringify(e.key)}, ${JSON.stringify(e.value)});`)
      .join("\n");

    return `  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
    context = await browser.newContext({
      viewport: { width: ${pw.viewportWidth}, height: ${pw.viewportHeight} },
    });
    sharedPage = await context.newPage();

    // Inject auth tokens into localStorage before navigating
    await sharedPage.addInitScript(() => {
${setItems}
    });

    console.log("[Setup] Navigating to app...");
    await sharedPage.goto(BASE_URL, { waitUntil: "networkidle", timeout: ${pw.navigationTimeout} });
    console.log("[Setup] App loaded with localStorage auth");
  });`;
  }

  // none — just navigate
  return `  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser;
    context = await browser.newContext({
      viewport: { width: ${pw.viewportWidth}, height: ${pw.viewportHeight} },
    });
    sharedPage = await context.newPage();
    console.log("[Setup] Navigating to:", BASE_URL);
    await sharedPage.goto(BASE_URL, { waitUntil: "networkidle", timeout: ${pw.navigationTimeout} });
    console.log("[Setup] App loaded");
  });`;
}

function buildPostLoginWait(strategy: AgentConfig["formLogin"]["postLoginWait"]): string {
  if (strategy === "networkidle") {
    return `      await sharedPage.waitForLoadState("networkidle");`;
  }
  if (strategy === "url-match") {
    return `      await sharedPage.waitForURL(/\\/(?:dashboard|home|app)/, { timeout: 15000 });`;
  }
  if (strategy === "selector-visible") {
    return `      // TODO: replace with a selector that appears after successful login
      await sharedPage.waitForSelector('[data-testid="app-root"], main, #app', { timeout: 15000 });`;
  }
  return `      await sharedPage.waitForLoadState("networkidle");`;
}

// ── Feature step generation ───────────────────────────────────────────────────

function buildFeatureSteps(analysis: AnalyzedPR, config: AgentConfig): string {
  const { testContext, affectedFeatures, prInfo } = analysis;
  const steps: string[] = [];
  const selectorAttr = resolveAttr(config);

  // Navigate to each affected feature using config.featureMappings
  for (const feature of affectedFeatures) {
    const mapping = config.featureMappings.find((m) => m.name === feature);

    if (mapping) {
      if (mapping.entryUrl) {
        steps.push(`    // Navigate to feature: ${feature}
    console.log("[Test] Navigating to ${feature}...");
    await sharedPage.goto(\`\${BASE_URL}${mapping.entryUrl}\`, { waitUntil: "networkidle" });`);
      }
      if (mapping.entrySelector) {
        steps.push(`    await expect(sharedPage.locator("${mapping.entrySelector}")).toBeVisible({ timeout: 10000 });`);
      }
      for (const step of mapping.navigationSteps) {
        steps.push(`    ${step}`);
      }
    } else {
      steps.push(`    // TODO: add navigation steps for feature "${feature}" in your config`);
    }
  }

  // Assert detected selectors from the diff
  if (testContext.relatedSelectors.length > 0) {
    steps.push(`    // Verify affected UI elements detected from PR diff`);
    for (const selector of testContext.relatedSelectors.slice(0, 5)) {
      steps.push(
        `    await expect(sharedPage.locator('[${selectorAttr}="${selector}"]')).toBeVisible({ timeout: 5000 });`,
      );
    }
  }

  // Comment out changed components (CSS classes — unstable as locators, just for reference)
  if (testContext.changedComponents.length > 0) {
    steps.push(`    // Changed components detected in PR diff (for reference):`);
    for (const comp of testContext.changedComponents.slice(0, 3)) {
      steps.push(`    // - ${comp}`);
    }
  }

  // Placeholder if nothing detected
  if (steps.length === 0) {
    steps.push(`    // No specific feature navigation detected from PR diff.
    // Add test steps below based on what the PR changes.
    // PR: ${prInfo.owner}/${prInfo.repo}#${prInfo.number}
    // TODO: add assertions here
    console.log("[Test] Placeholder — add steps based on PR context");`);
  }

  return steps.join("\n\n");
}

function resolveAttr(config: AgentConfig): string {
  if (config.selectorConvention === "custom") {
    return config.customSelectorAttribute || "data-testid";
  }
  return config.selectorConvention === "aria-label"
    ? "aria-label"
    : config.selectorConvention;
}

// ── JSDoc header ──────────────────────────────────────────────────────────────

function buildHeader(
  prInfo: AnalyzedPR["prInfo"],
  ticketId: string | null,
  testContext: AnalyzedPR["testContext"],
  affectedFeatures: string[],
  config: AgentConfig,
  standalone = false,
): string {
  const howItWorks = buildHowItWorksSteps(config, standalone);
  const bugDesc = testContext.bugDescription || prInfo.title;

  return `/**
 * ============================================================================
 * AUTO-GENERATED TEST BY PR-TEST-AGENT${standalone ? " (Standalone Mode)" : ""}
 * ============================================================================
 *
 * SOURCE PR DETAILS:
 * ------------------
 * Repository:  ${prInfo.owner}/${prInfo.repo}
 * PR Number:   #${prInfo.number}
 * PR Title:    ${prInfo.title}
 * PR URL:      https://github.com/${prInfo.owner}/${prInfo.repo}/pull/${prInfo.number}
 * ${ticketId ? `Ticket ID:   ${ticketId}` : "Ticket ID:   Not found in PR"}
 * Labels:      ${prInfo.labels.length > 0 ? prInfo.labels.join(", ") : "None"}
 *
 * ISSUE DESCRIPTION:
 * ------------------
${bugDesc.split("\n").slice(0, 8).map((l) => ` * ${l}`).join("\n")}
 *
 * WHAT IS BEING AUTOMATED:
 * ------------------------
 * This test verifies the fix/changes made in the PR above.
 * - Affected Features: ${affectedFeatures.join(", ") || "Not detected - may need manual identification"}
 * - Changed Components: ${testContext.changedComponents.join(", ") || "None detected in diff"}
 * - Related Selectors: ${testContext.relatedSelectors.length > 0 ? testContext.relatedSelectors.slice(0, 5).join(", ") : "None detected - may need manual addition"}
 *
 * HOW IT WORKS:
 * -------------
${howItWorks}
 *
 * FILES CHANGED IN PR:
 * --------------------
${prInfo.files
      .slice(0, 10)
      .map((f) => ` * - ${f.filename} (+${f.additions}/-${f.deletions})`)
      .join("\n")}${prInfo.files.length > 10 ? `\n * - ... and ${prInfo.files.length - 10} more files` : ""}
 *
 * CHANGED FUNCTIONS DETECTED:
 * ---------------------------
${testContext.changedFunctions.length > 0
      ? testContext.changedFunctions.slice(0, 10).map((f) => ` * - ${f}()`).join("\n") +
      (testContext.changedFunctions.length > 10 ? `\n * - ... and ${testContext.changedFunctions.length - 10} more` : "")
      : " * None detected in diff"}
 *
 * ============================================================================
 */`;
}

function buildHowItWorksSteps(config: AgentConfig, standalone: boolean): string {
  if (standalone) {
    return [
      " * 1. Navigates to the app at BASE_URL",
      " * 2. Verifies page title and text content from PR diff",
      " * 3. Checks semantic HTML elements exist (h1, main, header, etc.)",
      " * 4. Takes section screenshots for visual regression",
      " * 5. Takes a full-page screenshot",
    ].join("\n");
  }

  if (config.authStrategy === "form-login") {
    const fl = config.formLogin;
    return [
      ` * 1. Navigates to login page at ${fl.loginPath}`,
      ` * 2. Fills ${fl.emailSelector} and ${fl.passwordSelector}, clicks ${fl.submitSelector}`,
      ` * 3. Waits for post-login state (${fl.postLoginWait})`,
      " * 4. Navigates to the affected feature area(s)",
      " * 5. Asserts affected UI elements are visible",
      " * 6. Takes a screenshot for visual regression testing",
    ].join("\n");
  }

  if (config.authStrategy === "localstorage") {
    return [
      " * 1. Injects auth tokens into localStorage via addInitScript()",
      " * 2. Navigates to BASE_URL (app auto-authenticates from localStorage)",
      " * 3. Navigates to the affected feature area(s)",
      " * 4. Asserts affected UI elements are visible",
      " * 5. Takes a screenshot for visual regression testing",
    ].join("\n");
  }

  // none
  return [
    " * 1. Navigates to BASE_URL",
    " * 2. Navigates to the affected feature area(s)",
    " * 3. Asserts affected UI elements are visible",
    " * 4. Takes a screenshot for visual regression testing",
  ].join("\n");
}

// ── PR body ───────────────────────────────────────────────────────────────────

export function generatePRBody(analysis: AnalyzedPR, testPath: string): string {
  const { prInfo, ticketId, affectedFeatures, testContext } = analysis;

  return `## 🤖 Auto-Generated Test for Bug Fix

### Source PR
| Field | Value |
|-------|-------|
| **Repository** | \`${prInfo.owner}/${prInfo.repo}\` |
| **PR Number** | #${prInfo.number} |
| **Title** | ${prInfo.title} |
| **Ticket** | ${ticketId || "Not detected"} |
| **Labels** | ${prInfo.labels.join(", ") || "None"} |

### Test Information
- **Test File:** \`${testPath}\`
- **Affected Features:** ${affectedFeatures.join(", ") || "Unknown — manual review needed"}

### What This Test Covers
${testContext.bugDescription.slice(0, 500)}${testContext.bugDescription.length > 500 ? "..." : ""}

### Files Changed in Source PR
${prInfo.files.slice(0, 5).map((f) => `- \`${f.filename}\` (+${f.additions}/-${f.deletions})`).join("\n")}
${prInfo.files.length > 5 ? `- ... and ${prInfo.files.length - 5} more files` : ""}

### Changed Components
${testContext.changedComponents.length > 0 ? testContext.changedComponents.map((c) => `- \`${c}\``).join("\n") : "- None detected"}

---
*🤖 Generated by PR-Test-Agent | [View Source PR](https://github.com/${prInfo.owner}/${prInfo.repo}/pull/${prInfo.number})*
`;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDescribeName(title: string): string {
  return title
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .slice(0, 50);
}

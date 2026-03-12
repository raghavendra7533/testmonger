import type { AppConfig, PRAnalysis } from '../store';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface PRFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface PRData {
  pr: {
    title: string;
    body: string;
    number: number;
    labels: Array<{ name: string }>;
  };
  files: PRFile[];
}

function buildAuthDescription(config: AppConfig): string {
  if (config.authStrategy === 'localstorage') {
    const entries = config.localStorageAuth.entries
      .map((e) => `localStorage.setItem("${e.key}", ${JSON.stringify(e.value)})`)
      .join('\n    ');
    return `LocalStorage auth — inject these entries before navigation:\n    ${entries || '(no entries configured)'}`;
  }
  if (config.authStrategy === 'form-login') {
    const fl = config.formLogin;
    return `Form login:
    - Navigate to: BASE_URL + "${fl.loginPath}"
    - Fill email: locator("${fl.emailSelector}") with process.env.TEST_EMAIL || "${fl.testEmail}"
    - Fill password: locator("${fl.passwordSelector}") with process.env.TEST_PASSWORD || "${fl.testPassword}"
    - Click submit: locator("${fl.submitSelector}")
    - Wait for: ${fl.postLoginWait}`;
  }
  return 'No auth — navigate directly to BASE_URL';
}

function buildFeatureMappingDescription(config: AppConfig, affectedFeatures: string[]): string {
  const matched = affectedFeatures
    .map((name) => config.featureMappings.find((fm) => fm.name === name))
    .filter(Boolean);

  if (matched.length === 0) return 'No feature mappings matched — navigate to BASE_URL';

  return matched
    .map((fm) => {
      if (!fm) return '';
      const parts = [`Feature "${fm.name}":`];
      if (fm.entryUrl) parts.push(`  - Navigate to: BASE_URL + "${fm.entryUrl}"`);
      if (fm.entrySelector) parts.push(`  - Wait for selector: ${fm.entrySelector}`);
      if (fm.navigationSteps.length) parts.push(`  - Extra steps: ${fm.navigationSteps.join('; ')}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

function buildPrompt(analysis: PRAnalysis, config: AppConfig, prData: PRData): string {
  const selectorAttr =
    config.selectorConvention === 'custom'
      ? config.customSelectorAttribute
      : config.selectorConvention;

  // Trim patches to avoid exceeding context window
  const diffSection = prData.files
    .map((f) => {
      const patch = f.patch ? f.patch.slice(0, 1500) : '(no diff available)';
      return `### ${f.filename} (+${f.additions}/-${f.deletions})\n\`\`\`diff\n${patch}\n\`\`\``;
    })
    .join('\n\n');

  return `You are an expert Playwright test engineer. Generate a complete, production-ready Playwright TypeScript E2E test for the following GitHub PR.

## PR Details
- Title: ${analysis.prTitle}
- PR #${analysis.prNumber} in ${analysis.owner}/${analysis.repo}
- Body: ${prData.pr.body?.slice(0, 800) || '(no description)'}

## App Configuration
- Base URL: \`${config.baseUrl}\` (use process.env.PLAYWRIGHT_TEST_BASE_URL as override)
- Selector convention: \`${selectorAttr}\` (use ONLY this attribute for element targeting)
- Viewport: ${config.playwright.viewportWidth}x${config.playwright.viewportHeight}
- Action timeout: ${config.playwright.actionTimeout}ms
- Test timeout: ${config.playwright.testTimeout}ms

## Authentication Setup (use this in beforeAll)
${buildAuthDescription(config)}

## Feature Navigation (use this to navigate to the right page after auth)
${buildFeatureMappingDescription(config, analysis.affectedFeatures)}

## PR Diff (what changed)
${diffSection}

## Selectors Found in Diff
${analysis.relatedSelectors.length > 0 ? analysis.relatedSelectors.map((s) => `[${selectorAttr}="${s}"]`).join(', ') : '(none detected — infer from diff)'}

## Instructions
Generate a SINGLE complete Playwright TypeScript file (.spec.ts) that:

1. Imports from \`@playwright/test\`
2. Declares \`const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "${config.baseUrl}"\`
3. Uses \`test.describe.serial\` with a shared \`BrowserContext\` and \`Page\` (set up in \`test.beforeAll\`)
4. In \`beforeAll\`: sets up auth exactly as described above
5. In \`beforeAll\`: sets \`sharedPage.setDefaultTimeout(${config.playwright.actionTimeout})\` and \`setDefaultNavigationTimeout(${config.playwright.navigationTimeout})\`
6. Contains ONE main test that:
   - Navigates to the affected feature area using the feature navigation above
   - Asserts each changed/added UI element is visible using ONLY \`[${selectorAttr}="..."]\` selectors
   - Tests the specific behaviour described in the PR (not just presence — test the actual fix)
   - Takes a visual regression screenshot with \`toHaveScreenshot\`
7. Contains a cleanup test that navigates to BASE_URL and checks for console errors. In the cleanup test, filter errors like this:
   \`const criticalErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("third-party") && !e.includes("404") && !e.includes("Failed to load resource"));\`
8. Uses \`await sharedPage.waitForLoadState("networkidle")\` after navigation
9. Does NOT use \`page\` fixture directly — use the shared \`sharedPage\` variable

Return ONLY the raw TypeScript code. No markdown fences, no explanation, no comments outside the code.`;
}

function extractCode(raw: string): string {
  // Strip markdown code fences if the model wraps the output
  const fenceMatch = raw.match(/```(?:typescript|ts)?\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

export async function generateTestWithAI(
  analysis: PRAnalysis,
  config: AppConfig,
  prData: PRData,
): Promise<string> {
  if (!config.aiApiKey) {
    throw new Error('No Gemini API key configured. Add it in Config → AI Model.');
  }

  const prompt = buildPrompt(analysis, config, prData);

  const response = await fetch(`${GEMINI_URL}?key=${config.aiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini returned an empty response');

  return extractCode(raw);
}

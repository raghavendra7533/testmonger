import * as dotenv from "dotenv";
import {
  getPRInfo,
  parsePRUrl,
  createBranch,
  createFile,
  createPR,
} from "./github/client";
import { analyzePR } from "./analyzer/pr-analyzer";
import { generateTest, generatePRBody, generateTestPath } from "./generator/test-generator";
import { validateTest, formatValidationResult, ValidatorOptions } from "./validator/test-validator";
import { loadConfig } from "./config/loader";
import { AgentConfig } from "./config/types";
import { capturePageContext, executeTestWithMCP, mcpBrowser } from "./mcp";

dotenv.config();

interface RunOptions {
  sourcePRUrl: string;
  configPath?: string;
  dryRun?: boolean;
  skipValidation?: boolean;
  runTest?: boolean;
  useMcp?: boolean;
}

/**
 * Main agent function — processes a PR and generates a Playwright test.
 * All platform-specific behaviour is driven by the loaded AgentConfig.
 */
async function runAgent(options: RunOptions): Promise<void> {
  const { sourcePRUrl, configPath, dryRun = false, skipValidation = false, runTest = false } = options;

  // Load config: --config file → .pr-agent.json → env vars → defaults
  const config: AgentConfig = loadConfig(configPath);

  // B2: --use-mcp CLI flag OR config.useMcp OR USE_MCP env var (loader already applied env)
  const useMcp = options.useMcp === true || config.useMcp === true;

  // Resolve target repo: config → env vars (already applied by loader)
  const testRepoOwner = config.targetRepo.owner || process.env.TEST_REPO_OWNER || "";
  const testRepoName = config.targetRepo.name || process.env.TEST_REPO_NAME || "";

  console.log("\n========================================");
  console.log("  PR-Test-Agent Starting");
  console.log("========================================\n");
  console.log(`  Auth strategy : ${config.authStrategy}`);
  console.log(`  Base URL      : ${config.baseUrl}`);
  console.log(`  Features      : ${config.featureMappings.length} mapping(s) configured`);
  console.log(`  Output dir    : ${config.outputDirectory}`);
  console.log(`  MCP mode      : ${useMcp ? "enabled" : "disabled"}`);
  console.log();

  try {
    // Step 1: Parse PR URL
    console.log("Step 1: Parsing PR URL...");
    const { owner, repo, prNumber } = parsePRUrl(sourcePRUrl);
    console.log(`  Source: ${owner}/${repo}#${prNumber}`);

    // Step 2: Fetch PR information
    console.log("\nStep 2: Fetching PR information...");
    const prInfo = await getPRInfo(owner, repo, prNumber);
    console.log(`  Title: ${prInfo.title}`);
    console.log(`  Files changed: ${prInfo.files.length}`);
    console.log(`  Labels: ${prInfo.labels.join(", ") || "none"}`);

    // Step 3: Analyze PR (config-driven patterns)
    console.log("\nStep 3: Analyzing PR for test generation...");
    const analysis = analyzePR(prInfo, config);
    console.log(`  Ticket ID: ${analysis.ticketId || "not found"}`);
    console.log(`  Bug fix type: ${analysis.bugFixType || "unknown"}`);
    console.log(`  Affected features: ${analysis.affectedFeatures.join(", ") || "none"}`);
    console.log(`  Changed functions: ${analysis.testContext.changedFunctions.length}`);
    console.log(`  Related selectors: ${analysis.testContext.relatedSelectors.length}`);
    console.log(`  Mode: ${analysis.testContext.isStandaloneApp ? "standalone" : "authenticated"}`);

    // Step 3.5 (MCP): Capture live page accessibility snapshot before generation
    if (useMcp && analysis.affectedFeatures.length > 0) {
      console.log("\nStep 3.5: Capturing live page snapshot via Playwright MCP...");
      try {
        // Pick the entry URL of the first detected feature mapping, fall back to baseUrl
        const firstFeature = config.featureMappings.find(
          (m) => analysis.affectedFeatures.includes(m.name) || analysis.affectedFeatures.includes(m.id)
        );
        const featureUrl = firstFeature?.entryUrl
          ? `${config.baseUrl.replace(/\/$/, "")}${firstFeature.entryUrl}`
          : config.baseUrl;

        const mcpCtx = await capturePageContext(featureUrl, config);
        (analysis as any).mcpContext = mcpCtx;
        console.log(`  Snapshot captured from: ${mcpCtx.url}`);
      } catch (mcpErr) {
        console.warn("  [MCP] Warning: Could not capture page snapshot. Continuing without it.");
        console.warn(" ", mcpErr);
      }
    }

    // Step 4: Generate test code
    console.log("\nStep 4: Generating test code...");
    let testCode = await generateTest(analysis, config);
    const testPath = generateTestPath(analysis, config);
    console.log(`  Test path: ${testPath}`);

    // Step 5: Validate generated test
    if (!skipValidation) {
      console.log("\nStep 5: Validating generated test...");
      const validatorOptions: ValidatorOptions = {
        skipExecution: !runTest,
        timeout: 60000,
      };

      const validationResult = await validateTest(testCode, testPath, validatorOptions);
      console.log(formatValidationResult(validationResult));

      if (!validationResult.isValid) {
        console.error("\n❌ Validation failed! Test will not be committed.");
        console.error("   Fix the errors above, or use --skip-validation to bypass.");
        throw new Error("Test validation failed");
      }

      // If the validator's LLM loop fixed the typescript errors, retrieve the corrected script
      if ((validationResult as any).fixedTestCode) {
        testCode = (validationResult as any).fixedTestCode;
        console.log("  [Validator] Updated test payload with LLM-corrected TypeScript code.");
      }

      console.log("\n✅ Validation passed! Proceeding...");
    } else {
      console.log("\nStep 5: Validation skipped (--skip-validation flag)");
    }

    // Step 5.5 (MCP): Execute test via Claude + Playwright MCP agentic loop + auto-heal
    if (useMcp && runTest) {
      console.log("\nStep 5.5: Executing test via Playwright MCP agentic loop...");
      try {
        const execResult = await executeTestWithMCP(testCode, config.baseUrl, config);

        if (execResult.healedTestCode) {
          testCode = execResult.healedTestCode;
          console.log(`  [MCP] Auto-healed ${execResult.retryCount} step(s) — using corrected test code.`);
        }

        const statusIcon = execResult.success ? "✅" : "⚠️";
        console.log(`\n${statusIcon} MCP Execution: ${execResult.success ? "PASSED" : "completed with issues"}`);
        for (const step of execResult.stepResults) {
          const icon = step.status === "passed" ? "✅" : step.status === "healed" ? "🔧" : "❌";
          console.log(`  ${icon} ${step.description}${step.error ? ` — ${step.error}` : ""}`);
        }
      } catch (mcpErr) {
        console.warn("  [MCP] Warning: MCP execution failed. Continuing with commit.");
        console.warn(" ", mcpErr);
      }
    }

    // Dry run — save locally and exit
    if (dryRun) {
      console.log("\n[DRY RUN] Generated test code:");
      console.log("----------------------------------------");
      console.log(testCode);
      console.log("----------------------------------------");

      const fs = await import("fs");
      const path = await import("path");
      const localPath = path.join(process.cwd(), testPath);
      const dir = path.dirname(localPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localPath, testCode);
      console.log(`\n[DRY RUN] Test saved locally to: ${localPath}`);
      return;
    }

    // Step 6: Create branch in test repo
    if (!testRepoOwner || !testRepoName) {
      throw new Error(
        "targetRepo.owner and targetRepo.name must be set in config or via TEST_REPO_OWNER / TEST_REPO_NAME env vars.",
      );
    }

    const branchName = `test/${analysis.ticketId || `pr-${prNumber}`}-${Date.now()}`;
    // B6: use the actual default branch of the test repo instead of hardcoded 'main'
    const { getDefaultBranch } = await import("./github/client");
    const testRepoDefaultBranch = await getDefaultBranch(testRepoOwner, testRepoName);
    console.log(`\nStep 6: Creating branch: ${branchName} (from ${testRepoDefaultBranch})`);
    await createBranch(testRepoOwner, testRepoName, branchName, testRepoDefaultBranch);
    console.log("  Branch created successfully");

    // Step 7: Commit test file
    console.log("\nStep 7: Committing test file...");
    const commitMessage = `test: add automated test for ${analysis.ticketId || `PR #${prNumber}`}

Source PR: ${owner}/${repo}#${prNumber}
Title: ${prInfo.title}`;

    await createFile(testRepoOwner, testRepoName, testPath, testCode, commitMessage, branchName);
    console.log("  Test file committed");

    // Step 8: Create PR
    console.log("\nStep 8: Creating pull request...");
    const prBody = generatePRBody(analysis, testPath);
    const prTitle = `test: ${analysis.ticketId || `PR-${prNumber}`} - ${prInfo.title.slice(0, 50)}`;

    const newPR = await createPR(testRepoOwner, testRepoName, prTitle, prBody, branchName, testRepoDefaultBranch);

    console.log("\n========================================");
    console.log("  Agent Complete!");
    console.log("========================================");
    console.log(`\n  Test PR created: ${newPR.url}\n`);
  } catch (error) {
    console.error("\nAgent Error:", error);
    throw error;
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(`
PR-Test-Agent — Config-driven Playwright test generation for any platform

Usage:
  npx ts-node src/index.ts <pr-url> [options]

Options:
  --config <path>    Path to config JSON file (or set PR_AGENT_CONFIG env var)
                     Auto-detected: .pr-agent.json in current directory
  --dry-run          Generate test locally without creating a PR
  --skip-validation  Skip TypeScript syntax validation
  --run-test         Execute the generated test with Playwright during validation
  --use-mcp          Enable Playwright MCP integration:
                       - Snapshot live page before generation (real selectors)
                       - Execute test via Claude+MCP agentic loop (with --run-test)
                       - Auto-heal failing selectors (up to 3 retries)
  --help             Show this help

Config File:
  Create a .pr-agent.json file (or export from the UI) with your platform settings.
  The JSON schema mirrors what the frontend "Export Config" button produces.

  Minimal example:
  {
    "baseUrl": "https://app.yourproduct.com",
    "authStrategy": "form-login",
    "formLogin": {
      "loginPath": "/login",
      "emailSelector": "input[name='email']",
      "passwordSelector": "input[name='password']",
      "submitSelector": "button[type='submit']",
      "testEmail": "",
      "testPassword": "",
      "postLoginWait": "networkidle"
    },
    "featureMappings": [],
    "selectorConvention": "data-testid",
    "ticketPatterns": [{ "id": "1", "pattern": "\\\\[?(PROJ-\\\\d+)\\\\]?", "label": "PROJ" }],
    "outputDirectory": "e2e/tests/",
    "fileNamingTemplate": "{identifier}-{cleanTitle}-{repoName}.spec.ts"
  }

Environment variables (override config file values):
  GITHUB_TOKEN              Required — GitHub personal access token
  TEST_BASE_URL             Override baseUrl
  TEST_EMAIL                Override formLogin.testEmail
  TEST_PASSWORD             Override formLogin.testPassword
  TEST_REPO_OWNER           Override targetRepo.owner
  TEST_REPO_NAME            Override targetRepo.name
  PR_AGENT_CONFIG           Path to config JSON file

Examples:
  npx ts-node src/index.ts https://github.com/owner/repo/pull/123
  npx ts-node src/index.ts https://github.com/owner/repo/pull/123 --dry-run
  npx ts-node src/index.ts https://github.com/owner/repo/pull/123 --config ./my-app.json --dry-run
  npx ts-node src/index.ts https://github.com/owner/repo/pull/123 --skip-validation
`);
    return;
  }

  const prUrl = args[0];
  const dryRun = args.includes("--dry-run");
  const skipValidation = args.includes("--skip-validation");
  const runTest = args.includes("--run-test");
  const useMcp = args.includes("--use-mcp");

  // Parse --config flag (supports both "--config path" and "--config=path")
  let configPath: string | undefined;
  const configIdx = args.indexOf("--config");
  if (configIdx !== -1 && args[configIdx + 1]) {
    configPath = args[configIdx + 1];
  } else {
    const inlineArg = args.find((a) => a.startsWith("--config="));
    if (inlineArg) configPath = inlineArg.split("=").slice(1).join("=");
  }

  try {
    await runAgent({ sourcePRUrl: prUrl, configPath, dryRun, skipValidation, runTest, useMcp });
  } finally {
    // Always disconnect MCP browser if it was started
    if (useMcp) await mcpBrowser.disconnect();
  }
}

main().catch(console.error);

export { runAgent, RunOptions, AgentConfig };

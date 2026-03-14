import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

export interface ValidationResult {
  isValid: boolean;
  syntaxValid: boolean;
  executionValid: boolean | null; // null if not run
  errors: string[];
  warnings: string[];
}

export interface ValidatorOptions {
  skipExecution?: boolean; // Skip Playwright execution (default: true)
  timeout?: number; // Execution timeout in ms (default: 60000)
}

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";

async function ollamaFix(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Validate generated test code before committing.
 * If tsc syntax validation fails, feeds the error back to Claude to attempt a fix (up to 3 retries).
 */
export async function validateTest(
  initialTestCode: string,
  testPath: string,
  options: ValidatorOptions = {}
): Promise<ValidationResult> {
  const { skipExecution = true, timeout = 60000 } = options;

  let result: ValidationResult = {
    isValid: false,
    syntaxValid: false,
    executionValid: null,
    errors: [],
    warnings: [],
  };

  const tempDir = path.join(process.cwd(), ".temp-validation");
  const tempFilePath = path.join(tempDir, path.basename(testPath));

  let testCode = initialTestCode;
  let retries = 0;
  const maxRetries = 3;

  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    while (retries <= maxRetries) {
      if (retries > 0) {
        console.log(`\n  [Validator] 🔄 Retry ${retries}/${maxRetries} - Asking LLM to fix syntax errors...`);
      }

      // Write test to temp file
      fs.writeFileSync(tempFilePath, testCode);
      console.log("  [Validator] Test file written to temp location");

      // Step 1: TypeScript Syntax Validation
      console.log("  [Validator] Running TypeScript syntax check...");
      const syntaxResult = await validateSyntax(tempFilePath);
      
      if (syntaxResult.valid) {
        console.log("  [Validator] ✅ Syntax validation passed");
        result.syntaxValid = true;
        result.errors = []; // Clear any previous syntax errors
        break; // Exit retry loop on success
      } else {
        console.log("  [Validator] ❌ Syntax validation failed");
        result.syntaxValid = false;
        result.errors = syntaxResult.errors;
        
        if (retries < maxRetries) {
          // Feed the error back to LLM to self-correct
          try {
            const prompt = `A Playwright TypeScript test failed compilation. Fix the TypeScript errors and return ONLY the corrected code. No markdown fences, no explanations.

FAILING CODE:
${testCode}

COMPILER ERRORS:
${syntaxResult.errors.join("\n")}`;

            const fixed = await ollamaFix(prompt);
            if (fixed) {
              testCode = fixed.replace(/^```(typescript|ts)?\n/i, "").replace(/\n```$/i, "");
            }
          } catch (llmError) {
            console.error("  [Validator] LLM correction failed:", llmError);
            break;
          }
        }
      }
      retries++;
    }

    // Step 2 & 3: Only run these if syntax is finally valid
    if (result.syntaxValid) {
      // B5: Hard gate — reject tests that are cosmetically valid but substantively empty
      const substanceCheck = hasSubstantiveContent(testCode);
      if (!substanceCheck.ok) {
        result.syntaxValid = false; // treat as invalid so caller rejects commit
        result.errors.push(`Validation theatre detected: ${substanceCheck.reason}`);
        return result;
      }

      // Step 2: Static Code Analysis
      console.log("  [Validator] Running static analysis...");
      const analysisResult = analyzeTestCode(testCode);
      result.warnings.push(...analysisResult.warnings);
      
      if (analysisResult.warnings.length > 0) {
        console.log(`  [Validator] ⚠️  ${analysisResult.warnings.length} warning(s) found`);
      }

      // Step 3: Playwright Execution (optional)
      if (!skipExecution) {
        console.log("  [Validator] Running Playwright execution check...");
        const execResult = await executeTest(tempFilePath, timeout);
        result.executionValid = execResult.valid;
        
        if (!execResult.valid) {
          result.errors.push(...execResult.errors);
          console.log("  [Validator] ❌ Execution validation failed");
        } else {
          console.log("  [Validator] ✅ Execution validation passed");
        }
      }
    }

    // Determine overall validity
    result.isValid = result.syntaxValid && (result.executionValid !== false);

    // If generated code changed via retries, we need to return the fixed code
    // HACK: we're mutating the caller's testCode if we need to because the original
    // interface didn't return the fixed code. We'll attach it to the result payload.
    (result as any).fixedTestCode = testCode !== initialTestCode ? testCode : undefined;

  } catch (error) {
    result.errors.push(`Validation error: ${error}`);
    result.isValid = false;
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
        fs.rmdirSync(tempDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  return result;
}

/**
 * Validate TypeScript syntax using tsc
 */
async function validateSyntax(
  filePath: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Use tsc to check syntax without emitting
    await execAsync(
      `npx tsc --noEmit --skipLibCheck --esModuleInterop --target ES2022 --module commonjs "${filePath}"`,
      { timeout: 30000 }
    );
    return { valid: true, errors: [] };
  } catch (error: any) {
    // Parse TypeScript errors
    const output = error.stdout || error.stderr || error.message;
    const errorLines = output
      .split("\n")
      .filter((line: string) => line.includes("error TS"));
    
    if (errorLines.length > 0) {
      errors.push(...errorLines.slice(0, 5)); // Limit to first 5 errors
    } else {
      errors.push(`TypeScript compilation failed: ${output.slice(0, 200)}`);
    }
    
    return { valid: false, errors };
  }
}

/**
 * B5: Hard gate against "validation theatre" — tests that compile but contain no
 * real assertions or meaningful browser interactions.
 */
function hasSubstantiveContent(testCode: string): { ok: boolean; reason?: string } {
  // Must have at least one expect() or screenshot assertion
  const hasAssertion = /expect\s*\(/.test(testCode) || /toHaveScreenshot/.test(testCode);
  if (!hasAssertion) {
    return { ok: false, reason: "no expect() assertions found — test verifies nothing" };
  }

  // Must have at least one navigation or interaction (not just comments)
  const hasAction = /goto\s*\(|navigate\s*\(|click\s*\(|fill\s*\(|type\s*\(|getBy/.test(testCode);
  if (!hasAction) {
    return { ok: false, reason: "no browser actions found (goto/click/fill/getBy)" };
  }

  // Reject pure placeholder bodies
  const strippedComments = testCode.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const nonWhitespace = strippedComments.replace(/\s/g, "");
  if (nonWhitespace.length < 100) {
    return { ok: false, reason: "test body is effectively empty after stripping comments" };
  }

  return { ok: true };
}

/**
 * Static analysis of test code for common issues
 */
function analyzeTestCode(testCode: string): { warnings: string[] } {
  const warnings: string[] = [];

  // Check for empty test blocks
  if (testCode.match(/test\([^)]+,\s*async\s*\(\)\s*=>\s*\{\s*\}\)/)) {
    warnings.push("Empty test block detected");
  }

  // Check for hardcoded waits without assertions
  const waitMatches = testCode.match(/waitForTimeout\(\d+\)/g);
  if (waitMatches && waitMatches.length > 5) {
    warnings.push(`Excessive waitForTimeout calls (${waitMatches.length}) - consider using proper waitFor conditions`);
  }

  // Check for missing assertions
  if (!testCode.includes("expect(") && !testCode.includes("toHaveScreenshot")) {
    warnings.push("No assertions found in test - test may not verify anything");
  }

  // Check for TODO comments
  if (testCode.includes("TODO:")) {
    warnings.push("Test contains TODO comments - may need manual completion");
  }

  // Check for placeholder comments
  if (testCode.includes("Manual steps required") || testCode.includes("Placeholder test")) {
    warnings.push("Test contains placeholder steps - specific actions may need to be added");
  }

  // Check for proper test structure
  if (!testCode.includes("test.describe") || !testCode.includes("test.beforeAll")) {
    warnings.push("Test may be missing proper structure (describe/beforeAll blocks)");
  }

  // Check for any selector usage (data-cy, data-testid, aria-label, or custom)
  const selectorCount = (testCode.match(/data-cy=|data-testid=|aria-label=|\[data-/g) || []).length;
  if (selectorCount < 2 && !testCode.includes("getByText") && !testCode.includes("getByRole")) {
    warnings.push("Few element selectors found - consider adding more specific assertions");
  }

  return { warnings };
}

/**
 * Execute test with Playwright to verify it runs
 */
async function executeTest(
  filePath: string,
  timeout: number
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Run Playwright test with timeout
    const { stdout, stderr } = await execAsync(
      `npx playwright test "${filePath}" --reporter=line --timeout=${timeout}`,
      { timeout: timeout + 10000 } // Add buffer for process overhead
    );

    // Check for failures in output
    if (stdout.includes("failed") || stderr.includes("failed")) {
      errors.push("Test execution failed - check test logic");
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message;
    
    // Parse specific error types
    if (output.includes("Timeout")) {
      errors.push("Test timed out - may have navigation or selector issues");
    } else if (output.includes("locator")) {
      errors.push("Selector not found - element may not exist on page");
    } else if (output.includes("net::ERR")) {
      errors.push("Network error - page may not be accessible");
    } else {
      errors.push(`Execution failed: ${output.slice(0, 300)}`);
    }

    return { valid: false, errors };
  }
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push("\n  ┌─────────────────────────────────────────┐");
  lines.push("  │         VALIDATION RESULTS              │");
  lines.push("  ├─────────────────────────────────────────┤");
  lines.push(`  │  Syntax Check:    ${result.syntaxValid ? "✅ PASSED" : "❌ FAILED"}            │`);
  
  if (result.executionValid !== null) {
    lines.push(`  │  Execution Check: ${result.executionValid ? "✅ PASSED" : "❌ FAILED"}            │`);
  } else {
    lines.push("  │  Execution Check: ⏭️  SKIPPED            │");
  }
  
  lines.push(`  │  Overall:         ${result.isValid ? "✅ VALID" : "❌ INVALID"}             │`);
  lines.push("  └─────────────────────────────────────────┘");

  if (result.errors.length > 0) {
    lines.push("\n  Errors:");
    result.errors.forEach((err) => lines.push(`    ❌ ${err}`));
  }

  if (result.warnings.length > 0) {
    lines.push("\n  Warnings:");
    result.warnings.forEach((warn) => lines.push(`    ⚠️  ${warn}`));
  }

  return lines.join("\n");
}

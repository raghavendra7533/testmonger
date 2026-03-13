/**
 * mcp-executor.ts
 * Agentic test execution using Gemini + Playwright MCP tools.
 *
 * Gemini drives a real browser step-by-step via MCP tools, observes what
 * happens, and—if a step fails—captures the current page state and patches
 * the failing selector/assertion.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { mcpBrowser } from "./browser-client";
import { AgentConfig } from "../config/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const MAX_RETRIES = parseInt(process.env.MCP_MAX_RETRIES ?? "3", 10);

export interface StepResult {
  description: string;
  status: "passed" | "failed" | "healed";
  error?: string;
}

export interface MCPExecutionResult {
  success: boolean;
  stepResults: StepResult[];
  healedTestCode: string | null;
  logs: string[];
  retryCount: number;
}

/**
 * Execute a generated test via the Gemini + Playwright MCP agentic loop.
 * If steps fail, Gemini observes the current page and patches the failing
 * selector/assertion (up to maxRetries times).
 */
export async function executeTestWithMCP(
  testCode: string,
  baseUrl: string,
  config: AgentConfig,
  maxRetries = MAX_RETRIES
): Promise<MCPExecutionResult> {
  await mcpBrowser.connect();

  const tools = await _buildGeminiTools();
  const logs: string[] = [];
  const stepResults: StepResult[] = [];
  let currentCode = testCode;
  let retryCount = 0;
  let success = false;

  while (retryCount <= maxRetries) {
    if (retryCount > 0) {
      console.log(`  [MCP-Exec] Heal attempt ${retryCount}/${maxRetries}...`);
    }

    const { passed, failedStep, newLogs } = await _runAgenticLoop(
      currentCode,
      baseUrl,
      tools
    );

    logs.push(...newLogs);

    if (passed) {
      success = true;
      stepResults.push({ description: "Full test execution", status: "passed" });
      break;
    }

    if (!failedStep || retryCount >= maxRetries) {
      stepResults.push({
        description: failedStep ?? "Test execution",
        status: "failed",
        error: "Max retries reached or no healable failure",
      });
      break;
    }

    const healed = await _healStep(currentCode, failedStep);
    if (!healed) {
      stepResults.push({ description: failedStep, status: "failed", error: "Healing failed" });
      break;
    }

    stepResults.push({ description: failedStep, status: "healed" });
    currentCode = healed;
    retryCount++;
  }

  return {
    success,
    stepResults,
    healedTestCode: currentCode !== testCode ? currentCode : null,
    logs,
    retryCount,
  };
}

// ── Internal: agentic loop ─────────────────────────────────────────────────────

async function _runAgenticLoop(
  testCode: string,
  baseUrl: string,
  tools: any[]
): Promise<{ passed: boolean; failedStep: string | null; newLogs: string[] }> {
  const newLogs: string[] = [];
  let failedStep: string | null = null;
  let passed = false;

  const systemInstruction = `You are a browser automation agent executing a Playwright test.
You have access to browser tools. Execute the test steps described in the code by calling the
appropriate browser tools. After each step, check whether it succeeded.

If a step fails (element not found, wrong text, assertion error), report the failure clearly:
start your message with "STEP FAILED:" followed by the failing line of code.

If all steps pass, end with "TEST PASSED".

Do not generate or explain code. Just execute steps using the tools.`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction,
    tools: [{ functionDeclarations: tools }],
  });

  const chat = model.startChat();

  const userMessage = `Execute this Playwright test against ${baseUrl}:

\`\`\`typescript
${testCode}
\`\`\`

Begin by navigating to ${baseUrl}, then execute each test step using browser tools.`;

  let currentMessage: any = userMessage;

  for (let turn = 0; turn < 30; turn++) {
    const result = await chat.sendMessage(currentMessage);
    const response = result.response;

    // Collect text parts
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const textParts = parts.filter((p: any) => p.text);
    for (const p of textParts) {
      newLogs.push(p.text);
      if (p.text.includes("TEST PASSED")) passed = true;
      if (p.text.startsWith("STEP FAILED:")) {
        failedStep = p.text.replace("STEP FAILED:", "").trim();
      }
    }

    // Check if Gemini is done (no function calls)
    const functionCalls = response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) break;

    // Execute each tool call and collect results
    const functionResponses: any[] = [];
    for (const fc of functionCalls) {
      console.log(`  [MCP-Exec] ${fc.name}(${JSON.stringify(fc.args).slice(0, 80)}...)`);
      try {
        const toolResult = await mcpBrowser.callTool(fc.name, fc.args as Record<string, unknown>);
        const resultText = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
        newLogs.push(`  → ${fc.name}: OK`);
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: { result: resultText.slice(0, 4000) },
          },
        });
      } catch (err: any) {
        const errMsg = err?.message ?? String(err);
        newLogs.push(`  → ${fc.name}: ERROR — ${errMsg}`);
        functionResponses.push({
          functionResponse: {
            name: fc.name,
            response: { error: errMsg },
          },
        });
      }
    }

    currentMessage = functionResponses;
  }

  return { passed, failedStep, newLogs };
}

// ── Internal: heal a failing step ─────────────────────────────────────────────

async function _healStep(
  testCode: string,
  failedStep: string
): Promise<string | null> {
  console.log(`  [MCP-Exec] Attempting to heal: ${failedStep.slice(0, 80)}`);

  let snapshot = "";
  try {
    snapshot = await mcpBrowser.getSnapshot();
  } catch {
    // proceed without snapshot
  }

  const prompt = `A Playwright test step failed. Here is the current page accessibility tree:

${snapshot || "(snapshot unavailable)"}

The failing test step was:
${failedStep}

Full test code:
\`\`\`typescript
${testCode}
\`\`\`

Based on the accessibility tree, identify the correct selector or assertion value,
and rewrite ONLY the failing line. Return the complete corrected test code with no
other changes. Do not include markdown code fences.`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    let healed = result.response.text();
    healed = healed.replace(/^```(typescript|ts)?\n/i, "").replace(/\n```$/i, "");
    return healed;
  } catch (err) {
    console.error("  [MCP-Exec] Healing LLM call failed:", err);
  }

  return null;
}

// ── Internal: build Gemini function declarations from MCP tools ───────────────

/** Recursively strip fields Gemini doesn't accept ($schema, additionalProperties) */
function sanitizeSchema(schema: any): any {
  if (typeof schema !== "object" || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  const out: any = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "$schema" || k === "additionalProperties") continue;
    out[k] = sanitizeSchema(v);
  }
  return out;
}

async function _buildGeminiTools(): Promise<any[]> {
  const mcpTools = await mcpBrowser.listTools();
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    parameters: sanitizeSchema(t.inputSchema ?? { type: "object", properties: {} }),
  }));
}

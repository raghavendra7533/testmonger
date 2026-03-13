/**
 * mcp-runner.mjs  (ESM)
 * Server-side MCP test runner — uses Ollama (llama3.1) via its OpenAI-compatible
 * API to drive the Playwright MCP agentic loop. No external API key required.
 *
 * Loaded via dynamic import() from the CJS bridge (server-mcp-runner.js).
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const MAX_SNAPSHOT_CHARS = 8000;
const DEFAULT_MAX_RETRIES = 3;

function trimSnapshot(snapshot) {
  if (snapshot.length <= MAX_SNAPSHOT_CHARS) return snapshot;
  return snapshot.slice(0, 4000) + '\n... [snapshot trimmed] ...\n' + snapshot.slice(-2000);
}

// ── Ollama chat call (OpenAI-compatible) ───────────────────────────────────────

async function ollamaChat(messages, tools, systemPrompt) {
  const body = {
    model: OLLAMA_MODEL,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    stream: false,
  };
  if (tools && tools.length > 0) body.tools = tools;

  const res = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── MCP client lifecycle ───────────────────────────────────────────────────────

async function createMcpClient() {
  const require = createRequire(ROOT + '/package.json');
  const mcpPkgJson = require.resolve('@playwright/mcp/package.json');
  const mcpBin = path.join(path.dirname(mcpPkgJson), 'cli.js');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpBin, '--browser', 'chromium', '--headless'],
  });

  const client = new Client(
    { name: 'screenshot-server-mcp', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  return client;
}

async function callTool(client, name, params = {}) {
  return client.callTool({ name, arguments: params });
}

async function getSnapshot(client) {
  const result = await callTool(client, 'browser_snapshot');
  const raw = result?.content?.[0]?.text ?? JSON.stringify(result);
  return trimSnapshot(raw);
}

async function listTools(client) {
  const result = await client.listTools();
  return result.tools;
}

// ── OpenAI-format tool mapping ─────────────────────────────────────────────────

/** Strip fields Ollama/OpenAI doesn't accept ($schema, additionalProperties) */
function sanitizeSchema(schema) {
  if (typeof schema !== 'object' || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchema);
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === '$schema' || k === 'additionalProperties') continue;
    out[k] = sanitizeSchema(v);
  }
  return out;
}

function buildOllamaTools(mcpTools) {
  return mcpTools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: sanitizeSchema(t.inputSchema ?? { type: 'object', properties: {} }),
    },
  }));
}

// ── Agentic execution loop ─────────────────────────────────────────────────────

async function runAgenticLoop(client, tools, testCode, baseUrl) {
  const logs = [];
  let failedStep = null;
  let passed = false;

  const systemPrompt = `You are a browser automation agent executing a Playwright test.
Execute the test steps by calling browser tools. After each step check whether it succeeded.
If a step fails, start your message with "STEP FAILED:" followed by the failing line.
If all steps pass, end with "TEST PASSED". Do not explain code — just execute.`;

  const messages = [
    {
      role: 'user',
      content: `Execute this Playwright test against ${baseUrl}:\n\n\`\`\`typescript\n${testCode}\n\`\`\`\n\nBegin by navigating to ${baseUrl}, then execute each step.`,
    },
  ];

  for (let turn = 0; turn < 30; turn++) {
    const data = await ollamaChat(messages, tools, systemPrompt);
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (msg?.content) {
      logs.push(msg.content);
      if (msg.content.includes('TEST PASSED')) passed = true;
      if (msg.content.startsWith('STEP FAILED:')) {
        failedStep = msg.content.replace('STEP FAILED:', '').trim();
      }
    }

    if (!msg?.tool_calls || msg.tool_calls.length === 0) break;

    // Add assistant turn with tool calls
    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });

    // Execute each tool call
    for (const tc of msg.tool_calls) {
      const fnName = tc.function.name;
      let fnArgs = {};
      try { fnArgs = JSON.parse(tc.function.arguments || '{}'); } catch {}

      try {
        const toolResult = await callTool(client, fnName, fnArgs);
        const text = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
        logs.push(`→ ${fnName}: OK`);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: text.slice(0, 4000),
        });
      } catch (err) {
        const msg = err?.message ?? String(err);
        logs.push(`→ ${fnName}: ERROR — ${msg}`);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: `ERROR: ${msg}`,
        });
      }
    }
  }

  return { passed, failedStep, logs };
}

// ── Heal a failing step ────────────────────────────────────────────────────────

async function healStep(client, testCode, failedStep) {
  let snapshot = '';
  try { snapshot = await getSnapshot(client); } catch { /* ignore */ }

  const prompt = `A Playwright test step failed. Current page accessibility tree:

${snapshot || '(snapshot unavailable)'}

Failing step:
${failedStep}

Full test code:
\`\`\`typescript
${testCode}
\`\`\`

Return the complete corrected test code with the failing line fixed. No markdown fences.`;

  try {
    const data = await ollamaChat([{ role: 'user', content: prompt }]);
    const text = data.choices?.[0]?.message?.content ?? '';
    return text
      .replace(/^```(typescript|ts)?\n/i, '')
      .replace(/\n```$/i, '');
  } catch { /* fall through */ }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

async function runTestWithMCP(code, filename, baseUrl, _apiKey, options = {}) {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  let client = null;
  const stepResults = [];
  const allLogs = [];
  let currentCode = code;
  let retryCount = 0;
  let success = false;

  try {
    client = await createMcpClient();
    const mcpTools = await listTools(client);
    const tools = buildOllamaTools(mcpTools);

    while (retryCount <= maxRetries) {
      const { passed, failedStep, logs } = await runAgenticLoop(
        client, tools, currentCode, baseUrl
      );
      allLogs.push(...logs);

      if (passed) {
        success = true;
        stepResults.push({ description: 'Full test execution', status: 'passed' });
        break;
      }

      if (!failedStep || retryCount >= maxRetries) {
        stepResults.push({
          description: failedStep ?? 'Test execution',
          status: 'failed',
          error: 'Max retries reached',
        });
        break;
      }

      const healed = await healStep(client, currentCode, failedStep);
      if (!healed) {
        stepResults.push({ description: failedStep, status: 'failed', error: 'Healing failed' });
        break;
      }

      stepResults.push({ description: failedStep, status: 'healed' });
      currentCode = healed;
      retryCount++;
    }
  } finally {
    if (client) {
      try { await client.close(); } catch { /* ignore */ }
    }
  }

  return {
    success,
    passed: success ? 1 : 0,
    failed: success ? 0 : 1,
    stepResults,
    healedCode: currentCode !== code ? currentCode : null,
    mcpLogs: allLogs,
    retryCount,
  };
}

export default { runTestWithMCP };

/**
 * browser-client.ts
 * Manages the lifecycle of a @playwright/mcp subprocess and exposes typed
 * helper methods so the rest of the codebase never has to deal with MCP
 * JSON-RPC directly.
 */

import { spawn, ChildProcess } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MAX_SNAPSHOT_CHARS = 8000;

/** Trim an accessibility snapshot to avoid flooding the Claude context window */
function trimSnapshot(snapshot: string): string {
  if (snapshot.length <= MAX_SNAPSHOT_CHARS) return snapshot;
  const head = snapshot.slice(0, 4000);
  const tail = snapshot.slice(-2000);
  return `${head}\n... [snapshot trimmed] ...\n${tail}`;
}

class McpBrowserClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private process: ChildProcess | null = null;
  private connectingPromise: Promise<void> | null = null;

  /** Lazily start the @playwright/mcp subprocess and connect the MCP client. */
  async connect(): Promise<void> {
    if (this.client) return; // already connected
    if (this.connectingPromise) return this.connectingPromise; // in-flight

    this.connectingPromise = this._doConnect();
    await this.connectingPromise;
    this.connectingPromise = null;
  }

  private async _doConnect(): Promise<void> {
    const headless = process.env.MCP_BROWSER_HEADLESS !== "false";
    console.log(`  [MCP] Starting Playwright MCP server (headless=${headless})...`);

    // Resolve the path to the playwright-mcp CLI via package.json (cli.js is in bin but not in exports)
    const path = require("path");
    const mcpPkgJson = require.resolve("@playwright/mcp/package.json");
    const mcpBin = path.join(path.dirname(mcpPkgJson), "cli.js");

    const args = ["--browser", "chromium"];
    if (headless) args.push("--headless");

    this.transport = new StdioClientTransport({
      command: process.execPath,  // node
      args: [mcpBin, ...args],
    });

    this.client = new Client(
      { name: "pr-test-agent", version: "1.0.0" },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
    console.log("  [MCP] Connected to Playwright MCP server");
  }

  /** Disconnect and kill the subprocess. */
  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.close();
    } catch {
      // ignore close errors
    }
    this.client = null;
    this.transport = null;
    console.log("  [MCP] Disconnected from Playwright MCP server");
  }

  /** List all tools exposed by the MCP server. */
  async listTools(): Promise<Array<{ name: string; description: string; inputSchema: unknown }>> {
    await this.connect();
    const result = await this.client!.listTools();
    return result.tools as Array<{ name: string; description: string; inputSchema: unknown }>;
  }

  /** Generic MCP tool call. */
  async callTool(name: string, params: Record<string, unknown> = {}): Promise<unknown> {
    await this.connect();
    const result = await this.client!.callTool({ name, arguments: params });
    return result;
  }

  // ── Typed helpers ────────────────────────────────────────────────────────────

  async navigate(url: string): Promise<void> {
    await this.callTool("browser_navigate", { url });
  }

  /** Returns the page accessibility tree as a trimmed string. */
  async getSnapshot(): Promise<string> {
    const result = await this.callTool("browser_snapshot") as any;
    const raw: string =
      result?.content?.[0]?.text ??
      (typeof result === "string" ? result : JSON.stringify(result));
    return trimSnapshot(raw);
  }

  async screenshot(): Promise<Buffer> {
    const result = await this.callTool("browser_screenshot") as any;
    const b64: string = result?.content?.[0]?.data ?? "";
    return Buffer.from(b64, "base64");
  }

  async click(selector: string): Promise<void> {
    await this.callTool("browser_click", { selector });
  }

  async type(selector: string, text: string): Promise<void> {
    await this.callTool("browser_type", { selector, text });
  }

  async evaluate(script: string): Promise<unknown> {
    const result = await this.callTool("browser_evaluate", { expression: script }) as any;
    return result?.content?.[0]?.text ?? result;
  }
}

/** Singleton — shared across the CLI pipeline when --use-mcp is active. */
export const mcpBrowser = new McpBrowserClient();

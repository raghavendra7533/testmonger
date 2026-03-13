/**
 * context-enricher.ts
 * Before test generation, navigate to the feature URL via the MCP browser and
 * capture the page accessibility tree. This gives Claude real selectors instead
 * of guesses derived from the diff.
 */

import { mcpBrowser } from "./browser-client";
import { AgentConfig } from "../config/types";

export interface MCPContext {
  snapshot: string;
  url: string;
  timestamp: number;
}

/**
 * Navigate to a feature URL (handling auth if needed) and return the page snapshot.
 * Called from the CLI pipeline as Step 3.5 when --use-mcp is active.
 */
export async function capturePageContext(
  featureUrl: string,
  config: AgentConfig
): Promise<MCPContext> {
  const targetUrl = featureUrl.startsWith("http")
    ? featureUrl
    : `${config.baseUrl.replace(/\/$/, "")}${featureUrl}`;

  console.log(`  [MCP] Capturing page context from: ${targetUrl}`);

  await mcpBrowser.connect();

  // Handle auth before navigating to the feature
  if (config.authStrategy === "form-login") {
    await _doFormLogin(config);
  } else if (config.authStrategy === "localstorage") {
    await _doLocalStorageAuth(config, targetUrl);
  }

  await mcpBrowser.navigate(targetUrl);

  // Wait briefly for the page to settle
  await new Promise((r) => setTimeout(r, 2000));

  const snapshot = await mcpBrowser.getSnapshot();
  console.log(`  [MCP] Snapshot captured (${snapshot.length} chars)`);

  return { snapshot, url: targetUrl, timestamp: Date.now() };
}

async function _doFormLogin(config: AgentConfig): Promise<void> {
  const fl = config.formLogin;
  const loginUrl = `${config.baseUrl.replace(/\/$/, "")}${fl.loginPath}`;
  console.log(`  [MCP] Logging in via form at ${loginUrl}...`);

  await mcpBrowser.navigate(loginUrl);
  await new Promise((r) => setTimeout(r, 1500));

  await mcpBrowser.click(fl.emailSelector);
  await mcpBrowser.type(fl.emailSelector, fl.testEmail);
  await mcpBrowser.click(fl.passwordSelector);
  await mcpBrowser.type(fl.passwordSelector, fl.testPassword);
  await mcpBrowser.click(fl.submitSelector);

  // Wait for post-login state
  await new Promise((r) => setTimeout(r, 3000));
  console.log("  [MCP] Login complete");
}

async function _doLocalStorageAuth(config: AgentConfig, targetUrl: string): Promise<void> {
  console.log("  [MCP] Injecting localStorage auth tokens...");
  // Navigate to the base URL first so localStorage is writable on the correct origin
  await mcpBrowser.navigate(config.baseUrl);
  await new Promise((r) => setTimeout(r, 1000));

  for (const entry of config.localStorageAuth.entries) {
    await mcpBrowser.evaluate(
      `localStorage.setItem(${JSON.stringify(entry.key)}, ${JSON.stringify(entry.value)})`
    );
  }
  console.log("  [MCP] localStorage auth tokens injected");
}

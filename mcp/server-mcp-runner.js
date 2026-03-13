/**
 * server-mcp-runner.js  (CommonJS bridge)
 *
 * screenshot-server.js is CommonJS.  @playwright/mcp and @modelcontextprotocol/sdk
 * are ESM-only.  This thin CJS wrapper uses a dynamic import() to load the ESM
 * runner (mcp-runner.mjs) on first use and caches the result.
 */

'use strict';

let _runnerPromise = null;

function getRunner() {
  if (!_runnerPromise) {
    _runnerPromise = import('./mcp-runner.mjs').then((mod) => mod.default);
  }
  return _runnerPromise;
}

module.exports = {
  /**
   * Execute a Playwright test via the Claude + Playwright MCP agentic loop.
   *
   * @param {string}  code         - TypeScript test code
   * @param {string}  filename     - Filename hint (for logs)
   * @param {string}  baseUrl      - Application base URL
   * @param {string}  anthropicKey - Anthropic API key
   * @param {object}  [options]    - { maxRetries?: number }
   * @returns {Promise<object>}
   */
  async runTestWithMCP(code, filename, baseUrl, anthropicKey, options = {}) {
    const runner = await getRunner();
    return runner.runTestWithMCP(code, filename, baseUrl, anthropicKey, options);
  },
};

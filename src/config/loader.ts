import * as fs from 'fs';
import * as path from 'path';
import { AgentConfig, DEFAULT_AGENT_CONFIG } from './types';

/**
 * Load AgentConfig by merging (in priority order):
 *  1. JSON file from --config CLI arg or PR_AGENT_CONFIG env var
 *  2. Auto-detected .pr-agent.json in cwd
 *  3. Individual env var overrides
 *  4. DEFAULT_AGENT_CONFIG
 *
 * The JSON file format is identical to the frontend's "Export Config" output,
 * so users can export from the UI and use it directly with --config.
 */
export function loadConfig(cliConfigPath?: string): AgentConfig {
  let fileConfig: Partial<AgentConfig> = {};

  // Determine config file path
  const configFilePath =
    cliConfigPath ||
    process.env.PR_AGENT_CONFIG ||
    (fs.existsSync(path.join(process.cwd(), '.pr-agent.json'))
      ? path.join(process.cwd(), '.pr-agent.json')
      : undefined);

  if (configFilePath) {
    const resolved = path.resolve(configFilePath);
    if (!fs.existsSync(resolved)) {
      console.warn(`[Config] Warning: config file not found at ${resolved}`);
    } else {
      try {
        const raw = fs.readFileSync(resolved, 'utf-8');
        fileConfig = JSON.parse(raw);
        console.log(`[Config] Loaded config from ${resolved}`);
      } catch (e) {
        console.warn(`[Config] Warning: failed to parse config file at ${resolved}:`, e);
      }
    }
  }

  // Merge: defaults ← file ← env overrides
  const merged: AgentConfig = deepMerge(DEFAULT_AGENT_CONFIG, fileConfig);

  // Env var overrides (fine-grained, useful for CI)
  if (process.env.GITHUB_TOKEN) merged.githubToken = process.env.GITHUB_TOKEN;
  if (process.env.TEST_BASE_URL) merged.baseUrl = process.env.TEST_BASE_URL;
  if (process.env.PLAYWRIGHT_TEST_BASE_URL) merged.baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
  if (process.env.TEST_EMAIL) merged.formLogin.testEmail = process.env.TEST_EMAIL;
  if (process.env.TEST_PASSWORD) merged.formLogin.testPassword = process.env.TEST_PASSWORD;
  if (process.env.TEST_REPO_OWNER) merged.targetRepo.owner = process.env.TEST_REPO_OWNER;
  if (process.env.TEST_REPO_NAME) merged.targetRepo.name = process.env.TEST_REPO_NAME;
  // B2: honour USE_MCP env var (truthy string → enable MCP)
  if (process.env.USE_MCP) merged.useMcp = process.env.USE_MCP !== "0" && process.env.USE_MCP !== "false";

  return merged;
}

/** Shallow-deep merge: top-level object fields are merged, primitives are overwritten */
function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const val = override[key];
    if (val === undefined || val === null) continue;
    if (
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      // Merge nested objects (one level deep)
      result[key] = { ...(base[key] as object), ...(val as object) } as T[typeof key];
    } else {
      result[key] = val as T[typeof key];
    }
  }
  return result;
}

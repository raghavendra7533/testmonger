import { PRInfo, PRFile } from "../github/client";
import { AgentConfig, DEFAULT_AGENT_CONFIG } from "../config/types";

export interface AnalyzedPR {
  prInfo: PRInfo;
  bugFixType: string | null;
  ticketId: string | null;
  affectedFeatures: string[];
  suggestedTestPath: string;
  testContext: TestContext;
}

export interface TestContext {
  changedFunctions: string[];
  changedComponents: string[];
  relatedSelectors: string[];
  bugDescription: string;
  cssClasses: string[];
  jsxElements: string[];
  textContent: string[];
  pageMetadata: { title?: string; description?: string };
  isStandaloneApp: boolean;
}

/**
 * Analyze a PR to extract test-relevant information.
 * All pattern matching is driven by config — no hardcoded platform values.
 */
export function analyzePR(prInfo: PRInfo, config: AgentConfig = DEFAULT_AGENT_CONFIG): AnalyzedPR {
  const ticketId = extractTicketId(prInfo.title, prInfo.body, config);
  const bugFixType = detectBugFixType(prInfo);
  const affectedFeatures = detectAffectedFeatures(prInfo.files, config);
  const testContext = extractTestContext(prInfo, config);
  const suggestedTestPath = suggestTestPath(config, ticketId, prInfo.number);

  return {
    prInfo,
    bugFixType,
    ticketId,
    affectedFeatures,
    suggestedTestPath,
    testContext,
  };
}

/**
 * Extract ticket ID from PR title or body using config.ticketPatterns.
 */
function extractTicketId(
  title: string,
  body: string | null,
  config: AgentConfig,
): string | null {
  const text = `${title} ${body || ""}`;

  for (const { pattern } of config.ticketPatterns) {
    try {
      const re = new RegExp(pattern, "i");
      const m = text.match(re);
      if (m) return m[1] ?? m[0];
    } catch {
      // ignore malformed regex
    }
  }

  return null;
}

/**
 * Detect the type of bug fix based on PR labels and title.
 */
function detectBugFixType(prInfo: PRInfo): string | null {
  const labels = prInfo.labels.map((l) => l.toLowerCase());
  const title = prInfo.title.toLowerCase();

  if (labels.includes("bug") || title.includes("fix")) {
    if (title.includes("ui") || title.includes("visual")) return "ui";
    if (title.includes("api") || title.includes("endpoint")) return "api";
    if (title.includes("performance") || title.includes("slow")) return "performance";
    if (title.includes("crash") || title.includes("error")) return "error-handling";
    return "general";
  }

  if (labels.includes("feature") || title.includes("feat")) {
    return "feature";
  }

  return null;
}

/**
 * Detect which features are affected based on file paths,
 * using config.featureMappings instead of hardcoded patterns.
 */
function detectAffectedFeatures(files: PRFile[], config: AgentConfig): string[] {
  const features = new Set<string>();

  for (const file of files) {
    for (const mapping of config.featureMappings) {
      try {
        const regexes = mapping.patterns.map((p) => new RegExp(p, "i"));
        if (regexes.some((r) => r.test(file.filename))) {
          features.add(mapping.name);
        }
      } catch {
        // ignore malformed pattern
      }
    }
  }

  return Array.from(features);
}

/**
 * Extract context useful for test generation from PR diffs.
 */
function extractTestContext(prInfo: PRInfo, config: AgentConfig): TestContext {
  const changedFunctions: string[] = [];
  const changedComponents: string[] = [];
  const relatedSelectors: string[] = [];
  const cssClasses: string[] = [];
  const jsxElements: string[] = [];
  const textContent: string[] = [];
  const pageMetadata: { title?: string; description?: string } = {};

  // isStandaloneApp: true when there's no auth setup and no feature mappings
  // (i.e. the user hasn't configured the app — generate a generic structural test)
  const isStandaloneApp =
    config.authStrategy === "none" && config.featureMappings.length === 0;

  // Determine which selector attribute to extract from diffs
  const selectorAttr =
    config.selectorConvention === "custom"
      ? config.customSelectorAttribute || "data-testid"
      : config.selectorConvention === "aria-label"
      ? "aria-label"
      : config.selectorConvention === "data-cy"
      ? "data-cy"
      : "data-testid";

  for (const file of prInfo.files) {
    if (!file.patch) continue;

    // Extract function names
    const funcPatterns = [
      /^[+-]\s*(async\s+)?(function\s+)?(\w+)\s*\(/gm,
      /^[+-]\s*const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm,
      /^[+-]\s*(\w+)\s*:\s*(?:async\s*)?\(/gm,
      /^[+-]\s*(?:export\s+)?(?:async\s+)?(\w+)\s*=\s*\(/gm,
    ];

    for (const pattern of funcPatterns) {
      const matches = file.patch.matchAll(pattern);
      for (const match of matches) {
        const funcName = match[3] || match[1];
        if (
          funcName &&
          !changedFunctions.includes(funcName) &&
          funcName.length > 1 &&
          !["if", "for", "while", "switch", "return", "await", "const", "let", "var"].includes(
            funcName,
          )
        ) {
          changedFunctions.push(funcName);
        }
      }
    }

    // Extract React component names (PascalCase)
    const compMatches = file.patch.matchAll(
      /^[+-]\s*(?:export\s+)?(?:const|function)\s+([A-Z][a-zA-Z0-9]+)/gm,
    );
    for (const match of compMatches) {
      if (match[1] && !changedComponents.includes(match[1])) {
        changedComponents.push(match[1]);
      }
    }

    // Extract configured selector attribute values
    const selectorRe = new RegExp(`${selectorAttr}=["']([^"']+)["']`, "g");
    const selectorMatches = file.patch.matchAll(selectorRe);
    for (const match of selectorMatches) {
      if (match[1] && !relatedSelectors.includes(match[1])) {
        relatedSelectors.push(match[1]);
      }
    }

    // Always also extract aria-label if convention is not aria-label (bonus context)
    if (selectorAttr !== "aria-label") {
      const ariaMatches = file.patch.matchAll(/aria-label=["']([^"']+)["']/g);
      for (const match of ariaMatches) {
        if (match[1] && !relatedSelectors.includes(match[1])) {
          relatedSelectors.push(match[1]);
        }
      }
    }

    // Extract CSS class names from .css/.scss/.module.css files
    if (file.filename.match(/\.(css|scss|module\.css)$/)) {
      const cssClassMatches = file.patch.matchAll(/^[+]\.([a-zA-Z][a-zA-Z0-9_-]*)\s*\{/gm);
      for (const match of cssClassMatches) {
        if (match[1] && !cssClasses.includes(match[1])) {
          cssClasses.push(match[1]);
        }
      }
    }

    // Extract CSS class names from className={styles.xxx}
    const styleClassMatches = file.patch.matchAll(/className=\{[^}]*styles\.([a-zA-Z][a-zA-Z0-9_]*)/g);
    for (const match of styleClassMatches) {
      if (match[1] && !cssClasses.includes(match[1])) {
        cssClasses.push(match[1]);
      }
    }

    // Extract JSX elements (semantic HTML tags)
    const jsxElementMatches = file.patch.matchAll(
      /^[+]\s*<(h[1-6]|p|section|article|header|footer|main|nav|aside|div)[^>]*>/gm,
    );
    for (const match of jsxElementMatches) {
      if (match[1] && !jsxElements.includes(match[1])) {
        jsxElements.push(match[1]);
      }
    }

    // Extract text content from JSX
    const textMatches = file.patch.matchAll(
      /^[+]\s*<(?:h[1-6]|p|span|button|a)[^>]*>([^<]{5,100})</gm,
    );
    for (const match of textMatches) {
      const text = match[1].trim();
      if (text && !textContent.includes(text) && !text.includes("{")) {
        textContent.push(text);
      }
    }

    // Extract page title
    const titleMatch = file.patch.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      pageMetadata.title = titleMatch[1];
    }

    // Extract meta description
    const descMatch = file.patch.match(
      /meta\s+name=["']description["']\s+content=["']([^"']+)["']/,
    );
    if (descMatch) {
      pageMetadata.description = descMatch[1];
    }

    // Extract className patterns (PascalCase suffixes like Card, Button, Modal)
    const classMatches = file.patch.matchAll(
      /className=["'][^"']*([A-Z][a-zA-Z]+(?:Card|Button|Modal|Panel|List|Item))[^"']*["']/g,
    );
    for (const match of classMatches) {
      if (match[1] && !changedComponents.includes(match[1])) {
        changedComponents.push(match[1]);
      }
    }
  }

  const bugDescription = prInfo.body ? prInfo.body.slice(0, 500) : prInfo.title;

  return {
    changedFunctions,
    changedComponents,
    relatedSelectors,
    bugDescription,
    cssClasses,
    jsxElements,
    textContent,
    pageMetadata,
    isStandaloneApp,
  };
}

/**
 * Suggest a test file path based on config output settings.
 */
function suggestTestPath(
  config: AgentConfig,
  ticketId: string | null,
  prNumber: number,
): string {
  const baseDir = config.outputDirectory.replace(/\/$/, "");
  const fileName = ticketId ? `${ticketId}.spec.ts` : `pr-${prNumber}.spec.ts`;
  return `${baseDir}/${fileName}`;
}

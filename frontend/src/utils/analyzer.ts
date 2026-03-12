import type { AppConfig, PRAnalysis } from '../store';

export function extractTicketId(
  title: string,
  body: string | null,
  ticketPatterns: AppConfig['ticketPatterns'],
): string | null {
  const combined = `${title} ${body || ''}`;
  for (const tp of ticketPatterns) {
    try {
      const regex = new RegExp(tp.pattern, 'i');
      const match = combined.match(regex);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    } catch {
      // Skip invalid patterns
    }
  }
  return null;
}

export function detectBugFixType(
  labels: Array<{ name: string }>,
  title: string,
): string | null {
  const bugLabels = ['bug', 'fix', 'hotfix', 'patch', 'bugfix', 'defect'];
  const titleLower = title.toLowerCase();

  for (const label of labels) {
    if (bugLabels.includes(label.name.toLowerCase())) {
      return label.name;
    }
  }

  if (/\b(fix|bug|hotfix|patch|resolve|repair)\b/i.test(titleLower)) {
    return 'title-detected';
  }

  return null;
}

export function detectAffectedFeatures(
  files: Array<{ filename: string }>,
  featureMappings: AppConfig['featureMappings'],
): string[] {
  const features = new Set<string>();

  for (const file of files) {
    const filenameLower = file.filename.toLowerCase();
    for (const mapping of featureMappings) {
      for (const pattern of mapping.patterns) {
        if (filenameLower.includes(pattern.toLowerCase())) {
          features.add(mapping.name);
          break;
        }
      }
    }
  }

  return Array.from(features);
}

export function extractSelectorsFromDiff(patch: string | undefined): string[] {
  if (!patch) return [];
  const selectors = new Set<string>();

  // Match data-cy="..." and data-testid="..."
  const selectorRegex = /data-(?:cy|testid)=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = selectorRegex.exec(patch)) !== null) {
    selectors.add(match[1]);
  }

  return Array.from(selectors);
}

export function extractComponents(patch: string | undefined): string[] {
  if (!patch) return [];
  const components = new Set<string>();

  // Match PascalCase component names (e.g., <ComponentName, import ComponentName)
  const componentRegex = /(?:<|import\s+)([A-Z][a-zA-Z0-9]+)/g;
  let match: RegExpExecArray | null;
  while ((match = componentRegex.exec(patch)) !== null) {
    const name = match[1];
    // Filter out common non-component PascalCase words
    if (!['React', 'Component', 'Fragment', 'Suspense', 'Error', 'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Map', 'Set'].includes(name)) {
      components.add(name);
    }
  }

  return Array.from(components);
}

export function extractFunctions(patch: string | undefined): string[] {
  if (!patch) return [];
  const functions = new Set<string>();

  // Match function declarations and arrow functions
  const patterns = [
    /(?:function\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g,
    /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(patch)) !== null) {
      const name = match[1];
      if (name.length > 2 && !['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'class', 'const', 'let', 'var'].includes(name)) {
        functions.add(name);
      }
    }
  }

  return Array.from(functions);
}

export function analyzePR(
  prData: { pr: any; files: any[] },
  config: AppConfig,
): PRAnalysis {
  const { pr, files } = prData;

  const ticketId = extractTicketId(
    pr.title,
    pr.body,
    config.ticketPatterns,
  );

  const bugFixType = detectBugFixType(pr.labels || [], pr.title);
  const affectedFeatures = detectAffectedFeatures(files, config.featureMappings);

  const allPatches = files.map((f: any) => f.patch || '').join('\n');
  const relatedSelectors = extractSelectorsFromDiff(allPatches);
  const changedComponents = extractComponents(allPatches);
  const changedFunctions = extractFunctions(allPatches);

  return {
    prTitle: pr.title,
    prNumber: pr.number,
    owner: pr.base?.repo?.owner?.login || config.sourceRepo.owner,
    repo: pr.base?.repo?.name || config.sourceRepo.name,
    ticketId,
    bugFixType,
    affectedFeatures,
    filesChanged: files.length,
    additions: files.reduce((sum: number, f: any) => sum + (f.additions || 0), 0),
    deletions: files.reduce((sum: number, f: any) => sum + (f.deletions || 0), 0),
    relatedSelectors,
    changedComponents,
    changedFunctions,
  };
}

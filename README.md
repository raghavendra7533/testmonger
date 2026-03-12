# PR-Test-Agent

An automated Playwright test generation agent that reads a GitHub Pull Request, analyzes its diff, and produces a ready-to-run end-to-end test — then commits that test and opens a PR in your test repository.

---

## How It Works

```
GitHub PR URL
     │
     ▼
Fetch PR  ──── title, body, labels, files, diff  (GitHub API)
     │
     ▼
Analyze PR ─── ticket ID · bug type · affected features
               changed functions · React components
               data-cy / data-testid selectors
               CSS classes · JSX elements · text content
     │
     ▼
Generate Test ─ full Playwright spec (.spec.ts)
               two modes: Rocketium app · standalone app
     │
     ▼
Validate ──────  TypeScript syntax (tsc)
               optional: Playwright execution
     │
     ▼
Commit & PR ─── new branch → commit test file → open PR
               (skipped in --dry-run mode)
```

---

## Project Structure

```
pr-test-agent/
├── src/
│   ├── index.ts                  # CLI entry point & main orchestrator
│   ├── analyzer/
│   │   └── pr-analyzer.ts        # PR analysis: features, selectors, context
│   ├── generator/
│   │   └── test-generator.ts     # Playwright test code generation
│   ├── github/
│   │   └── client.ts             # GitHub API wrapper (Octokit)
│   ├── validator/
│   │   └── test-validator.ts     # TS syntax + Playwright execution validation
│   └── components/
│       └── TextAlignment.tsx     # Example React component (data-cy reference)
├── e2e/
│   └── common/
│       └── utils.ts              # Auth helper (localStorage injection)
├── playwright.config.ts          # Playwright configuration
├── .env.example                  # Environment variable template
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- Node.js 18+
- A GitHub Personal Access Token with `repo` scope
- A target GitHub repository where generated tests will be pushed

---

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Install Playwright browsers**

```bash
npx playwright install chromium
```

**3. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: GitHub token with repo access
GITHUB_TOKEN=ghp_your_token_here

# Target repository where generated tests are committed
TEST_REPO_OWNER=your_org_or_username
TEST_REPO_NAME=your_test_repo_name

# Base URL for the application under test
PLAYWRIGHT_TEST_BASE_URL=https://staging.your-app.com

# Optional: for localStorage-based auth (Rocketium mode)
PLAYWRIGHT_USER_ID=your_user_id
PLAYWRIGHT_SESSION_ID=your_session_id
```

---

## Usage

```bash
npx ts-node src/index.ts <github-pr-url> [options]
```

### Options

| Flag | Description |
|---|---|
| `--dry-run` | Generate the test locally without creating a branch or PR |
| `--skip-validation` | Skip TypeScript syntax validation before committing |
| `--run-test` | Execute the generated test with Playwright during validation |
| `--help` | Show usage information |

### Examples

```bash
# Generate + validate + commit test and open PR
npx ts-node src/index.ts https://github.com/owner/repo/pull/123

# Preview generated test locally without touching GitHub
npx ts-node src/index.ts https://github.com/owner/repo/pull/123 --dry-run

# Generate, run the test against the real app, then commit
npx ts-node src/index.ts https://github.com/owner/repo/pull/123 --run-test

# Skip validation (useful when tsc is not configured globally)
npx ts-node src/index.ts https://github.com/owner/repo/pull/123 --skip-validation
```

---

## Pipeline Steps

### Step 1 — Parse PR URL

Extracts `owner`, `repo`, and PR number from any valid GitHub PR URL:

```
https://github.com/{owner}/{repo}/pull/{number}
```

### Step 2 — Fetch PR Information

Uses the GitHub REST API (Octokit) to retrieve:
- PR title, body, and labels
- List of changed files with additions/deletions
- Full unified diff for each file

### Step 3 — Analyze PR

**Ticket ID extraction** — scans title and body for patterns:

| Pattern | Example |
|---|---|
| `TKT-1234` | `[TKT-4521] Fix text alignment` |
| `JIRA-123` | `JIRA-99 crash on export` |
| `DEV-123` | `DEV-42: button overlap` |
| `#123` | `#874 broken scroll` |

**Bug type detection** — classifies by labels and title keywords:

| Type | Triggers |
|---|---|
| `ui` | "ui", "visual" in title |
| `api` | "api", "endpoint" in title |
| `performance` | "performance", "slow" in title |
| `error-handling` | "crash", "error" in title |
| `feature` | "feature" label or "feat" in title |
| `general` | "bug" label or "fix" in title |

**Feature detection** — maps changed file paths to 14 feature areas:

| Feature | File patterns |
|---|---|
| `editor` | editor, canvas, layer, viewport, zoom |
| `text-styling` | text, font, typography, alignment |
| `canvas-tools` | grid, ruler, guide, snap |
| `video-settings` | video, download, export, gif, mp4, mov |
| `media-library` | media, library, asset, upload, image |
| `brand-management` | brand, font, color, palette |
| `design-system` | component, design, style |
| `ai-studio` | ai-studio, translate, generate, magic |
| `authentication` | auth, login, session, signup |
| `templates` | template, alltemplates |
| `projects` | project, campaign, allprojects |
| `workspace` | workspace, team, org |
| `settings` | setting, config, preference |
| `billing` | billing, payment, subscription |

**Context extraction from diff** — scans each file's patch for:
- Function names (all declaration styles)
- React component names (PascalCase exports)
- `data-cy` and `data-testid` attribute values
- CSS class names (`.scss`/`.css`/CSS Modules)
- Semantic JSX elements (`h1`–`h6`, `main`, `header`, `footer`, etc.)
- Visible text content between JSX tags
- `<title>` and `<meta name="description">` values

### Step 4 — Generate Test

The generator produces a fully structured Playwright test file and selects one of two modes:

**Rocketium App Mode** (default for the primary product)
- Full login flow via UI (email + password form)
- One-login popup handling
- Workspace search and selection
- PostHog survey dismissal
- Feature-specific navigation steps based on detected features
- `data-cy` selector assertions from the diff
- Screenshot comparison assertion (`toHaveScreenshot`)
- Cleanup step to navigate back

**Standalone App Mode** (activated when files include `pages/`, `app/`, `next.config`, or `package.json`, but no Rocketium-specific paths)
- No authentication step
- Configurable `BASE_URL` (defaults to `http://localhost:3000`)
- Page title verification (if `<title>` was changed)
- Text content visibility checks using `getByText()`
- Semantic HTML element assertions (`h1`, `main`, `header`, etc.)
- Section-level screenshots (`<main>`, `<header>`, `<footer>`)
- Full-page screenshot comparison
- Optional mobile viewport test (if `@media` queries or responsive class names detected)

Generated tests are placed at:

```
mcpTests/{TICKET_ID}-{clean-title}-{repo-name}.spec.ts
```

### Step 5 — Validate

Before committing, the agent validates the generated test:

| Check | When |
|---|---|
| **TypeScript syntax** (`tsc --noEmit`) | Always (unless `--skip-validation`) |
| **Static analysis** | Always — warns about empty blocks, excessive `waitForTimeout`, missing assertions, TODO comments |
| **Playwright execution** | Only with `--run-test` flag |

If validation fails the agent exits with an error and does not commit.

### Steps 6–8 — Commit and Open PR

1. Creates a new branch: `test/{TICKET_ID}-{timestamp}` in the target repository
2. Commits the test file with a structured commit message
3. Opens a PR with a generated body that includes:
   - Link back to the source PR
   - Affected features list
   - Changed files table
   - Detected components and selectors

---

## Generated Test PR Body

Each generated PR contains a structured summary:

```markdown
## Auto-Generated Test for Bug Fix

### Source PR
| Field | Value |
|-------|-------|
| Repository | owner/repo |
| PR Number  | #123       |
| Title      | Fix text alignment on click |
| Ticket     | TKT-4521   |

### Test Information
- Test File: mcpTests/TKT-4521-fix-text-alignment-react.spec.ts
- Affected Features: text-styling, editor

### Files Changed in Source PR
- src/components/TextAlignment.tsx (+12/-3)
...
```

---

## Playwright Configuration

Tests run under two Playwright projects defined in `playwright.config.ts`:

| Project | Test directory | Browser |
|---|---|---|
| `mcp-tests` | `./mcpTests` | Chrome (Desktop) |
| `e2e` | `./e2e` | Chrome (Desktop) |

Key settings:

| Setting | Value |
|---|---|
| Viewport | 1440 × 900 |
| Action timeout | 30 s |
| Navigation timeout | 30 s |
| Test timeout | 5 min |
| Screenshot | On failure only |
| Video | Retained on failure |
| Screenshot diff tolerance | 3500 px / 0.2 threshold |

Run all tests:

```bash
npm test
# or
npx playwright test
```

Run only MCP-generated tests:

```bash
npx playwright test --project=mcp-tests
```

View HTML report:

```bash
npx playwright show-report
```

---

## Auth Utility

`e2e/common/utils.ts` provides `injectLoginDetails(page)` for tests that use localStorage-based authentication (Rocketium session cookies) instead of the UI login flow. Set these environment variables and call the helper in your `beforeAll`:

```typescript
import { injectLoginDetails } from "../common/utils";

await injectLoginDetails(page);
await page.reload();
```

---

## npm Scripts

| Script | Command |
|---|---|
| `npm run dev` | Run agent with `ts-node` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled agent |
| `npm test` | Run all Playwright tests |
| `npm run lint` | ESLint on `src/**/*.ts` |

---

## GitHub Token Scopes Required

| Scope | Purpose |
|---|---|
| `repo` | Read source PR (private repos) · Create branch, file, PR in test repo |
| `workflow` | Optional — if triggering GitHub Actions |

Generate a token at: **GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)**

---

## Extending the Agent

### Add a new feature area

In [src/analyzer/pr-analyzer.ts](src/analyzer/pr-analyzer.ts), add an entry to the `featurePatterns` map:

```typescript
"my-feature": [/my-pattern/i, /another-pattern/i],
```

### Add test steps for the new feature

In [src/generator/test-generator.ts](src/generator/test-generator.ts), add a block inside `generateTestSteps()`:

```typescript
if (affectedFeatures.includes("my-feature")) {
  steps.push(`    // Test my-feature
    await sharedPage.locator('[data-cy="my-element"]').click();
    await expect(sharedPage.locator('[data-cy="result"]')).toBeVisible();`);
}
```

### Add a new ticket ID format

In [src/analyzer/pr-analyzer.ts](src/analyzer/pr-analyzer.ts), add a regex to the `patterns` array inside `extractTicketId()`:

```typescript
/\[?(MYORG[-_]?\d+)\]?/i,
```

---

## Roadmap

| Feature | Description |
|---|---|
| **GitHub Webhook** | Auto-trigger agent when a PR is opened with `bug` label |
| **LLM Enhancement** | Use Claude to generate smarter, context-aware test steps from the diff |
| **Slack Notifications** | Post to `#qa-automation` when a test PR is created |
| **Batch Processing** | Process multiple PR URLs in a single run |
| **Historical Backfill** | Scan merged bug-fix PRs and generate tests retroactively |
| **CI Integration** | Run generated test in CI and report results back to the source PR |
| **Visual Regression** | Upload screenshots to Percy or Chromatic for baseline comparison |

---

## Author

**Thiru S** — [pr-test-agent v1.0](package.json)

License: MIT

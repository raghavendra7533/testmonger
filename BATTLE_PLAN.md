# 🎯 PR-Test-Agent: 3.5 Hour Battle Plan

> **Current Time:** Feb 5, 2026 | **Remaining:** ~3.5 hours
> **Status:** Waiting for private repo + admin access

---

## 🏆 What You've Built So Far

Your **PR-Test-Agent** is a working end-to-end automation system:

```
┌─────────────────────────────────────────────────────────────────┐
│                     PR-TEST-AGENT v1.0                          │
├─────────────────────────────────────────────────────────────────┤
│  INPUT:  GitHub PR URL (bug fix)                                │
│          ↓                                                      │
│  FETCH:  PR metadata, files, diff via GitHub API                │
│          ↓                                                      │
│  ANALYZE: Extract ticket ID, bug type, affected features,       │
│           changed functions, data-cy selectors from diff        │
│          ↓                                                      │
│  GENERATE: Full Playwright test with:                           │
│            - Auth setup (localStorage injection)                │
│            - Smart test steps based on detected features        │
│            - Screenshot verification                            │
│          ↓                                                      │
│  COMMIT:  Create branch → Commit test → Open PR                 │
└─────────────────────────────────────────────────────────────────┘
```

**Current Capabilities:**
- ✅ Parses any GitHub PR URL
- ✅ Extracts TKT-XXXX, JIRA-XXXX ticket IDs
- ✅ Detects 8 feature areas (editor, video-settings, brand-management, etc.)
- ✅ Extracts changed functions & React components from diff
- ✅ Finds `data-cy` selectors automatically
- ✅ Generates full Playwright test with proper auth
- ✅ Auto-creates PR with detailed body
- ✅ Works in dry-run mode for testing

---

## 🔓 When You Get Private Repo + Admin Access

### Configuration Checklist

```bash
# 1. Update your .env file
GITHUB_TOKEN=ghp_YOUR_NEW_TOKEN_WITH_EXPANDED_SCOPE

# Token needs these scopes:
# - repo (full control of private repositories)
# - admin:repo_hook (for webhooks - optional but nice)
# - workflow (if triggering GitHub Actions)

# 2. Point to internal repos
TEST_REPO_OWNER=rocketium          # or your org name
TEST_REPO_NAME=qa-automated-tests  # target test repo
```

### Quick Validation Commands

```bash
# Test your token works with private repos
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/rocketium/PRIVATE_REPO_NAME

# Run agent in dry-run on a real internal PR
npx ts-node src/index.ts https://github.com/rocketium/react/pull/174 --dry-run
```

---

## 🚀 What You Can Build in 3.5 Hours

### TIER 1: Quick Wins (30-45 min each)

#### 1A. **GitHub Webhook Integration** ⭐ HIGH IMPACT
Automatically trigger test generation when PRs are opened/labeled.

```
┌──────────────────────────────────────────────────────────────┐
│  PR Opened with label "bug"                                  │
│       ↓                                                      │
│  GitHub Webhook fires to your endpoint                       │
│       ↓                                                      │
│  Agent generates test + opens test PR automatically          │
│       ↓                                                      │
│  Comments back on original PR with test PR link              │
└──────────────────────────────────────────────────────────────┘
```

**What you need:**
- Simple Express server (50 lines)
- Ngrok for local testing OR deploy to Vercel/Railway
- Webhook secret validation

#### 1B. **Slack/Teams Notifications** ⭐ QUICK WIN
Notify QA channel when tests are generated.

```typescript
// Add to index.ts after PR creation
await sendSlackNotification({
  channel: "#qa-automation",
  text: `🤖 New test generated for ${ticketId}`,
  attachments: [{
    title: prInfo.title,
    title_link: newPR.url,
    fields: [
      { title: "Source PR", value: sourcePRUrl },
      { title: "Features", value: affectedFeatures.join(", ") }
    ]
  }]
});
```

#### 1C. **MCP Browser Verification** ⭐ IMPRESSIVE DEMO
Run the generated test immediately using Cursor's MCP browser!

```
┌──────────────────────────────────────────────────────────────┐
│  Agent generates test                                        │
│       ↓                                                      │
│  Opens browser via MCP                                       │
│       ↓                                                      │
│  Runs through test steps visually                            │
│       ↓                                                      │
│  Takes screenshots + validates                               │
│       ↓                                                      │
│  Attaches results to test PR                                 │
└──────────────────────────────────────────────────────────────┘
```

---

### TIER 2: Medium Effort (1-1.5 hours each)

#### 2A. **LLM-Powered Test Enhancement** 🧠 GAME CHANGER
Use Claude/GPT to generate smarter test steps from PR context.

```
Current: Pattern-matching on features → generic steps
Enhanced: LLM reads PR diff + description → specific test steps

Example:
  PR: "Fix text alignment when center button is clicked"
  
  Current output: Generic editor test
  LLM output: 
    1. Open editor with text element
    2. Select text layer
    3. Click center alignment button  
    4. Verify text-align CSS is "center"
    5. Verify alignment persists after save/reload
```

**Implementation:**
```typescript
// Add to generator/test-generator.ts
async function generateSmartSteps(analysis: AnalyzedPR): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [{
      role: "user",
      content: `Given this PR diff and description, generate Playwright test steps:
        
        PR Title: ${analysis.prInfo.title}
        Description: ${analysis.testContext.bugDescription}
        Changed Files: ${analysis.prInfo.files.map(f => f.filename).join(", ")}
        
        Generate specific test steps that verify this fix works.`
    }]
  });
  return response.content[0].text;
}
```

#### 2B. **Batch Processing Dashboard** 📊 USEFUL
Simple web UI to process multiple PRs and track status.

```
┌────────────────────────────────────────────────────────┐
│  PR-Test-Agent Dashboard                               │
├────────────────────────────────────────────────────────┤
│  [Input PR URLs - one per line]                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ https://github.com/org/repo/pull/123           │   │
│  │ https://github.com/org/repo/pull/124           │   │
│  │ https://github.com/org/repo/pull/125           │   │
│  └────────────────────────────────────────────────┘   │
│  [▶ Process All]                                       │
│                                                        │
│  Status:                                               │
│  ✅ PR #123 → Test PR created                          │
│  🔄 PR #124 → Generating...                            │
│  ⏳ PR #125 → Queued                                   │
└────────────────────────────────────────────────────────┘
```

#### 2C. **Historical PR Backfill** 📈 GREAT FOR DEMO
Scan last N merged bug-fix PRs and generate tests for all.

```typescript
async function backfillTests(org: string, repo: string, count: number) {
  const prs = await octokit.pulls.list({
    owner: org,
    repo: repo,
    state: "closed",
    per_page: count,
  });
  
  const bugFixes = prs.data.filter(pr => 
    pr.merged_at && 
    (pr.labels.some(l => l.name === "bug") || pr.title.toLowerCase().includes("fix"))
  );
  
  for (const pr of bugFixes) {
    console.log(`Processing ${pr.number}: ${pr.title}`);
    await runAgent({ sourcePRUrl: pr.html_url, dryRun: false });
  }
}
```

---

### TIER 3: Ambitious (2+ hours)

#### 3A. **Full CI Integration** 🔄
- Generate test on PR open
- Run test in CI
- Report results back to PR
- Block merge if test fails

#### 3B. **Visual Regression Integration**
- Upload screenshots to Percy/Chromatic
- Compare against baseline
- Auto-approve if within threshold

#### 3C. **Test Coverage Mapping**
- Track which PRs have generated tests
- Show coverage gaps
- Suggest tests for untested areas

---

## 🎯 Recommended Path for 3.5 Hours

### If you want MAX DEMO IMPACT:

```
Hour 1:    MCP Browser Verification (1C)
           - Run generated tests live in Cursor
           - Great visual demo
           
Hour 2:    LLM-Powered Enhancement (2A)  
           - Makes tests actually smart
           - "AI generates AI tests" narrative
           
Hour 3:    Webhook Integration (1A)
           - Fully automated pipeline
           - "Set it and forget it"
           
Hour 3.5:  Polish + Demo prep
```

### If you want PRACTICAL VALUE:

```
Hour 1:    Historical Backfill (2C)
           - Generate tests for last 20 bug fixes
           - Instant test coverage boost
           
Hour 2:    Slack Notifications (1B)
           - Keep team informed
           - Easy win
           
Hour 3:    Webhook Integration (1A)
           - Automate going forward
           
Hour 3.5:  Documentation + handoff prep
```

---

## ⚙️ Access Configuration Guide

### When You Get the Token:

1. **Create token with right scopes:**
   - Go to GitHub → Settings → Developer Settings → Personal Access Tokens
   - Or ask admin for a GitHub App installation token
   - Required scopes: `repo`, `write:discussion` (optional)

2. **Update `.env`:**
```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
TEST_REPO_OWNER=rocketium
TEST_REPO_NAME=qa-automation-tests

# Optional for LLM enhancement
ANTHROPIC_API_KEY=sk-ant-xxxx

# Optional for Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

3. **Verify access:**
```bash
# Test private repo access
npx ts-node -e "
  const { octokit } = require('./src/github/client');
  octokit.repos.get({ owner: 'rocketium', repo: 'react' })
    .then(r => console.log('✅ Access confirmed:', r.data.full_name))
    .catch(e => console.log('❌ No access:', e.message));
"
```

4. **Run on real internal PR:**
```bash
npx ts-node src/index.ts https://github.com/rocketium/react/pull/174 --dry-run
```

---

## 💡 Pro Tips

1. **Start with dry-run mode** until you're confident in output quality
2. **Test on a throwaway repo first** before pushing to real test repo
3. **The MCP browser is your secret weapon** - use it for live demos
4. **LLM enhancement is the biggest differentiator** - even basic prompting helps

---

## 🎪 Demo Script (5 min pitch)

```
1. "Bug reported → PR created → merged → test never written. Sound familiar?"

2. "What if tests wrote themselves?"

3. [Live demo] Paste a PR URL → watch test appear in 30 seconds

4. [MCP demo] Run the test live in browser right here in Cursor

5. "This runs automatically via webhook. Every bug fix = instant test coverage."

6. Show generated test PR with all the documentation

7. "Questions?"
```

---

**Good luck with the hackday! 🚀**

*Generated: Feb 5, 2026*

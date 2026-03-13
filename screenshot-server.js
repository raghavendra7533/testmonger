/**
 * screenshot-server.js
 * Lightweight HTTP server that uses Playwright Chromium to take screenshots,
 * run generated Playwright tests, and serve result files.
 *
 * Endpoints:
 *   GET  /screenshot?url=<url>          → take a live screenshot, return PNG
 *   GET  /snapshots                     → JSON list of saved snapshot files
 *   GET  /snapshots/<relative-path>     → serve a saved snapshot PNG
 *   POST /run-test                      → write & run a generated test, return results
 *   GET  /health                        → 200 OK
 *
 * Default port: 3002  (override with PORT env var)
 */

require('dotenv').config();

const http = require('http');
const { exec } = require('child_process');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3002;
const ROOT = __dirname;

// ── CORS helper ───────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Find snapshot / test-result images ───────────────────────────────────────
function findImages(dir, base, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findImages(full, base, results);
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
      results.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

// ── Take a screenshot with Playwright ────────────────────────────────────────
async function takeScreenshot(targetUrl, opts = {}) {
  // Lazy-require so the server starts fast even if @playwright/test isn't installed
  let chromium;
  try {
    ({ chromium } = require('@playwright/test'));
  } catch {
    ({ chromium } = require('playwright'));
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: opts.width || 1280, height: opts.height || 720 },
  });
  const page = await ctx.newPage();

  // Inject localStorage entries before the page loads (handles auth guards)
  // ls param: base64-encoded JSON array of {key, value} objects
  if (opts.ls) {
    try {
      const entries = JSON.parse(Buffer.from(opts.ls, 'base64').toString('utf8'));
      if (Array.isArray(entries) && entries.length > 0) {
        await page.addInitScript((items) => {
          for (const { key, value } of items) {
            localStorage.setItem(key, value);
          }
        }, entries);
      }
    } catch (e) {
      console.warn('[screenshot] Failed to parse ls param:', e.message);
    }
  }

  try {
    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
    await page.waitForTimeout(500); // let CSS animations settle
    const buf = await page.screenshot({
      fullPage: opts.fullPage === 'true' || opts.fullPage === true,
      type: 'png',
    });
    return buf;
  } finally {
    await browser.close();
  }
}

// ── Run a Playwright test file and collect results ────────────────────────────
function runPlaywrightTest(testFile, baseUrl) {
  return new Promise((resolve) => {
    const start = Date.now();
    const env = {
      ...process.env,
      TEST_BASE_URL: baseUrl || process.env.TEST_BASE_URL || 'http://localhost:3001',
      PLAYWRIGHT_TEST_BASE_URL: baseUrl || process.env.TEST_BASE_URL || 'http://localhost:3001',
      FORCE_COLOR: '0', // disable ANSI in output
    };

    // --reporter=json writes structured results to stdout
    // --update-snapshots creates baseline screenshots on first run
    const cmd = [
      'npx', 'playwright', 'test',
      JSON.stringify(testFile),
      '--project=e2e',
      '--reporter=json',
      '--update-snapshots',
    ].join(' ');

    console.log(`[run-test] Running: ${cmd}`);

    exec(cmd, { env, cwd: ROOT, timeout: 180000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const duration = Date.now() - start;

      // Parse JSON reporter output
      let jsonReport = null;
      try {
        jsonReport = JSON.parse(stdout);
      } catch {
        // JSON not parsable — look for JSON block inside mixed output
        const match = stdout.match(/(\{[\s\S]*"suites"[\s\S]*\})/);
        if (match) {
          try { jsonReport = JSON.parse(match[1]); } catch { /* ignore */ }
        }
      }

      // Summarise from JSON report or fall back to exit code
      let passed = 0, failed = 0, skipped = 0;
      const testResults = [];

      if (jsonReport) {
        const walk = (suites) => {
          for (const suite of suites || []) {
            for (const spec of suite.specs || []) {
              for (const test of spec.tests || []) {
                const status = test.results?.[0]?.status;
                const ok = status === 'passed';
                if (ok) passed++; else failed++;
                testResults.push({
                  title: spec.title,
                  status: ok ? 'passed' : 'failed',
                  duration: test.results?.[0]?.duration || 0,
                  error: ok ? null : (test.results?.[0]?.error?.message || 'Failed'),
                });
              }
            }
            walk(suite.suites);
          }
        };
        walk(jsonReport.suites);
      } else {
        // Fallback: parse --reporter=list output lines
        const lines = (stdout + stderr).split('\n');
        for (const line of lines) {
          if (line.includes(' passed')) passed += parseInt(line.match(/(\d+) passed/)?.[1] || '0');
          if (line.includes(' failed')) failed += parseInt(line.match(/(\d+) failed/)?.[1] || '0');
        }
      }

      // Collect all screenshots produced by this run
      const screenshots = [];
      findImages(path.join(ROOT, 'test-results'), ROOT, screenshots);
      findImages(path.join(ROOT, 'e2e'), ROOT, screenshots);

      console.log(`[run-test] Done in ${duration}ms — ${passed} passed, ${failed} failed`);

      resolve({
        success: failed === 0,
        passed,
        failed,
        skipped,
        duration,
        tests: testResults,
        screenshots,
        rawOutput: (stdout + '\n' + stderr).slice(0, 8000),
        exitCode: err?.code ?? 0,
      });
    });
  });
}

// ── Request handler ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // GET /health
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT }));
    return;
  }

  // POST /run-test  →  write & execute a generated Playwright test
  if (pathname === '/run-test' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { code, filename, baseUrl } = JSON.parse(body);
        if (!code || !filename) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '`code` and `filename` are required' }));
          return;
        }

        // Write the test file into e2e/tests/
        const safeBasename = path.basename(filename).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        const testPath = path.join(ROOT, 'e2e', 'tests', safeBasename);
        fs.mkdirSync(path.dirname(testPath), { recursive: true });
        fs.writeFileSync(testPath, code, 'utf8');
        console.log(`[run-test] Wrote ${testPath}`);

        const result = await runPlaywrightTest(testPath, baseUrl);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[run-test] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /run-test-mcp  →  execute a test via Claude + Playwright MCP agentic loop
  if (pathname === '/run-test-mcp' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { code, filename, baseUrl, mcpOptions } = JSON.parse(body);
        if (!code || !filename) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '`code` and `filename` are required' }));
          return;
        }

        console.log(`[run-test-mcp] Starting MCP execution for ${filename} (using Ollama)`);
        const mcpRunner = require('./mcp/server-mcp-runner.js');
        const result = await mcpRunner.runTestWithMCP(
          code,
          filename,
          baseUrl || process.env.TEST_BASE_URL || 'http://localhost:3001',
          null,
          mcpOptions || {}
        );

        console.log(`[run-test-mcp] Done — success=${result.success}, healed=${!!result.healedCode}`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[run-test-mcp] Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // GET /screenshot?url=<url>&fullPage=true&width=1280&height=720
  if (pathname === '/screenshot') {
    const targetUrl = parsed.query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '`url` query parameter is required' }));
      return;
    }

    console.log(`[screenshot] Capturing ${targetUrl} …`);
    try {
      const png = await takeScreenshot(targetUrl, parsed.query);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      });
      res.end(png);
      console.log(`[screenshot] Done (${png.length} bytes)`);
    } catch (err) {
      console.error(`[screenshot] Error:`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // GET /snapshots  →  JSON list of all saved PNG files
  if (pathname === '/snapshots') {
    const dirs = [
      path.join(ROOT, 'test-results'),
      path.join(ROOT, 'e2e'),
      path.join(ROOT, 'playwright-snapshots'),
    ];
    const images = [];
    for (const d of dirs) {
      findImages(d, ROOT, images);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ images }));
    return;
  }

  // GET /snapshots/<relative-path>  →  serve a saved image file
  if (pathname.startsWith('/snapshots/')) {
    const rel = decodeURIComponent(pathname.slice('/snapshots/'.length));
    const abs = path.resolve(ROOT, rel);

    // Safety: must stay within project root
    if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(abs).toLowerCase();
    const mime = ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    fs.createReadStream(abs).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n📸 Screenshot server running at http://localhost:${PORT}`);
  console.log(`   Live screenshot:  http://localhost:${PORT}/screenshot?url=http://localhost:3001`);
  console.log(`   List snapshots:   http://localhost:${PORT}/snapshots`);
  console.log(`   Health check:     http://localhost:${PORT}/health\n`);
});

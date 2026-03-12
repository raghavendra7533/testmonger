import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle2, XCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Image } from 'lucide-react';

const SCREENSHOT_SERVER = 'http://localhost:3002';

interface TestResult {
  title: string;
  status: 'passed' | 'failed';
  duration: number;
  error: string | null;
}

interface RunResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestResult[];
  screenshots: string[];
  rawOutput: string;
  exitCode: number;
}

interface Props {
  testCode: string;
  testFileName: string;
  baseUrl: string;
}

type RunState = 'idle' | 'running' | 'done' | 'error';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function TestRunPanel({ testCode, testFileName, baseUrl }: Props) {
  const [runState, setRunState] = useState<RunState>('idle');
  const [result, setResult] = useState<RunResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const [showScreenshots, setShowScreenshots] = useState(true);
  const [selectedShot, setSelectedShot] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start elapsed timer while running
  useEffect(() => {
    if (runState === 'running') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [runState]);

  const handleRun = async () => {
    setRunState('running');
    setResult(null);
    setServerError(null);
    setSelectedShot(null);

    try {
      const res = await fetch(`${SCREENSHOT_SERVER}/run-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: testCode,
          filename: testFileName,
          baseUrl: baseUrl || 'http://localhost:3001',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: RunResult = await res.json();
      setResult(data);
      setRunState('done');

      // Select the last screenshot automatically
      if (data.screenshots.length > 0) {
        setSelectedShot(data.screenshots[data.screenshots.length - 1]);
      }
    } catch (err: any) {
      setServerError(err.message || 'Failed to reach screenshot server');
      setRunState('error');
    }
  };

  return (
    <div className="bg-surface-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-content-secondary" />
          <span className="text-[13px] font-semibold text-content-primary">Run Test</span>
          {runState === 'running' && (
            <span className="text-[11px] text-content-tertiary font-mono">{elapsed}s elapsed…</span>
          )}
          {runState === 'done' && result && (
            <span
              className={`text-[11px] font-medium ${
                result.success ? 'text-success' : 'text-danger'
              }`}
            >
              {result.success ? `All ${result.passed} passed` : `${result.failed} failed`}
              {' '}· {formatDuration(result.duration)}
            </span>
          )}
        </div>

        <button
          onClick={handleRun}
          disabled={runState === 'running'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
            runState === 'running'
              ? 'bg-surface-tertiary text-content-tertiary cursor-not-allowed'
              : 'bg-accent-primary text-white hover:bg-accent-primary/90'
          }`}
        >
          {runState === 'running' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              {runState === 'done' ? 'Re-run' : 'Run Test'}
            </>
          )}
        </button>
      </div>

      {/* Running indicator */}
      {runState === 'running' && (
        <div className="flex flex-col items-center gap-3 py-10 text-content-secondary">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p className="text-[12px]">Executing Playwright test… ({elapsed}s)</p>
          <p className="text-[11px] text-content-tertiary">This can take 30–120 seconds on first run</p>
        </div>
      )}

      {/* Server error */}
      {runState === 'error' && serverError && (
        <div className="flex items-start gap-2 px-4 py-4">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-medium text-danger">Could not reach test runner</p>
            <p className="text-[11px] text-content-secondary mt-0.5">{serverError}</p>
            <p className="text-[11px] text-content-tertiary mt-1">
              Make sure the screenshot server is running:{' '}
              <code className="font-mono bg-surface-tertiary px-1 rounded">npm run screenshot-server</code>
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {runState === 'done' && result && (
        <div className="divide-y divide-border-default">
          {/* Summary bar */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-surface-primary">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              <span className="text-[12px] text-content-primary">{result.passed} passed</span>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-danger" />
                <span className="text-[12px] text-content-primary">{result.failed} failed</span>
              </div>
            )}
          </div>

          {/* Per-test results */}
          {result.tests.length > 0 && (
            <div className="divide-y divide-border-default">
              {result.tests.map((test, i) => (
                <div key={i} className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    {test.status === 'passed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] text-content-primary">{test.title}</span>
                      <span className="ml-2 text-[11px] text-content-tertiary">
                        {formatDuration(test.duration)}
                      </span>
                      {test.error && (
                        <p className="text-[11px] text-danger mt-1 font-mono whitespace-pre-wrap break-words">
                          {test.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Screenshots */}
          {result.screenshots.length > 0 && (
            <div>
              <button
                onClick={() => setShowScreenshots((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-content-secondary hover:text-content-primary uppercase tracking-wide"
              >
                <span className="flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" />
                  {result.screenshots.length} screenshot{result.screenshots.length !== 1 ? 's' : ''}
                </span>
                {showScreenshots ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              {showScreenshots && (
                <div className="px-4 pb-4">
                  {/* Selected screenshot preview */}
                  {selectedShot && (
                    <div className="mb-3 bg-black rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={`${SCREENSHOT_SERVER}/snapshots/${encodeURIComponent(selectedShot)}`}
                        alt={selectedShot.split('/').pop()}
                        className="max-w-full max-h-64 object-contain"
                      />
                    </div>
                  )}

                  {/* Thumbnail strip */}
                  <div className="flex gap-2 overflow-x-auto">
                    {result.screenshots.map((shot) => (
                      <button
                        key={shot}
                        onClick={() => setSelectedShot(shot)}
                        className={`shrink-0 flex flex-col items-center gap-1 p-1 rounded border transition-colors ${
                          selectedShot === shot
                            ? 'border-accent-primary bg-accent-primary/10'
                            : 'border-border-default hover:border-border-hover'
                        }`}
                      >
                        <img
                          src={`${SCREENSHOT_SERVER}/snapshots/${encodeURIComponent(shot)}`}
                          alt={shot.split('/').pop()}
                          className="w-20 h-14 object-cover rounded"
                        />
                        <span className="text-[10px] text-content-secondary max-w-[80px] truncate">
                          {shot.split('/').pop()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw output (collapsible) */}
          {result.rawOutput && (
            <div>
              <button
                onClick={() => setShowOutput((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-content-secondary hover:text-content-primary uppercase tracking-wide"
              >
                Raw output
                {showOutput ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              {showOutput && (
                <pre className="px-4 pb-4 text-[10px] font-mono text-content-secondary overflow-x-auto whitespace-pre-wrap break-words max-h-48">
                  {result.rawOutput}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

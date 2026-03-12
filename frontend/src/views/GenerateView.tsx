import { useCallback } from 'react';
import { FlaskConical, AlertCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import type { GenerationStep } from '../store';
import { fetchPRInfo } from '../utils/github';
import { analyzePR } from '../utils/analyzer';
import { generateTest } from '../utils/generator';
import { validateTestCode } from '../utils/validator';
import PRInputBar from '../components/generate/PRInputBar';
import ProgressTimeline from '../components/generate/ProgressTimeline';
import PRAnalysisCard from '../components/generate/PRAnalysisCard';
import CodePreview from '../components/generate/CodePreview';
import ValidationResults from '../components/generate/ValidationResults';
import CommitPanel from '../components/generate/CommitPanel';
import AppPreviewPanel from '../components/generate/AppPreviewPanel';
import TestRunPanel from '../components/generate/TestRunPanel';

const GENERATION_STEPS: Omit<GenerationStep, 'status'>[] = [
  { id: 'parse', label: 'Parse PR URL' },
  { id: 'fetch', label: 'Fetch PR data from GitHub' },
  { id: 'analyze', label: 'Analyze PR changes' },
  { id: 'generate', label: 'Generate Playwright test (AI)' },
  { id: 'validate', label: 'Validate generated test' },
];

export default function GenerateView() {
  const config = useStore((s) => s.config);
  const generation = useStore((s) => s.generation);
  const setGenerationStatus = useStore((s) => s.setGenerationStatus);
  const setGenerationSteps = useStore((s) => s.setGenerationSteps);
  const updateStep = useStore((s) => s.updateStep);
  const setAnalysis = useStore((s) => s.setAnalysis);
  const setTestCode = useStore((s) => s.setTestCode);
  const setValidationWarnings = useStore((s) => s.setValidationWarnings);
  const setGenerationError = useStore((s) => s.setGenerationError);
  const resetGeneration = useStore((s) => s.resetGeneration);
  const addHistoryEntry = useStore((s) => s.addHistoryEntry);

  const isRunning = generation.status === 'running';

  const handleGenerate = useCallback(
    async (owner: string, repo: string, prNumber: number) => {
      const startTime = Date.now();

      // Reset and initialize steps
      setGenerationError(null);
      setAnalysis(null);
      setTestCode('', '');
      setValidationWarnings([]);
      setGenerationStatus('running');
      setGenerationSteps(
        GENERATION_STEPS.map((s) => ({ ...s, status: 'pending' as const })),
      );

      try {
        // Step 1: Parse
        const step1Start = Date.now();
        updateStep('parse', { status: 'running' });
        // Parsing is already done by PRInputBar, just mark success
        updateStep('parse', {
          status: 'success',
          duration: Date.now() - step1Start,
          detail: `${owner}/${repo}#${prNumber}`,
        });

        // Step 2: Fetch
        const step2Start = Date.now();
        updateStep('fetch', { status: 'running' });
        const prData = await fetchPRInfo(
          config.githubToken,
          owner,
          repo,
          prNumber,
        );
        updateStep('fetch', {
          status: 'success',
          duration: Date.now() - step2Start,
          detail: `${prData.files.length} files changed`,
        });

        // Step 3: Analyze
        const step3Start = Date.now();
        updateStep('analyze', { status: 'running' });
        const analysis = analyzePR(prData, config);
        setAnalysis(analysis);
        updateStep('analyze', {
          status: 'success',
          duration: Date.now() - step3Start,
          detail: `${analysis.affectedFeatures.length} features, ${analysis.relatedSelectors.length} selectors`,
        });

        // Step 4: Generate
        const step4Start = Date.now();
        updateStep('generate', { status: 'running' });
        const { code, filename } = await generateTest(analysis, config, prData);
        setTestCode(code, filename);
        updateStep('generate', {
          status: 'success',
          duration: Date.now() - step4Start,
          detail: `${code.split('\n').length} lines`,
        });

        // Step 5: Validate
        const step5Start = Date.now();
        updateStep('validate', { status: 'running' });
        const warnings = validateTestCode(code);
        setValidationWarnings(warnings);
        updateStep('validate', {
          status: warnings.length > 0 ? 'warning' : 'success',
          duration: Date.now() - step5Start,
          detail:
            warnings.length > 0
              ? `${warnings.length} warning(s)`
              : 'All checks passed',
        });

        // Done
        setGenerationStatus(warnings.length > 0 ? 'success' : 'success');

        // Add to history
        addHistoryEntry({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          prUrl: generation.prUrl,
          ticketId: analysis.ticketId,
          prTitle: analysis.prTitle,
          status: warnings.length > 0 ? 'warning' : 'success',
          testCode: code,
          testFileName: filename,
          duration: Date.now() - startTime,
          warnings,
        });

        toast.success('Test generated successfully');
      } catch (err: any) {
        const failedStep = GENERATION_STEPS.find((s) => {
          const storeStep = useStore.getState().generation.steps.find((gs) => gs.id === s.id);
          return storeStep?.status === 'running';
        });
        if (failedStep) {
          updateStep(failedStep.id, {
            status: 'error',
            detail: err.message || 'Unknown error',
          });
        }

        setGenerationError(err.message || 'An unexpected error occurred');
        setGenerationStatus('error');

        addHistoryEntry({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          prUrl: generation.prUrl,
          ticketId: null,
          prTitle: 'Error',
          status: 'error',
          testCode: '',
          testFileName: '',
          duration: Date.now() - startTime,
          warnings: [err.message || 'Unknown error'],
        });

        toast.error(err.message || 'Generation failed');
      }
    },
    [
      config,
      generation.prUrl,
      setGenerationStatus,
      setGenerationSteps,
      updateStep,
      setAnalysis,
      setTestCode,
      setValidationWarnings,
      setGenerationError,
      addHistoryEntry,
    ],
  );

  const showEmpty =
    generation.status === 'idle' && generation.steps.length === 0;
  const showProgress = generation.steps.length > 0;
  const showAnalysis = generation.analysis !== null;
  const showCode = !!generation.testCode;
  const showValidation = generation.validationWarnings.length > 0 || (generation.status === 'success' && showCode);
  const showCommit = generation.status === 'success' && showCode;

  return (
    <div className="h-full flex">
      {/* Left: generate workflow */}
      <div className="flex flex-col min-w-0 flex-1 border-r border-border-default">
        {/* Header */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <h1 className="text-lg font-semibold text-content-primary mb-1">
            Generate E2E Test
          </h1>
          <p className="text-[13px] text-content-secondary">
            Paste a GitHub PR URL to generate a Playwright end-to-end test.
          </p>
        </div>

        {/* Input bar */}
        <div className="shrink-0 px-6 pb-4">
          <PRInputBar onGenerate={handleGenerate} isRunning={isRunning} />
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-5">
          {/* Error banner */}
          {generation.error && (
            <div className="flex items-start gap-3 bg-danger-muted/20 border border-danger/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-danger">
                  Generation failed
                </p>
                <p className="text-[12px] text-content-secondary mt-0.5">
                  {generation.error}
                </p>
              </div>
              <button
                onClick={resetGeneration}
                className="shrink-0 flex items-center gap-1 text-[12px] text-content-secondary hover:text-content-primary"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center mb-4">
                <FlaskConical className="w-6 h-6 text-content-tertiary" />
              </div>
              <h2 className="text-[15px] font-medium text-content-primary mb-1">
                Ready to generate
              </h2>
              <p className="text-[13px] text-content-secondary max-w-sm">
                Paste a GitHub Pull Request URL above to analyze changes and
                generate a Playwright E2E test automatically.
              </p>
            </div>
          )}

          {/* Progress timeline */}
          {showProgress && (
            <div className="bg-surface-secondary border border-border-default rounded-lg p-4">
              <h3 className="text-[13px] font-semibold text-content-primary mb-3">
                Progress
              </h3>
              <ProgressTimeline steps={generation.steps} />
            </div>
          )}

          {/* PR Analysis */}
          {showAnalysis && generation.analysis && (
            <PRAnalysisCard analysis={generation.analysis} />
          )}

          {/* Code Preview */}
          {showCode && (
            <CodePreview
              code={generation.testCode}
              filename={generation.testFileName}
            />
          )}

          {/* Run Test */}
          {showCode && (
            <TestRunPanel
              testCode={generation.testCode}
              testFileName={generation.testFileName}
              baseUrl={config.baseUrl}
            />
          )}

          {/* Validation */}
          {showValidation && (
            <ValidationResults warnings={generation.validationWarnings} />
          )}

          {/* Commit Panel */}
          {showCommit && generation.analysis && (
            <CommitPanel
              testCode={generation.testCode}
              testFileName={generation.testFileName}
              prTitle={generation.analysis.prTitle}
              ticketId={generation.analysis.ticketId}
              prNumber={generation.analysis.prNumber}
            />
          )}
        </div>
      </div>

      {/* Right: app preview */}
      <div className="w-[420px] shrink-0 flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-border-default">
          <p className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
            App Preview
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <AppPreviewPanel
            baseUrl={config.baseUrl}
            localStorageAuth={config.localStorageAuth.entries}
            featureMappings={config.featureMappings}
          />
        </div>
      </div>
    </div>
  );
}

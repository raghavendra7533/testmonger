import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AppConfig {
  githubToken: string;
  sourceRepo: { owner: string; name: string };
  targetRepo: { owner: string; name: string };
  baseUrl: string;
  framework: 'react' | 'vue' | 'nextjs' | 'angular' | 'other';
  authStrategy: 'form-login' | 'localstorage' | 'none';
  formLogin: {
    loginPath: string;
    emailSelector: string;
    passwordSelector: string;
    submitSelector: string;
    testEmail: string;
    testPassword: string;
    postLoginWait: 'networkidle' | 'url-match' | 'selector-visible';
  };
  localStorageAuth: { entries: Array<{ key: string; value: string }> };
  featureMappings: Array<{
    id: string;
    name: string;
    patterns: string[];
    entryUrl: string;
    entrySelector: string;
    navigationSteps: string[];
  }>;
  selectorConvention: 'data-cy' | 'data-testid' | 'aria-label' | 'custom';
  customSelectorAttribute: string;
  ticketPatterns: Array<{ id: string; pattern: string; label: string }>;
  outputDirectory: string;
  fileNamingTemplate: string;
  aiApiKey: string;
  playwright: {
    actionTimeout: number;
    navigationTimeout: number;
    testTimeout: number;
    viewportWidth: number;
    viewportHeight: number;
    screenshotDiffPixels: number;
    screenshotThreshold: number;
  };
}

export type GenerationStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  duration?: number;
  detail?: string;
};

export type GenerationState = {
  status: 'idle' | 'running' | 'success' | 'error';
  prUrl: string;
  steps: GenerationStep[];
  analysis: PRAnalysis | null;
  testCode: string;
  testFileName: string;
  validationWarnings: string[];
  error: string | null;
};

export type HistoryEntry = {
  id: string;
  timestamp: number;
  prUrl: string;
  ticketId: string | null;
  prTitle: string;
  status: 'success' | 'warning' | 'error';
  testCode: string;
  testFileName: string;
  duration: number;
  warnings: string[];
};

export type PRAnalysis = {
  prTitle: string;
  prNumber: number;
  owner: string;
  repo: string;
  ticketId: string | null;
  bugFixType: string | null;
  affectedFeatures: string[];
  filesChanged: number;
  additions: number;
  deletions: number;
  relatedSelectors: string[];
  changedComponents: string[];
  changedFunctions: string[];
};

export type ViewName = 'generate' | 'config' | 'history';

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FEATURE_MAPPINGS: AppConfig['featureMappings'] = [
  { id: '1', name: 'editor', patterns: ['editor', 'canvas', 'layer', 'viewport', 'zoom'], entryUrl: '/editor', entrySelector: '[data-cy="canvas-main-viewport"]', navigationSteps: [] },
  { id: '2', name: 'text-styling', patterns: ['text', 'font', 'typography', 'alignment'], entryUrl: '', entrySelector: '[data-cy="styling-panel-plugin"]', navigationSteps: [] },
  { id: '3', name: 'canvas-tools', patterns: ['grid', 'ruler', 'guide', 'snap'], entryUrl: '', entrySelector: '', navigationSteps: [] },
  { id: '4', name: 'video-settings', patterns: ['video', 'download', 'export', 'gif', 'mp4', 'mov'], entryUrl: '/campaign', entrySelector: '[data-cy="projectDownloadPageHeader-download-button"]', navigationSteps: [] },
  { id: '5', name: 'media-library', patterns: ['media', 'library', 'asset', 'upload', 'image'], entryUrl: '', entrySelector: '[data-cy="media-library"]', navigationSteps: [] },
  { id: '6', name: 'brand-management', patterns: ['brand', 'color', 'palette'], entryUrl: '', entrySelector: '[data-cy="brand-settings"]', navigationSteps: [] },
  { id: '7', name: 'authentication', patterns: ['auth', 'login', 'session', 'signup'], entryUrl: '/login', entrySelector: '', navigationSteps: [] },
  { id: '8', name: 'templates', patterns: ['template', 'alltemplates'], entryUrl: '/alltemplates', entrySelector: '[data-cy="template-card"]', navigationSteps: [] },
  { id: '9', name: 'projects', patterns: ['project', 'campaign', 'allprojects'], entryUrl: '/projects', entrySelector: '[data-cy="project-name"]', navigationSteps: [] },
  { id: '10', name: 'workspace', patterns: ['workspace', 'team', 'org'], entryUrl: '', entrySelector: '[data-cy="WorkspaceCard"]', navigationSteps: [] },
  { id: '11', name: 'settings', patterns: ['setting', 'config', 'preference'], entryUrl: '', entrySelector: '', navigationSteps: [] },
  { id: '12', name: 'billing', patterns: ['billing', 'payment', 'subscription'], entryUrl: '/billing', entrySelector: '', navigationSteps: [] },
  { id: '13', name: 'ai-studio', patterns: ['ai-studio', 'translate', 'generate', 'magic', 'auto'], entryUrl: '/ai-studio', entrySelector: '', navigationSteps: [] },
  { id: '14', name: 'design-system', patterns: ['component', 'design', 'style'], entryUrl: '', entrySelector: '', navigationSteps: [] },
];

const DEFAULT_TICKET_PATTERNS: AppConfig['ticketPatterns'] = [
  { id: '1', pattern: '\\[?(TKT[-_]?\\d+)\\]?', label: 'TKT' },
  { id: '2', pattern: '\\[?(JIRA[-_]?\\d+)\\]?', label: 'JIRA' },
  { id: '3', pattern: '\\[?(DEV[-_]?\\d+)\\]?', label: 'DEV' },
  { id: '4', pattern: '#(\\d+)', label: '#' },
];

const DEFAULT_CONFIG: AppConfig = {
  githubToken: '',
  sourceRepo: { owner: '', name: '' },
  targetRepo: { owner: '', name: '' },
  baseUrl: 'http://localhost:3000',
  framework: 'react',
  authStrategy: 'none',
  formLogin: {
    loginPath: '/login',
    emailSelector: 'input[name="email"]',
    passwordSelector: 'input[name="password"]',
    submitSelector: 'button[type="submit"]',
    testEmail: '',
    testPassword: '',
    postLoginWait: 'networkidle',
  },
  localStorageAuth: { entries: [] },
  featureMappings: DEFAULT_FEATURE_MAPPINGS,
  selectorConvention: 'data-cy',
  customSelectorAttribute: '',
  ticketPatterns: DEFAULT_TICKET_PATTERNS,
  outputDirectory: 'e2e/tests/',
  fileNamingTemplate: '{identifier}-{title}-{repo}.spec.ts',
  aiApiKey: '',
  playwright: {
    actionTimeout: 15000,
    navigationTimeout: 30000,
    testTimeout: 120000,
    viewportWidth: 1280,
    viewportHeight: 720,
    screenshotDiffPixels: 100,
    screenshotThreshold: 0.2,
  },
};

const INITIAL_GENERATION_STATE: GenerationState = {
  status: 'idle',
  prUrl: '',
  steps: [],
  analysis: null,
  testCode: '',
  testFileName: '',
  validationWarnings: [],
  error: null,
};

// ── Store ────────────────────────────────────────────────────────────────────

interface AppStore {
  // View
  currentView: ViewName;
  setView: (view: ViewName) => void;

  // Config
  config: AppConfig;
  updateConfig: (partial: Partial<AppConfig>) => void;
  updateNestedConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
  ) => void;
  resetConfig: () => void;

  // Generation
  generation: GenerationState;
  setPrUrl: (url: string) => void;
  setGenerationStatus: (status: GenerationState['status']) => void;
  setGenerationSteps: (steps: GenerationStep[]) => void;
  updateStep: (id: string, update: Partial<GenerationStep>) => void;
  setAnalysis: (analysis: PRAnalysis | null) => void;
  setTestCode: (code: string, fileName: string) => void;
  setValidationWarnings: (warnings: string[]) => void;
  setGenerationError: (error: string | null) => void;
  resetGeneration: () => void;

  // History
  history: HistoryEntry[];
  addHistoryEntry: (entry: HistoryEntry) => void;
  removeHistoryEntry: (id: string) => void;
  clearHistory: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      // View
      currentView: 'generate',
      setView: (view) => set({ currentView: view }),

      // Config
      config: DEFAULT_CONFIG,
      updateConfig: (partial) =>
        set((state) => ({
          config: { ...state.config, ...partial },
        })),
      updateNestedConfig: (key, value) =>
        set((state) => ({
          config: { ...state.config, [key]: value },
        })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),

      // Generation
      generation: INITIAL_GENERATION_STATE,
      setPrUrl: (url) =>
        set((state) => ({
          generation: { ...state.generation, prUrl: url },
        })),
      setGenerationStatus: (status) =>
        set((state) => ({
          generation: { ...state.generation, status },
        })),
      setGenerationSteps: (steps) =>
        set((state) => ({
          generation: { ...state.generation, steps },
        })),
      updateStep: (id, update) =>
        set((state) => ({
          generation: {
            ...state.generation,
            steps: state.generation.steps.map((s) =>
              s.id === id ? { ...s, ...update } : s,
            ),
          },
        })),
      setAnalysis: (analysis) =>
        set((state) => ({
          generation: { ...state.generation, analysis },
        })),
      setTestCode: (code, fileName) =>
        set((state) => ({
          generation: {
            ...state.generation,
            testCode: code,
            testFileName: fileName,
          },
        })),
      setValidationWarnings: (warnings) =>
        set((state) => ({
          generation: { ...state.generation, validationWarnings: warnings },
        })),
      setGenerationError: (error) =>
        set((state) => ({
          generation: { ...state.generation, error },
        })),
      resetGeneration: () => set({ generation: INITIAL_GENERATION_STATE }),

      // History
      history: [],
      addHistoryEntry: (entry) =>
        set((state) => ({
          history: [entry, ...state.history].slice(0, 100),
        })),
      removeHistoryEntry: (id) =>
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'pr-test-agent-storage',
      partialize: (state) => ({
        config: state.config,
        history: state.history,
      }),
    },
  ),
);

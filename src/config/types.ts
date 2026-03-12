/**
 * AgentConfig — platform-agnostic configuration for PR-Test-Agent.
 *
 * This type mirrors the AppConfig from the frontend store so that a config
 * exported from the UI can be used directly as a --config file for the CLI.
 */
export interface AgentConfig {
  /** GitHub personal access token (falls back to GITHUB_TOKEN env var) */
  githubToken: string;

  /** Repository where generated tests will be committed */
  targetRepo: { owner: string; name: string };

  /** Base URL of the application under test */
  baseUrl: string;

  /** Frontend framework hint (affects test generation style) */
  framework: 'react' | 'vue' | 'nextjs' | 'angular' | 'other';

  /** Authentication strategy used in generated test setup */
  authStrategy: 'form-login' | 'localstorage' | 'none';

  /** Config for form-based login (used when authStrategy === 'form-login') */
  formLogin: {
    loginPath: string;
    emailSelector: string;
    passwordSelector: string;
    submitSelector: string;
    /** Emitted as process.env.TEST_EMAIL fallback in generated code */
    testEmail: string;
    /** Emitted as process.env.TEST_PASSWORD fallback in generated code */
    testPassword: string;
    postLoginWait: 'networkidle' | 'url-match' | 'selector-visible';
  };

  /** localStorage key-value pairs to inject (used when authStrategy === 'localstorage') */
  localStorageAuth: { entries: Array<{ key: string; value: string }> };

  /**
   * Feature area definitions.
   * patterns: regex strings matched against changed file paths to detect the feature.
   * entryUrl: relative URL to navigate to for that feature.
   * entrySelector: selector to assert is visible after navigation.
   * navigationSteps: freeform Playwright code lines emitted verbatim in the test.
   */
  featureMappings: Array<{
    id: string;
    name: string;
    patterns: string[];
    entryUrl: string;
    entrySelector: string;
    navigationSteps: string[];
  }>;

  /** Which selector attribute to use in generated assertions */
  selectorConvention: 'data-cy' | 'data-testid' | 'aria-label' | 'custom';

  /** When selectorConvention === 'custom', the attribute name to use */
  customSelectorAttribute: string;

  /** Regex patterns for extracting ticket IDs from PR titles/bodies */
  ticketPatterns: Array<{ id: string; pattern: string; label: string }>;

  /** Relative directory in the target repo where test files are written */
  outputDirectory: string;

  /**
   * Template for generated test filenames.
   * Tokens: {identifier}, {ticketId}, {cleanTitle}, {repoName}, {prNumber}
   */
  fileNamingTemplate: string;

  /** Playwright settings written into generated test files */
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

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  githubToken: '',
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
  featureMappings: [],
  selectorConvention: 'data-testid',
  customSelectorAttribute: '',
  ticketPatterns: [
    { id: '1', pattern: '\\[?(JIRA-\\d+)\\]?', label: 'JIRA' },
    { id: '2', pattern: '\\[?(TKT[-_]?\\d+)\\]?', label: 'TKT' },
    { id: '3', pattern: '\\[?(DEV[-_]?\\d+)\\]?', label: 'DEV' },
    { id: '4', pattern: '#(\\d+)', label: '#' },
  ],
  outputDirectory: 'e2e/tests/',
  fileNamingTemplate: '{identifier}-{cleanTitle}-{repoName}.spec.ts',
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

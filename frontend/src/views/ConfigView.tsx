import { useState } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import ConnectionSection from '../components/config/ConnectionSection';
import AppSection from '../components/config/AppSection';
import AuthSection from '../components/config/AuthSection';
import FeatureMappingsSection from '../components/config/FeatureMappingsSection';
import SelectorsSection from '../components/config/SelectorsSection';
import TicketPatternsSection from '../components/config/TicketPatternsSection';
import OutputSection from '../components/config/OutputSection';
import PlaywrightSection from '../components/config/PlaywrightSection';

type Tab = {
  id: string;
  label: string;
  description: string;
};

const TABS: Tab[] = [
  { id: 'connection', label: 'Connection', description: 'GitHub token and repositories' },
  { id: 'app', label: 'App', description: 'Base URL and framework' },
  { id: 'auth', label: 'Auth', description: 'Authentication strategy' },
  { id: 'features', label: 'Feature Mappings', description: 'Map file paths to feature areas' },
  { id: 'selectors', label: 'Selectors', description: 'Test selector convention' },
  { id: 'tickets', label: 'Ticket Patterns', description: 'Issue tracker ID patterns' },
  { id: 'output', label: 'Output', description: 'Test file naming and directory' },
  { id: 'playwright', label: 'Playwright', description: 'Timeouts and viewport settings' },
  { id: 'ai', label: 'AI Model', description: 'Gemini API key for smart test generation' },
];

function AISection() {
  const { config, updateConfig } = useStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${config.aiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Say: API key works' }] }] }),
        },
      );
      if (res.ok) {
        setTestResult('ok');
      } else {
        const data = await res.json().catch(() => ({}));
        setTestError(data?.error?.message || `HTTP ${res.status}`);
        setTestResult('error');
      }
    } catch (e: any) {
      setTestError(e.message || 'Network error');
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-[15px] font-semibold text-content-primary mb-1">AI Model</h2>
        <p className="text-[13px] text-content-secondary">
          Connect Gemini 2.0 Flash to generate smarter Playwright tests that understand PR context.
          Without an API key the rule-based generator is used as a fallback.
        </p>
      </div>

      <div className="bg-surface-secondary border border-border-default rounded-lg p-4 space-y-1">
        <p className="text-[12px] font-semibold text-content-primary">Get a free API key</p>
        <p className="text-[12px] text-content-secondary">
          1. Go to{' '}
          <span className="font-mono text-accent-primary">aistudio.google.com</span>
          {' '}→ "Get API Key"
        </p>
        <p className="text-[12px] text-content-secondary">
          2. Free tier: 1,500 requests/day · no credit card required
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-medium text-content-primary">Gemini API Key</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={config.aiApiKey}
            onChange={(e) => updateConfig({ aiApiKey: e.target.value })}
            placeholder="AIza..."
            className="flex-1 px-3 py-2 text-[13px] bg-surface-primary border border-border-default rounded focus:outline-none focus:border-accent-primary font-mono"
          />
          <button
            onClick={handleTest}
            disabled={!config.aiApiKey || testing}
            className="px-3 py-2 text-[12px] font-medium rounded border border-border-default text-content-secondary hover:text-content-primary disabled:opacity-40 transition-colors"
          >
            {testing ? 'Testing…' : 'Test'}
          </button>
        </div>
        {testResult === 'ok' && (
          <p className="text-[12px] text-success">API key works — AI generation enabled</p>
        )}
        {testResult === 'error' && (
          <p className="text-[12px] text-danger">{testError || 'Request failed'}</p>
        )}
        <p className="text-[11px] text-content-tertiary">
          Stored in browser localStorage only. Never sent anywhere except Google's API.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[12px] font-semibold text-content-primary">Model</p>
        <p className="text-[13px] text-content-secondary font-mono">gemini-3-flash-preview</p>
        <p className="text-[11px] text-content-tertiary">
          Google's fastest free model. Falls back to rule-based generation if AI fails.
        </p>
      </div>
    </div>
  );
}

export default function ConfigView() {
  const [activeTab, setActiveTab] = useState('connection');
  const { config, resetConfig } = useStore();

  function handleExport() {
    const exportData = { ...config, githubToken: '[REDACTED]' };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pr-test-agent-config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Config exported (token redacted)');
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          useStore.getState().updateConfig(parsed);
          toast.success('Config imported successfully');
        } catch {
          toast.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleReset() {
    if (confirm('Reset all configuration to defaults? This cannot be undone.')) {
      resetConfig();
      toast.success('Configuration reset to defaults');
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border-default flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-content-primary">Configuration</h1>
          <p className="text-[13px] text-content-secondary mt-0.5">
            All settings are saved automatically to your browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 text-[12px] text-content-secondary hover:text-content-primary px-3 py-1.5 rounded border border-border-default hover:border-border-default/80 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-[12px] text-content-secondary hover:text-content-primary px-3 py-1.5 rounded border border-border-default hover:border-border-default/80 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[12px] text-content-secondary hover:text-danger px-3 py-1.5 rounded border border-border-default hover:border-danger/40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Body: tabs + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left tabs */}
        <nav className="shrink-0 w-52 border-r border-border-default overflow-y-auto py-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2.5 transition-colors ${
                activeTab === tab.id
                  ? 'bg-surface-tertiary text-content-primary'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-tertiary/50'
              }`}
            >
              <div className="text-[13px] font-medium">{tab.label}</div>
              <div className="text-[11px] text-content-tertiary mt-0.5 leading-tight">
                {tab.description}
              </div>
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'connection' && <ConnectionSection />}
          {activeTab === 'app' && <AppSection />}
          {activeTab === 'auth' && <AuthSection />}
          {activeTab === 'features' && <FeatureMappingsSection />}
          {activeTab === 'selectors' && <SelectorsSection />}
          {activeTab === 'tickets' && <TicketPatternsSection />}
          {activeTab === 'output' && <OutputSection />}
          {activeTab === 'playwright' && <PlaywrightSection />}
          {activeTab === 'ai' && <AISection />}
        </div>
      </div>
    </div>
  );
}

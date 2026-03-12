import { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { testConnection } from '../../utils/github';

export default function ConnectionSection() {
  const { config, updateConfig } = useStore();
  const [showToken, setShowToken] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [connMessage, setConnMessage] = useState('');

  async function handleTestConnection() {
    if (!config.githubToken) {
      setConnStatus('error');
      setConnMessage('Please enter a GitHub token first.');
      return;
    }
    setConnStatus('loading');
    try {
      const { login } = await testConnection(config.githubToken);
      setConnStatus('ok');
      setConnMessage(`Connected as @${login}`);
    } catch (err: any) {
      setConnStatus('error');
      setConnMessage(err.message || 'Connection failed. Check your token.');
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-[14px] font-semibold text-content-primary mb-1">Connection Settings</h2>
        <p className="text-[13px] text-content-secondary">
          Your GitHub Personal Access Token is required to read PR diffs and commit generated tests.
          It's stored locally in your browser and never sent to any server.
        </p>
      </div>

      {/* Token input */}
      <div className="space-y-4">
        <label className="block">
          <span className="text-[12px] font-medium text-content-secondary uppercase tracking-wide">
            GitHub Personal Access Token
          </span>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={config.githubToken}
                onChange={(e) => {
                  updateConfig({ githubToken: e.target.value });
                  setConnStatus('idle');
                }}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={connStatus === 'loading'}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-surface-tertiary border border-border-default rounded text-[13px] text-content-primary hover:bg-surface-elevated disabled:opacity-50 transition-colors"
            >
              {connStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Test Connection
            </button>
          </div>
          {connStatus === 'ok' && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-success">
              <CheckCircle2 className="w-3.5 h-3.5" /> {connMessage}
            </p>
          )}
          {connStatus === 'error' && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-danger">
              <XCircle className="w-3.5 h-3.5" /> {connMessage}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-content-tertiary">
            Required scopes: <span className="mono">repo</span>. Generate at GitHub → Settings → Developer Settings → Personal access tokens.
          </p>
        </label>
      </div>

      <hr className="border-border-subtle" />

      {/* Source repo */}
      <div>
        <h3 className="text-[13px] font-semibold text-content-primary mb-3">Source Repository</h3>
        <p className="text-[12px] text-content-secondary mb-3">
          The repository containing the bug-fix PRs you want to generate tests for.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12px] font-medium text-content-secondary">Owner</span>
            <input
              type="text"
              value={config.sourceRepo.owner}
              onChange={(e) => updateConfig({ sourceRepo: { ...config.sourceRepo, owner: e.target.value } })}
              placeholder="org-name"
              className="mt-1 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-content-secondary">Repository Name</span>
            <input
              type="text"
              value={config.sourceRepo.name}
              onChange={(e) => updateConfig({ sourceRepo: { ...config.sourceRepo, name: e.target.value } })}
              placeholder="my-app"
              className="mt-1 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
            />
          </label>
        </div>
      </div>

      <hr className="border-border-subtle" />

      {/* Target repo */}
      <div>
        <h3 className="text-[13px] font-semibold text-content-primary mb-3">Target Test Repository</h3>
        <p className="text-[12px] text-content-secondary mb-3">
          The repository where generated tests will be committed and PR'd.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[12px] font-medium text-content-secondary">Owner</span>
            <input
              type="text"
              value={config.targetRepo.owner}
              onChange={(e) => updateConfig({ targetRepo: { ...config.targetRepo, owner: e.target.value } })}
              placeholder="org-name"
              className="mt-1 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-content-secondary">Repository Name</span>
            <input
              type="text"
              value={config.targetRepo.name}
              onChange={(e) => updateConfig({ targetRepo: { ...config.targetRepo, name: e.target.value } })}
              placeholder="e2e-tests"
              className="mt-1 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

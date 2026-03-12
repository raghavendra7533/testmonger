import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import type { AppConfig } from '../../store';

type AuthStrategy = AppConfig['authStrategy'];

const STRATEGIES: { value: AuthStrategy; label: string; description: string }[] = [
  { value: 'form-login', label: 'Form Login', description: 'Log in via email/password form UI' },
  { value: 'localstorage', label: 'localStorage Injection', description: 'Inject session tokens directly into browser storage' },
  { value: 'none', label: 'None', description: 'No authentication required' },
];

export default function AuthSection() {
  const { config, updateConfig } = useStore();

  const fieldClass = 'mt-1 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent';
  const labelClass = 'block text-[12px] font-medium text-content-secondary';

  function updateFormLogin(key: keyof AppConfig['formLogin'], value: string) {
    updateConfig({ formLogin: { ...config.formLogin, [key]: value } });
  }

  function addLsEntry() {
    updateConfig({
      localStorageAuth: {
        entries: [...config.localStorageAuth.entries, { key: '', value: '' }],
      },
    });
  }

  function removeLsEntry(idx: number) {
    updateConfig({
      localStorageAuth: {
        entries: config.localStorageAuth.entries.filter((_, i) => i !== idx),
      },
    });
  }

  function updateLsEntry(idx: number, field: 'key' | 'value', val: string) {
    const entries = config.localStorageAuth.entries.map((e, i) =>
      i === idx ? { ...e, [field]: val } : e,
    );
    updateConfig({ localStorageAuth: { entries } });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-[14px] font-semibold text-content-primary mb-1">Authentication Strategy</h2>
        <p className="text-[13px] text-content-secondary">
          How the generated test authenticates with the application under test.
        </p>
      </div>

      {/* Strategy radio */}
      <div className="space-y-2">
        {STRATEGIES.map((s) => (
          <label
            key={s.value}
            className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              config.authStrategy === s.value
                ? 'border-accent bg-accent-muted/30'
                : 'border-border-default hover:border-border-default/60'
            }`}
          >
            <input
              type="radio"
              name="authStrategy"
              value={s.value}
              checked={config.authStrategy === s.value}
              onChange={() => updateConfig({ authStrategy: s.value })}
              className="mt-0.5 accent-accent"
            />
            <div>
              <div className="text-[13px] font-medium text-content-primary">{s.label}</div>
              <div className="text-[12px] text-content-secondary">{s.description}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Form login fields */}
      {config.authStrategy === 'form-login' && (
        <div className="bg-surface-secondary border border-border-default rounded-lg p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-content-primary">Form Login Configuration</h3>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Login Page Path</span>
              <input type="text" value={config.formLogin.loginPath} onChange={(e) => updateFormLogin('loginPath', e.target.value)} placeholder="/login" className={fieldClass} />
            </label>
            <label>
              <span className={labelClass}>Post-Login Wait</span>
              <select value={config.formLogin.postLoginWait} onChange={(e) => updateFormLogin('postLoginWait', e.target.value)} className={fieldClass}>
                <option value="networkidle">Network Idle</option>
                <option value="url-match">URL Match</option>
                <option value="selector-visible">Selector Visible</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label>
              <span className={labelClass}>Email Field Selector</span>
              <input type="text" value={config.formLogin.emailSelector} onChange={(e) => updateFormLogin('emailSelector', e.target.value)} placeholder="#emailId" className={fieldClass} />
            </label>
            <label>
              <span className={labelClass}>Password Field Selector</span>
              <input type="text" value={config.formLogin.passwordSelector} onChange={(e) => updateFormLogin('passwordSelector', e.target.value)} placeholder="#password" className={fieldClass} />
            </label>
            <label>
              <span className={labelClass}>Submit Button Selector</span>
              <input type="text" value={config.formLogin.submitSelector} onChange={(e) => updateFormLogin('submitSelector', e.target.value)} placeholder=".login-btn" className={fieldClass} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={labelClass}>Test Email (env var name)</span>
              <input type="text" value={config.formLogin.testEmail} onChange={(e) => updateFormLogin('testEmail', e.target.value)} placeholder="TEST_EMAIL" className={fieldClass} />
              <p className="mt-1 text-[11px] text-content-tertiary">Emitted as <span className="mono">process.env.TEST_EMAIL</span></p>
            </label>
            <label>
              <span className={labelClass}>Test Password (env var name)</span>
              <input type="text" value={config.formLogin.testPassword} onChange={(e) => updateFormLogin('testPassword', e.target.value)} placeholder="TEST_PASSWORD" className={fieldClass} />
              <p className="mt-1 text-[11px] text-content-tertiary">Emitted as <span className="mono">process.env.TEST_PASSWORD</span></p>
            </label>
          </div>
        </div>
      )}

      {/* localStorage fields */}
      {config.authStrategy === 'localstorage' && (
        <div className="bg-surface-secondary border border-border-default rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-content-primary">localStorage Key-Value Pairs</h3>
            <button onClick={addLsEntry} className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover">
              <Plus className="w-3.5 h-3.5" /> Add entry
            </button>
          </div>
          <p className="text-[12px] text-content-secondary">
            These key-value pairs will be injected into the browser's localStorage in <span className="mono">beforeAll</span>.
            Use env var names (e.g. <span className="mono">SESSION_ID</span>) for values — they'll be emitted as <span className="mono">process.env.SESSION_ID</span>.
          </p>
          {config.localStorageAuth.entries.length === 0 && (
            <p className="text-[12px] text-content-tertiary italic">No entries yet. Click "Add entry" to add one.</p>
          )}
          {config.localStorageAuth.entries.map((entry, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={entry.key}
                onChange={(e) => updateLsEntry(idx, 'key', e.target.value)}
                placeholder="localStorage key"
                className="flex-1 bg-surface-elevated border border-border-default rounded px-3 py-1.5 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
              />
              <span className="text-content-tertiary text-[13px]">→</span>
              <input
                type="text"
                value={entry.value}
                onChange={(e) => updateLsEntry(idx, 'value', e.target.value)}
                placeholder="ENV_VAR_NAME"
                className="flex-1 bg-surface-elevated border border-border-default rounded px-3 py-1.5 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
              />
              <button onClick={() => removeLsEntry(idx)} className="text-content-tertiary hover:text-danger">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {config.authStrategy === 'none' && (
        <div className="bg-surface-secondary border border-border-subtle rounded-lg px-4 py-3">
          <p className="text-[13px] text-content-secondary">
            No authentication. The generated test will create a browser context and open the page directly.
          </p>
        </div>
      )}
    </div>
  );
}

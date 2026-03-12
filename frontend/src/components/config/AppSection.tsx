import { useStore } from '../../store';
import type { AppConfig } from '../../store';

const FRAMEWORKS: { value: AppConfig['framework']; label: string }[] = [
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'other', label: 'Other / Generic' },
];

export default function AppSection() {
  const { config, updateConfig } = useStore();

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-[14px] font-semibold text-content-primary mb-1">App Settings</h2>
        <p className="text-[13px] text-content-secondary">
          Configure the application under test. These values are used in generated test files.
        </p>
      </div>

      <label className="block">
        <span className="text-[12px] font-medium text-content-secondary uppercase tracking-wide">
          Application Base URL
        </span>
        <input
          type="url"
          value={config.baseUrl}
          onChange={(e) => updateConfig({ baseUrl: e.target.value })}
          placeholder="https://staging.myapp.com"
          className="mt-1.5 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
        />
        <p className="mt-1 text-[11px] text-content-tertiary">
          Used as the default <span className="mono">PLAYWRIGHT_TEST_BASE_URL</span> in generated tests.
          Can be overridden at runtime via environment variable.
        </p>
      </label>

      <label className="block">
        <span className="text-[12px] font-medium text-content-secondary uppercase tracking-wide">
          Frontend Framework
        </span>
        <select
          value={config.framework}
          onChange={(e) => updateConfig({ framework: e.target.value as AppConfig['framework'] })}
          className="mt-1.5 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary focus:outline-none focus:border-accent"
        >
          {FRAMEWORKS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-content-tertiary">
          Affects how the agent identifies standalone apps vs. Rocketium-style apps in the PR diff.
        </p>
      </label>
    </div>
  );
}

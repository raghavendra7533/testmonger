import { useStore } from '../../store';

const TOKENS = ['{ticketId}', '{cleanTitle}', '{repoName}', '{prNumber}'];

export default function OutputSection() {
  const { config, updateConfig } = useStore();

  // Build example filename from template
  function preview(template: string) {
    return template
      .replace('{ticketId}', 'TKT-4521')
      .replace('{cleanTitle}', 'fix-login-bug')
      .replace('{repoName}', 'my-app')
      .replace('{prNumber}', '142');
  }

  const fieldClass = 'mt-1.5 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent';

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-[14px] font-semibold text-content-primary mb-1">Test Output Settings</h2>
        <p className="text-[13px] text-content-secondary">
          Configure where and how generated test files are named.
        </p>
      </div>

      <label className="block">
        <span className="text-[12px] font-medium text-content-secondary uppercase tracking-wide">
          Output Directory
        </span>
        <input
          type="text"
          value={config.outputDirectory}
          onChange={(e) => updateConfig({ outputDirectory: e.target.value })}
          placeholder="mcpTests/"
          className={fieldClass}
        />
        <p className="mt-1 text-[11px] text-content-tertiary">
          Relative path in the target repository where test files will be created.
        </p>
      </label>

      <label className="block">
        <span className="text-[12px] font-medium text-content-secondary uppercase tracking-wide">
          File Naming Template
        </span>
        <input
          type="text"
          value={config.fileNamingTemplate}
          onChange={(e) => updateConfig({ fileNamingTemplate: e.target.value })}
          placeholder="{ticketId}-{cleanTitle}-{repoName}.spec.ts"
          className={fieldClass}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TOKENS.map((t) => (
            <button
              key={t}
              onClick={() => updateConfig({ fileNamingTemplate: config.fileNamingTemplate + t })}
              className="text-[11px] mono bg-surface-tertiary border border-border-default rounded px-2 py-0.5 text-content-secondary hover:text-content-primary hover:border-accent transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-3 bg-surface-secondary border border-border-subtle rounded px-3 py-2">
          <span className="text-[11px] text-content-tertiary">Preview: </span>
          <span className="text-[12px] mono text-content-primary">
            {config.outputDirectory}{preview(config.fileNamingTemplate)}
          </span>
        </div>
      </label>
    </div>
  );
}

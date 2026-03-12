import { useStore } from '../../store';
import type { AppConfig } from '../../store';

type Convention = AppConfig['selectorConvention'];

const OPTIONS: { value: Convention; label: string; description: string; example: string }[] = [
  { value: 'data-cy', label: 'data-cy', description: 'Cypress-style test IDs (recommended for Rocketium)', example: '[data-cy="submit-button"]' },
  { value: 'data-testid', label: 'data-testid', description: 'React Testing Library convention', example: '[data-testid="submit-button"]' },
  { value: 'aria-label', label: 'aria-label', description: 'Accessibility-first selectors', example: '[aria-label="Submit"]' },
  { value: 'custom', label: 'Custom attribute', description: 'Use your own data attribute', example: '[data-qa="submit-button"]' },
];

export default function SelectorsSection() {
  const { config, updateConfig } = useStore();

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-[14px] font-semibold text-content-primary mb-1">Selector Convention</h2>
        <p className="text-[13px] text-content-secondary">
          Choose how selectors are identified in the PR diff and how they appear in generated tests.
        </p>
      </div>

      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
              config.selectorConvention === opt.value
                ? 'border-accent bg-accent-muted/30'
                : 'border-border-default hover:border-border-default/60'
            }`}
          >
            <input
              type="radio"
              name="selectorConvention"
              value={opt.value}
              checked={config.selectorConvention === opt.value}
              onChange={() => updateConfig({ selectorConvention: opt.value })}
              className="mt-0.5 accent-accent"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-content-primary mono">{opt.label}</span>
                <span className="text-[12px] text-content-secondary">{opt.description}</span>
              </div>
              <div className="mt-1 text-[11px] mono text-content-tertiary">{opt.example}</div>
            </div>
          </label>
        ))}
      </div>

      {config.selectorConvention === 'custom' && (
        <label className="block">
          <span className="text-[12px] font-medium text-content-secondary">Custom Attribute Name</span>
          <input
            type="text"
            value={config.customSelectorAttribute}
            onChange={(e) => updateConfig({ customSelectorAttribute: e.target.value })}
            placeholder="data-qa"
            className="mt-1.5 w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent"
          />
          <p className="mt-1 text-[11px] text-content-tertiary">
            The agent will search for this attribute in the PR diff and use it in generated assertions.
          </p>
        </label>
      )}
    </div>
  );
}

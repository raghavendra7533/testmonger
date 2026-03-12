import { useStore } from '../../store';

function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-content-secondary">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-surface-secondary border border-border-default rounded px-3 py-2 text-[13px] text-content-primary mono focus:outline-none focus:border-accent"
        />
        {unit && <span className="shrink-0 text-[12px] text-content-tertiary">{unit}</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] text-content-tertiary">{hint}</p>}
    </label>
  );
}

export default function PlaywrightSection() {
  const { config, updateConfig } = useStore();
  const pw = config.playwright;

  function update(key: keyof typeof pw, value: number) {
    updateConfig({ playwright: { ...pw, [key]: value } });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-[14px] font-semibold text-content-primary mb-1">Playwright Settings</h2>
        <p className="text-[13px] text-content-secondary">
          These values are written into generated test files as configuration.
        </p>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-content-primary mb-3">Timeouts</h3>
        <div className="grid grid-cols-3 gap-4">
          <NumberField label="Action Timeout" value={pw.actionTimeout} onChange={(v) => update('actionTimeout', v)} unit="ms" min={1000} step={1000} hint="Per-action timeout" />
          <NumberField label="Navigation Timeout" value={pw.navigationTimeout} onChange={(v) => update('navigationTimeout', v)} unit="ms" min={5000} step={5000} hint="Page load timeout" />
          <NumberField label="Test Timeout" value={pw.testTimeout} onChange={(v) => update('testTimeout', v)} unit="ms" min={10000} step={10000} hint="Total test timeout" />
        </div>
      </div>

      <hr className="border-border-subtle" />

      <div>
        <h3 className="text-[13px] font-semibold text-content-primary mb-3">Viewport</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Width" value={pw.viewportWidth} onChange={(v) => update('viewportWidth', v)} unit="px" min={320} />
          <NumberField label="Height" value={pw.viewportHeight} onChange={(v) => update('viewportHeight', v)} unit="px" min={480} />
        </div>
      </div>

      <hr className="border-border-subtle" />

      <div>
        <h3 className="text-[13px] font-semibold text-content-primary mb-3">Screenshot Comparison</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Max Diff Pixels" value={pw.screenshotDiffPixels} onChange={(v) => update('screenshotDiffPixels', v)} unit="px" min={0} hint="Pixels allowed to differ" />
          <NumberField label="Threshold" value={pw.screenshotThreshold} onChange={(v) => update('screenshotThreshold', v)} min={0} max={1} step={0.01} hint="0.0–1.0 color difference tolerance" />
        </div>
      </div>
    </div>
  );
}

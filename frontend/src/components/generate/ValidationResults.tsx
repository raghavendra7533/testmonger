import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ValidationResultsProps {
  warnings: string[];
}

export default function ValidationResults({ warnings }: ValidationResultsProps) {
  const hasWarnings = warnings.length > 0;

  return (
    <div
      className={`border rounded-lg px-4 py-3 ${
        hasWarnings
          ? 'bg-warning-muted/20 border-warning/20'
          : 'bg-success-muted/20 border-success/20'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {hasWarnings ? (
          <AlertTriangle className="w-4 h-4 text-warning" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-success" />
        )}
        <span className="text-[13px] font-semibold text-content-primary">
          {hasWarnings
            ? `Validation: ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
            : 'Validation passed'}
        </span>
      </div>

      {hasWarnings ? (
        <ul className="space-y-1" role="list">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-content-secondary">
              <span className="text-warning mt-0.5">--</span>
              {w}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-[12px] text-content-secondary">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          All checks passed. The generated test looks good.
        </p>
      )}
    </div>
  );
}

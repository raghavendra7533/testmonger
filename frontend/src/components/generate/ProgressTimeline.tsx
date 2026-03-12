import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import type { GenerationStep } from '../../store';

interface ProgressTimelineProps {
  steps: GenerationStep[];
}

const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    color: 'text-content-tertiary',
    bg: '',
  },
  running: {
    icon: Loader2,
    color: 'text-accent',
    bg: 'bg-accent-muted/30',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-success',
    bg: '',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning-muted/30',
  },
  error: {
    icon: XCircle,
    color: 'text-danger',
    bg: 'bg-danger-muted/30',
  },
} as const;

export default function ProgressTimeline({ steps }: ProgressTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-1" role="list" aria-label="Generation progress">
      {steps.map((step, index) => {
        const cfg = STATUS_CONFIG[step.status];
        const Icon = cfg.icon;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex items-start gap-3" role="listitem">
            {/* Icon + connector line */}
            <div className="flex flex-col items-center">
              <div className={`p-0.5 rounded ${cfg.bg}`}>
                <Icon
                  className={`w-4 h-4 ${cfg.color} ${
                    step.status === 'running' ? 'animate-spin' : ''
                  }`}
                />
              </div>
              {!isLast && (
                <div className="w-px h-5 bg-border-default mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13px] font-medium ${
                    step.status === 'pending'
                      ? 'text-content-tertiary'
                      : 'text-content-primary'
                  }`}
                >
                  {step.label}
                </span>
                {step.duration !== undefined && (
                  <span className="text-[11px] text-content-tertiary font-mono">
                    {step.duration}ms
                  </span>
                )}
              </div>
              {step.detail && (
                <p className="text-[12px] text-content-secondary mt-0.5 truncate">
                  {step.detail}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

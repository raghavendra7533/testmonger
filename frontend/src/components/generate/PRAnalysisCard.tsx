import {
  FileCode2,
  Plus,
  Minus,
  Tag,
  Bug,
  Layers,
  Crosshair,
  Component,
  FunctionSquare,
} from 'lucide-react';
import type { PRAnalysis } from '../../store';

interface PRAnalysisCardProps {
  analysis: PRAnalysis;
}

export default function PRAnalysisCard({ analysis }: PRAnalysisCardProps) {
  return (
    <div className="bg-surface-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <h3 className="text-[13px] font-semibold text-content-primary">
          PR Analysis
        </h3>
        <p className="text-[12px] text-content-secondary mt-0.5">
          #{analysis.prNumber} {analysis.prTitle}
        </p>
      </div>

      {/* Grid of key-value pairs */}
      <div className="grid grid-cols-2 gap-px bg-border-subtle">
        <InfoCell
          icon={<Tag className="w-3.5 h-3.5" />}
          label="Ticket ID"
          value={analysis.ticketId || 'None detected'}
          muted={!analysis.ticketId}
        />
        <InfoCell
          icon={<Bug className="w-3.5 h-3.5" />}
          label="Bug Fix"
          value={analysis.bugFixType || 'Not a bug fix'}
          muted={!analysis.bugFixType}
        />
        <InfoCell
          icon={<FileCode2 className="w-3.5 h-3.5" />}
          label="Files Changed"
          value={String(analysis.filesChanged)}
        />
        <InfoCell
          icon={<span className="flex items-center gap-1"><Plus className="w-3 h-3 text-success" /><Minus className="w-3 h-3 text-danger" /></span>}
          label="Changes"
          value={`+${analysis.additions} / -${analysis.deletions}`}
        />
        <InfoCell
          icon={<Layers className="w-3.5 h-3.5" />}
          label="Affected Features"
          value={
            analysis.affectedFeatures.length > 0
              ? analysis.affectedFeatures.join(', ')
              : 'None matched'
          }
          muted={analysis.affectedFeatures.length === 0}
        />
        <InfoCell
          icon={<Crosshair className="w-3.5 h-3.5" />}
          label="Selectors Found"
          value={
            analysis.relatedSelectors.length > 0
              ? analysis.relatedSelectors.join(', ')
              : 'None found'
          }
          muted={analysis.relatedSelectors.length === 0}
        />
        <InfoCell
          icon={<Component className="w-3.5 h-3.5" />}
          label="Components"
          value={
            analysis.changedComponents.length > 0
              ? analysis.changedComponents.join(', ')
              : 'None detected'
          }
          muted={analysis.changedComponents.length === 0}
        />
        <InfoCell
          icon={<FunctionSquare className="w-3.5 h-3.5" />}
          label="Functions"
          value={
            analysis.changedFunctions.length > 0
              ? analysis.changedFunctions.join(', ')
              : 'None detected'
          }
          muted={analysis.changedFunctions.length === 0}
        />
      </div>
    </div>
  );
}

function InfoCell({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-surface-secondary px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-content-tertiary mb-0.5">
        {icon}
        <span className="text-[11px] uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <p
        className={`text-[13px] font-mono truncate ${
          muted ? 'text-content-tertiary' : 'text-content-primary'
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useStore } from '../../store';
import type { AppConfig } from '../../store';

type FeatureMapping = AppConfig['featureMappings'][number];

const DEFAULT_FEATURE_MAPPINGS: AppConfig['featureMappings'] = [
  { id: '1', name: 'editor', patterns: ['editor', 'canvas', 'layer', 'viewport', 'zoom'], entryUrl: '/editor', entrySelector: '[data-cy="canvas-main-viewport"]', navigationSteps: [] },
  { id: '2', name: 'text-styling', patterns: ['text', 'font', 'typography', 'alignment'], entryUrl: '', entrySelector: '[data-cy="styling-panel-plugin"]', navigationSteps: [] },
  { id: '3', name: 'canvas-tools', patterns: ['grid', 'ruler', 'guide', 'snap'], entryUrl: '', entrySelector: '', navigationSteps: [] },
  { id: '4', name: 'video-settings', patterns: ['video', 'download', 'export', 'gif', 'mp4', 'mov'], entryUrl: '/campaign', entrySelector: '[data-cy="projectDownloadPageHeader-download-button"]', navigationSteps: [] },
  { id: '5', name: 'media-library', patterns: ['media', 'library', 'asset', 'upload', 'image'], entryUrl: '', entrySelector: '[data-cy="media-library"]', navigationSteps: [] },
  { id: '6', name: 'brand-management', patterns: ['brand', 'color', 'palette'], entryUrl: '', entrySelector: '[data-cy="brand-settings"]', navigationSteps: [] },
  { id: '7', name: 'authentication', patterns: ['auth', 'login', 'session', 'signup'], entryUrl: '/login', entrySelector: '', navigationSteps: [] },
  { id: '8', name: 'templates', patterns: ['template', 'alltemplates'], entryUrl: '/alltemplates', entrySelector: '[data-cy="template-card"]', navigationSteps: [] },
  { id: '9', name: 'projects', patterns: ['project', 'campaign', 'allprojects'], entryUrl: '/projects', entrySelector: '[data-cy="project-name"]', navigationSteps: [] },
  { id: '10', name: 'workspace', patterns: ['workspace', 'team', 'org'], entryUrl: '', entrySelector: '[data-cy="WorkspaceCard"]', navigationSteps: [] },
  { id: '11', name: 'settings', patterns: ['setting', 'config', 'preference'], entryUrl: '/settings', entrySelector: '', navigationSteps: [] },
  { id: '12', name: 'billing', patterns: ['billing', 'payment', 'subscription'], entryUrl: '/billing', entrySelector: '', navigationSteps: [] },
  { id: '13', name: 'ai-studio', patterns: ['ai-studio', 'translate', 'generate', 'magic', 'auto'], entryUrl: '/ai-studio', entrySelector: '', navigationSteps: [] },
  { id: '14', name: 'design-system', patterns: ['component', 'design', 'style'], entryUrl: '', entrySelector: '', navigationSteps: [] },
];

function PatternChips({ patterns, onChange }: { patterns: string[]; onChange: (p: string[]) => void }) {
  const [input, setInput] = useState('');

  function addPattern() {
    const val = input.trim();
    if (val && !patterns.includes(val)) {
      onChange([...patterns, val]);
      setInput('');
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-surface-elevated border border-border-default rounded min-h-[36px]">
      {patterns.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 bg-surface-tertiary border border-border-default rounded px-2 py-0.5 text-[11px] mono text-content-secondary">
          {p}
          <button onClick={() => onChange(patterns.filter((x) => x !== p))} className="text-content-tertiary hover:text-danger ml-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addPattern(); } }}
        placeholder="add pattern..."
        className="flex-1 min-w-[80px] bg-transparent text-[12px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none"
      />
    </div>
  );
}

function EditForm({ mapping, onSave, onCancel }: {
  mapping: FeatureMapping;
  onSave: (m: FeatureMapping) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState<FeatureMapping>({ ...mapping, navigationSteps: [...mapping.navigationSteps] });
  const [stepInput, setStepInput] = useState('');

  const fieldClass = 'w-full bg-surface-elevated border border-border-default rounded px-3 py-1.5 text-[13px] text-content-primary placeholder:text-content-tertiary mono focus:outline-none focus:border-accent';

  return (
    <div className="border-t border-border-default bg-surface-tertiary p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-[11px] font-medium text-content-secondary">Feature Name</span>
          <input type="text" value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} placeholder="my-feature" className={`mt-1 ${fieldClass}`} />
        </label>
        <label>
          <span className="text-[11px] font-medium text-content-secondary">Entry URL</span>
          <input type="text" value={local.entryUrl} onChange={(e) => setLocal({ ...local, entryUrl: e.target.value })} placeholder="/feature-page" className={`mt-1 ${fieldClass}`} />
        </label>
      </div>
      <label>
        <span className="text-[11px] font-medium text-content-secondary">File Path Patterns (press Enter or comma to add)</span>
        <div className="mt-1">
          <PatternChips patterns={local.patterns} onChange={(p) => setLocal({ ...local, patterns: p })} />
        </div>
      </label>
      <label>
        <span className="text-[11px] font-medium text-content-secondary">Entry Selector</span>
        <input type="text" value={local.entrySelector} onChange={(e) => setLocal({ ...local, entrySelector: e.target.value })} placeholder='[data-cy="my-element"]' className={`mt-1 ${fieldClass}`} />
      </label>
      <div>
        <span className="text-[11px] font-medium text-content-secondary">Navigation Steps (optional)</span>
        <div className="mt-1 space-y-1.5">
          {local.navigationSteps.map((step, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[11px] text-content-tertiary w-4">{i + 1}.</span>
              <input
                type="text"
                value={step}
                onChange={(e) => {
                  const steps = [...local.navigationSteps];
                  steps[i] = e.target.value;
                  setLocal({ ...local, navigationSteps: steps });
                }}
                className="flex-1 bg-surface-elevated border border-border-default rounded px-2 py-1 text-[12px] text-content-primary mono focus:outline-none focus:border-accent"
              />
              <button onClick={() => setLocal({ ...local, navigationSteps: local.navigationSteps.filter((_, j) => j !== i) })} className="text-content-tertiary hover:text-danger">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && stepInput.trim()) {
                  setLocal({ ...local, navigationSteps: [...local.navigationSteps, stepInput.trim()] });
                  setStepInput('');
                }
              }}
              placeholder="Add step (press Enter)..."
              className="flex-1 bg-surface-elevated border border-border-default rounded px-2 py-1 text-[12px] text-content-primary mono focus:outline-none focus:border-accent placeholder:text-content-tertiary"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-[13px] text-content-secondary hover:text-content-primary border border-border-default rounded">Cancel</button>
        <button onClick={() => onSave(local)} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] bg-accent hover:bg-accent-hover text-white rounded">
          <Check className="w-3.5 h-3.5" /> Save
        </button>
      </div>
    </div>
  );
}

export default function FeatureMappingsSection() {
  const { config, updateConfig } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleSave(updated: FeatureMapping) {
    updateConfig({ featureMappings: config.featureMappings.map((m) => m.id === updated.id ? updated : m) });
    setEditingId(null);
  }

  function handleDelete(id: string) {
    if (confirm('Remove this feature mapping?')) {
      updateConfig({ featureMappings: config.featureMappings.filter((m) => m.id !== id) });
      if (editingId === id) setEditingId(null);
    }
  }

  function handleAdd() {
    const newMapping: FeatureMapping = {
      id: crypto.randomUUID(),
      name: 'new-feature',
      patterns: [],
      entryUrl: '',
      entrySelector: '',
      navigationSteps: [],
    };
    updateConfig({ featureMappings: [...config.featureMappings, newMapping] });
    setEditingId(newMapping.id);
  }

  function handleReset() {
    if (confirm('Reset feature mappings to the built-in defaults? This will overwrite your current mappings.')) {
      updateConfig({ featureMappings: DEFAULT_FEATURE_MAPPINGS });
      setEditingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-content-primary mb-1">Feature Mappings</h2>
          <p className="text-[13px] text-content-secondary">
            Map file path patterns to feature areas. When a PR changes files matching a pattern,
            the agent generates test steps for that feature.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleReset} className="flex items-center gap-1.5 text-[12px] text-content-secondary hover:text-content-primary px-3 py-1.5 border border-border-default rounded">
            <RotateCcw className="w-3.5 h-3.5" /> Reset defaults
          </button>
          <button onClick={handleAdd} className="flex items-center gap-1.5 text-[12px] text-white bg-accent hover:bg-accent-hover px-3 py-1.5 rounded">
            <Plus className="w-3.5 h-3.5" /> Add feature
          </button>
        </div>
      </div>

      <div className="border border-border-default rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[160px_1fr_140px_80px] gap-0 bg-surface-tertiary border-b border-border-default">
          {['Feature', 'Patterns', 'Entry Point', ''].map((h) => (
            <div key={h} className="px-3 py-2 text-[11px] font-semibold text-content-secondary uppercase tracking-wide">{h}</div>
          ))}
        </div>

        {config.featureMappings.map((mapping) => (
          <div key={mapping.id}>
            {/* Row */}
            <div className={`grid grid-cols-[160px_1fr_140px_80px] border-b border-border-subtle last:border-b-0 ${editingId === mapping.id ? 'bg-surface-tertiary/50' : 'hover:bg-surface-tertiary/20'} transition-colors`}>
              <div className="px-3 py-2.5 text-[13px] font-medium text-content-primary mono self-start">{mapping.name}</div>
              <div className="px-3 py-2.5 flex flex-wrap gap-1 self-start">
                {mapping.patterns.map((p) => (
                  <span key={p} className="inline-block bg-surface-elevated border border-border-default rounded px-1.5 py-0.5 text-[11px] mono text-content-secondary">{p}</span>
                ))}
              </div>
              <div className="px-3 py-2.5 self-start">
                {mapping.entryUrl && <div className="text-[12px] mono text-content-secondary">{mapping.entryUrl}</div>}
                {mapping.entrySelector && <div className="text-[11px] mono text-content-tertiary truncate">{mapping.entrySelector}</div>}
              </div>
              <div className="px-3 py-2.5 flex items-start gap-2 self-start">
                <button
                  onClick={() => setEditingId(editingId === mapping.id ? null : mapping.id)}
                  className="text-content-tertiary hover:text-accent transition-colors"
                  title="Edit"
                >
                  {editingId === mapping.id ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(mapping.id)}
                  className="text-content-tertiary hover:text-danger transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {editingId !== mapping.id && (
                  <button onClick={() => setEditingId(mapping.id)} className="text-content-tertiary hover:text-content-primary">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Inline edit form */}
            {editingId === mapping.id && (
              <EditForm mapping={mapping} onSave={handleSave} onCancel={() => setEditingId(null)} />
            )}
          </div>
        ))}

        {config.featureMappings.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-content-tertiary">
            No feature mappings. Click "Add feature" to create one.
          </div>
        )}
      </div>
    </div>
  );
}

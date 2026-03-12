import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import type { AppConfig } from '../../store';

type Pattern = AppConfig['ticketPatterns'][number];

export default function TicketPatternsSection() {
  const { config, updateConfig } = useStore();
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});

  function addPattern() {
    const newPat: Pattern = { id: crypto.randomUUID(), pattern: '', label: 'NEW' };
    updateConfig({ ticketPatterns: [...config.ticketPatterns, newPat] });
  }

  function removePattern(id: string) {
    updateConfig({ ticketPatterns: config.ticketPatterns.filter((p) => p.id !== id) });
  }

  function updatePattern(id: string, field: keyof Pattern, value: string) {
    updateConfig({
      ticketPatterns: config.ticketPatterns.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      ),
    });
  }

  function tryMatch(pattern: Pattern, testInput: string): string | null {
    try {
      const re = new RegExp(pattern.pattern, 'i');
      const m = testInput.match(re);
      return m ? m[1] ?? m[0] : null;
    } catch {
      return null;
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-content-primary mb-1">Ticket ID Patterns</h2>
          <p className="text-[13px] text-content-secondary">
            Regex patterns to extract ticket IDs from PR titles and bodies.
            The first capturing group <span className="mono text-content-primary">()</span> is used as the ticket ID.
          </p>
        </div>
        <button
          onClick={addPattern}
          className="shrink-0 flex items-center gap-1.5 text-[12px] text-white bg-accent hover:bg-accent-hover px-3 py-1.5 rounded"
        >
          <Plus className="w-3.5 h-3.5" /> Add pattern
        </button>
      </div>

      <div className="space-y-3">
        {config.ticketPatterns.map((pat) => {
          const matchResult = testInputs[pat.id] ? tryMatch(pat, testInputs[pat.id]) : null;
          const hasError = (() => { try { new RegExp(pat.pattern); return false; } catch { return true; } })();

          return (
            <div key={pat.id} className="bg-surface-secondary border border-border-default rounded-lg p-3 space-y-2.5">
              <div className="flex gap-3 items-start">
                <div className="w-20 shrink-0">
                  <span className="text-[11px] font-medium text-content-secondary">Label</span>
                  <input
                    type="text"
                    value={pat.label}
                    onChange={(e) => updatePattern(pat.id, 'label', e.target.value)}
                    placeholder="JIRA"
                    className="mt-1 w-full bg-surface-elevated border border-border-default rounded px-2 py-1.5 text-[13px] text-content-primary mono focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex-1">
                  <span className="text-[11px] font-medium text-content-secondary">Regex Pattern</span>
                  <input
                    type="text"
                    value={pat.pattern}
                    onChange={(e) => updatePattern(pat.id, 'pattern', e.target.value)}
                    placeholder="\[?(PROJ-\d+)\]?"
                    className={`mt-1 w-full bg-surface-elevated border rounded px-2 py-1.5 text-[13px] mono focus:outline-none ${hasError && pat.pattern ? 'border-danger text-danger' : 'border-border-default text-content-primary focus:border-accent'}`}
                  />
                  {hasError && pat.pattern && (
                    <p className="mt-0.5 text-[11px] text-danger">Invalid regex</p>
                  )}
                </div>
                <button
                  onClick={() => removePattern(pat.id)}
                  className="shrink-0 mt-5 text-content-tertiary hover:text-danger transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Live tester */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={testInputs[pat.id] ?? ''}
                  onChange={(e) => setTestInputs({ ...testInputs, [pat.id]: e.target.value })}
                  placeholder="Test input: [TKT-4521] Fix login"
                  className="flex-1 bg-surface-elevated border border-border-subtle rounded px-2 py-1 text-[12px] text-content-primary mono focus:outline-none focus:border-accent placeholder:text-content-tertiary"
                />
                {testInputs[pat.id] && (
                  <span className={`text-[12px] mono shrink-0 ${matchResult ? 'text-success' : 'text-content-tertiary'}`}>
                    {matchResult ? `→ ${matchResult}` : '→ no match'}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {config.ticketPatterns.length === 0 && (
          <p className="text-[13px] text-content-tertiary italic text-center py-4">
            No patterns. Click "Add pattern" to define ticket ID extraction rules.
          </p>
        )}
      </div>
    </div>
  );
}

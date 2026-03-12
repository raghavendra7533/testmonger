import { useState } from 'react';
import { Clock, Copy, RotateCcw, Eye, Trash2, X, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import type { HistoryEntry } from '../store';
import CodePreview from '../components/generate/CodePreview';

function StatusIcon({ status }: { status: HistoryEntry['status'] }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-warning" />;
  return <XCircle className="w-4 h-4 text-danger" />;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (h < 1) return `${m}m ago`;
  if (d < 1) return `${h}h ago`;
  return `${d}d ago`;
}

export default function HistoryView() {
  const { history, clearHistory, removeHistoryEntry, setView } = useStore();
  const setPrUrl = useStore((s) => s.setPrUrl);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | HistoryEntry['status']>('all');
  const [previewEntry, setPreviewEntry] = useState<HistoryEntry | null>(null);

  const filtered = history.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (search && !e.prUrl.toLowerCase().includes(search.toLowerCase()) && !e.prTitle.toLowerCase().includes(search.toLowerCase()) && !(e.ticketId?.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  function handleCopy(entry: HistoryEntry) {
    navigator.clipboard.writeText(entry.testCode);
    toast.success('Copied to clipboard');
  }

  function handleRerun(entry: HistoryEntry) {
    setPrUrl(entry.prUrl);
    setView('generate');
    toast('Paste the URL and click Generate', { icon: '↩' });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border-default flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-content-primary">History</h1>
          <p className="text-[13px] text-content-secondary mt-0.5">
            {history.length} generation{history.length !== 1 ? 's' : ''} recorded in this browser.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => { if (confirm('Clear all history?')) clearHistory(); }}
            className="flex items-center gap-1.5 text-[12px] text-content-secondary hover:text-danger px-3 py-1.5 border border-border-default hover:border-danger/40 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear all
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 border-b border-border-subtle flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="bg-surface-secondary border border-border-default rounded px-3 py-1.5 text-[13px] text-content-primary focus:outline-none focus:border-accent"
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by PR URL, title, or ticket..."
          className="flex-1 bg-surface-secondary border border-border-default rounded px-3 py-1.5 text-[13px] text-content-primary placeholder:text-content-tertiary focus:outline-none focus:border-accent"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-content-tertiary" />
            </div>
            <p className="text-[14px] font-medium text-content-primary">No history yet</p>
            <p className="text-[13px] text-content-secondary mt-1 max-w-xs">
              {history.length === 0
                ? 'Generated tests will appear here. Go to the Generate tab to create your first test.'
                : 'No entries match your filters.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-surface-tertiary border-b border-border-default">
              <tr>
                {['Status', 'PR', 'Ticket', 'Duration', 'Time', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-content-secondary uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-border-subtle hover:bg-surface-tertiary/30 transition-colors group">
                  <td className="px-4 py-3">
                    <StatusIcon status={entry.status} />
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <a
                      href={entry.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] text-accent hover:underline mono truncate block"
                    >
                      {entry.prUrl.replace('https://github.com/', '')}
                    </a>
                    <p className="text-[12px] text-content-secondary truncate mt-0.5">{entry.prTitle}</p>
                  </td>
                  <td className="px-4 py-3">
                    {entry.ticketId ? (
                      <span className="inline-block bg-accent-muted border border-accent/20 rounded px-2 py-0.5 text-[11px] mono text-accent">
                        {entry.ticketId}
                      </span>
                    ) : (
                      <span className="text-[12px] text-content-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] mono text-content-secondary">{formatDuration(entry.duration)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-content-tertiary">{formatRelative(entry.timestamp)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.testCode && (
                        <button
                          onClick={() => setPreviewEntry(entry)}
                          title="View test"
                          className="text-content-tertiary hover:text-content-primary transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {entry.testCode && (
                        <button
                          onClick={() => handleCopy(entry)}
                          title="Copy test code"
                          className="text-content-tertiary hover:text-content-primary transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRerun(entry)}
                        title="Re-run"
                        className="text-content-tertiary hover:text-content-primary transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeHistoryEntry(entry.id)}
                        title="Remove"
                        className="text-content-tertiary hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over preview panel */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setPreviewEntry(null)} />
          <div className="w-[700px] bg-surface-primary border-l border-border-default flex flex-col h-full overflow-hidden">
            <div className="shrink-0 px-5 py-4 border-b border-border-default flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-content-primary">{previewEntry.prTitle}</h2>
                <p className="text-[12px] mono text-content-secondary mt-0.5">{previewEntry.testFileName}</p>
              </div>
              <button onClick={() => setPreviewEntry(null)} className="text-content-tertiary hover:text-content-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <CodePreview code={previewEntry.testCode} filename={previewEntry.testFileName} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

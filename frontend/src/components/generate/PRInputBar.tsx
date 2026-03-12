import { useState, useCallback, useMemo } from 'react';
import { Link, Loader2, GitPullRequest } from 'lucide-react';
import { useStore } from '../../store';

interface ParsedPR {
  owner: string;
  repo: string;
  number: number;
}

function parsePRUrl(url: string): ParsedPR | null {
  const match = url.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

interface PRInputBarProps {
  onGenerate: (owner: string, repo: string, prNumber: number) => void;
  isRunning: boolean;
}

export default function PRInputBar({ onGenerate, isRunning }: PRInputBarProps) {
  const prUrl = useStore((s) => s.generation.prUrl);
  const setPrUrl = useStore((s) => s.setPrUrl);
  const githubToken = useStore((s) => s.config.githubToken);
  const [focused, setFocused] = useState(false);

  const parsed = useMemo(() => parsePRUrl(prUrl), [prUrl]);
  const canSubmit = parsed !== null && !!githubToken && !isRunning;

  const handleSubmit = useCallback(() => {
    if (!parsed || !canSubmit) return;
    onGenerate(parsed.owner, parsed.repo, parsed.number);
  }, [parsed, canSubmit, onGenerate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="space-y-2">
      <div
        className={`
          flex items-center gap-3 bg-surface-secondary border rounded-lg px-4 py-2.5
          transition-colors duration-150
          ${focused ? 'border-accent' : 'border-border-default'}
        `}
      >
        <Link className="w-4 h-4 text-content-tertiary shrink-0" />
        <input
          type="url"
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a GitHub PR URL (e.g. https://github.com/owner/repo/pull/123)"
          className="flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary outline-none"
          aria-label="GitHub Pull Request URL"
        />
        {prUrl && (
          <span
            className={`shrink-0 w-2 h-2 rounded-full ${
              parsed ? 'bg-success' : 'bg-danger'
            }`}
            title={parsed ? 'Valid PR URL' : 'Invalid PR URL'}
          />
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`
            shrink-0 flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium
            transition-colors duration-100
            ${
              canSubmit
                ? 'bg-accent text-white hover:bg-accent-hover'
                : 'bg-surface-tertiary text-content-tertiary cursor-not-allowed'
            }
          `}
          aria-label="Generate test"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>

      {/* Parsed preview */}
      {prUrl && parsed && (
        <div className="flex items-center gap-2 px-1 text-[12px] text-content-secondary">
          <GitPullRequest className="w-3.5 h-3.5 text-success" />
          <span className="font-mono">
            {parsed.owner}/{parsed.repo} #{parsed.number}
          </span>
        </div>
      )}

      {!githubToken && prUrl && (
        <p className="text-[12px] text-warning px-1">
          GitHub token not configured. Go to Config to set it up.
        </p>
      )}
    </div>
  );
}

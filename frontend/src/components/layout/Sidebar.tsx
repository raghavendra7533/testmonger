import { useCallback } from 'react';
import {
  FlaskConical,
  Settings,
  History,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { useStore, ViewName } from '../../store';

const NAV_ITEMS: Array<{ id: ViewName; label: string; icon: typeof FlaskConical }> = [
  { id: 'generate', label: 'Generate', icon: Zap },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'history', label: 'History', icon: History },
];

export default function Sidebar() {
  const currentView = useStore((s) => s.currentView);
  const setView = useStore((s) => s.setView);
  const githubToken = useStore((s) => s.config.githubToken);
  const needsSetup = !githubToken;

  const handleNav = useCallback(
    (view: ViewName) => {
      setView(view);
    },
    [setView],
  );

  return (
    <aside className="w-56 h-full flex flex-col bg-surface-secondary border-r border-border-default shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border-subtle">
        <FlaskConical className="w-5 h-5 text-accent" />
        <span className="text-sm font-semibold text-content-primary tracking-tight">
          PR-Test-Agent
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium
                transition-colors duration-100
                ${
                  isActive
                    ? 'bg-surface-tertiary text-content-primary'
                    : 'text-content-secondary hover:bg-surface-tertiary/50 hover:text-content-primary'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {item.id === 'config' && needsSetup && (
                <span
                  className="ml-auto flex items-center gap-1 text-[11px] text-warning bg-warning-muted px-1.5 py-0.5 rounded"
                  title="Setup required: GitHub token not configured"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Setup
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border-subtle">
        <p className="text-[11px] text-content-tertiary">
          E2E Test Generator
        </p>
      </div>
    </aside>
  );
}

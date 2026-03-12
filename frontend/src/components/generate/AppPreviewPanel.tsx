import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, ExternalLink, Monitor, Image,
  ChevronDown, ChevronUp, AlertCircle, Loader2,
} from 'lucide-react';

const SCREENSHOT_SERVER = 'http://localhost:3002';

interface FeatureMapping {
  id: string;
  name: string;
  entryUrl: string;
}

interface LSEntry {
  key: string;
  value: string;
}

interface Props {
  baseUrl: string;
  localStorageAuth?: LSEntry[];
  featureMappings?: FeatureMapping[];
}

type Tab = 'live' | 'saved';

interface SavedImage {
  path: string;
  name: string;
}

/** Encode localStorage entries as base64 JSON for the screenshot server */
function encodeLs(entries: LSEntry[]): string {
  return btoa(JSON.stringify(entries));
}

/** Build the full screenshot URL, injecting auth if provided */
function buildScreenshotUrl(
  pageUrl: string,
  lsEntries: LSEntry[],
  ts: number,
): string {
  let u = `${SCREENSHOT_SERVER}/screenshot?url=${encodeURIComponent(pageUrl)}&ts=${ts}`;
  if (lsEntries.length > 0) {
    u += `&ls=${encodeURIComponent(encodeLs(lsEntries))}`;
  }
  return u;
}

export default function AppPreviewPanel({ baseUrl, localStorageAuth = [], featureMappings = [] }: Props) {
  const [tab, setTab] = useState<Tab>('live');

  // ── Page navigation state ─────────────────────────────────────────────────
  // currentPath is relative to baseUrl, e.g. "" or "/pages/dashboard.html"
  const [currentPath, setCurrentPath] = useState('');

  // Build nav items: baseUrl root + one per featureMapping
  const navItems = [
    { label: 'Home', path: '' },
    ...featureMappings
      .filter((m) => m.entryUrl)
      .map((m) => ({ label: m.name, path: m.entryUrl })),
  ];

  // ── Live screenshot state ─────────────────────────────────────────────────
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveTs, setLiveTs] = useState(0);

  // ── Saved screenshots state ───────────────────────────────────────────────
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(true);

  const hasUrl = baseUrl && baseUrl !== 'http://localhost:3000';

  const fullPageUrl = hasUrl
    ? `${baseUrl.replace(/\/$/, '')}${currentPath || ''}`
    : '';

  // ── Fetch live screenshot ─────────────────────────────────────────────────
  const refreshLive = useCallback(() => {
    if (!hasUrl) return;
    setLiveLoading(true);
    setLiveError(null);

    const screenshotUrl = buildScreenshotUrl(fullPageUrl, localStorageAuth, Date.now());

    const img = new window.Image();
    img.onload = () => {
      setLiveUrl(screenshotUrl);
      setLiveLoading(false);
    };
    img.onerror = () => {
      setLiveError('Screenshot server not running. Start it with: npm run screenshot-server');
      setLiveLoading(false);
    };
    img.src = screenshotUrl;
  }, [fullPageUrl, localStorageAuth, hasUrl]);

  // ── Fetch saved screenshots list ──────────────────────────────────────────
  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch(`${SCREENSHOT_SERVER}/snapshots`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const images: SavedImage[] = (data.images || []).map((p: string) => ({
        path: p,
        name: p.split('/').pop() || p,
      }));
      setSavedImages(images);
      if (images.length > 0 && !selectedImage) {
        setSelectedImage(images[images.length - 1]);
      }
    } catch {
      setSavedError('Screenshot server not running. Start it with: npm run screenshot-server');
    } finally {
      setSavedLoading(false);
    }
  }, [selectedImage]);

  // Auto-fetch live screenshot when tab/path/auth changes
  useEffect(() => {
    if (tab === 'live' && hasUrl) refreshLive();
  }, [tab, hasUrl, liveTs, currentPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'saved') refreshSaved();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── No URL configured placeholder ────────────────────────────────────────
  if (!hasUrl) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
        <Monitor className="w-10 h-10 text-content-tertiary" />
        <p className="text-[13px] text-content-secondary">
          Set a <span className="font-medium text-content-primary">Base URL</span> in Config to capture screenshots here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center border-b border-border-default bg-surface-secondary">
        <button
          onClick={() => setTab('live')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
            tab === 'live'
              ? 'border-accent-primary text-accent-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          Live Screenshot
        </button>
        <button
          onClick={() => setTab('saved')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
            tab === 'saved'
              ? 'border-accent-primary text-accent-primary'
              : 'border-transparent text-content-secondary hover:text-content-primary'
          }`}
        >
          <Image className="w-3.5 h-3.5" />
          Test Snapshots
        </button>

        <div className="ml-auto flex items-center gap-1 pr-2">
          {tab === 'live' && (
            <>
              <button
                onClick={() => setLiveTs(Date.now())}
                disabled={liveLoading}
                title="Refresh screenshot"
                className="p-1.5 rounded hover:bg-surface-tertiary text-content-secondary hover:text-content-primary disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
              </button>
              <a
                href={fullPageUrl}
                target="_blank"
                rel="noreferrer"
                title="Open in browser"
                className="p-1.5 rounded hover:bg-surface-tertiary text-content-secondary hover:text-content-primary transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          )}
          {tab === 'saved' && (
            <button
              onClick={refreshSaved}
              disabled={savedLoading}
              title="Refresh list"
              className="p-1.5 rounded hover:bg-surface-tertiary text-content-secondary hover:text-content-primary disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${savedLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* ── Live Screenshot Tab ─────────────────────────────────────────── */}
      {tab === 'live' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Page navigation */}
          {navItems.length > 1 && (
            <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border-default bg-surface-secondary overflow-x-auto">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => setCurrentPath(item.path)}
                  className={`shrink-0 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    currentPath === item.path
                      ? 'bg-accent-primary text-white'
                      : 'text-content-secondary hover:bg-surface-tertiary hover:text-content-primary'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* URL bar */}
          <div className="shrink-0 px-3 py-1.5 border-b border-border-default bg-surface-secondary">
            <span className="text-[11px] text-content-tertiary font-mono truncate block">{fullPageUrl}</span>
          </div>

          <div className="flex-1 overflow-auto bg-black flex items-start justify-center p-4">
            {liveLoading && (
              <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-[12px]">Launching browser and capturing screenshot…</p>
                <p className="text-[11px] text-gray-500">This takes ~3–5 seconds</p>
              </div>
            )}

            {liveError && !liveLoading && (
              <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
                <AlertCircle className="w-8 h-8 text-danger" />
                <p className="text-[12px] text-danger font-medium">Screenshot server offline</p>
                <p className="text-[11px] text-gray-400">
                  Run in a terminal:<br />
                  <code className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-[11px] mt-1 inline-block">
                    npm run screenshot-server
                  </code>
                </p>
                <button
                  onClick={() => setLiveTs(Date.now())}
                  className="mt-2 text-[11px] text-accent-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {liveUrl && !liveLoading && !liveError && (
              <img
                src={liveUrl}
                alt={`Screenshot of ${fullPageUrl}`}
                className="max-w-full rounded shadow-md border border-gray-700"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Saved Snapshots Tab ─────────────────────────────────────────── */}
      {tab === 'saved' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {savedError && (
            <div className="shrink-0 flex items-start gap-2 bg-danger-muted/10 border-b border-danger/20 px-4 py-3">
              <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] text-danger font-medium">Screenshot server offline</p>
                <p className="text-[11px] text-content-secondary mt-0.5">
                  Run: <code className="font-mono">npm run screenshot-server</code>
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto bg-black flex items-start justify-center p-4">
            {savedLoading && !selectedImage && (
              <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-[12px]">Loading snapshots…</p>
              </div>
            )}

            {!savedLoading && !savedError && savedImages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center px-6 text-gray-400">
                <Image className="w-8 h-8" />
                <p className="text-[13px] font-medium text-gray-200">No snapshots yet</p>
                <p className="text-[11px]">
                  Run your generated Playwright tests to create snapshots.<br />
                  They'll appear here automatically.
                </p>
              </div>
            )}

            {selectedImage && (
              <img
                src={`${SCREENSHOT_SERVER}/snapshots/${encodeURIComponent(selectedImage.path)}`}
                alt={selectedImage.name}
                className="max-w-full rounded shadow-md border border-gray-700"
              />
            )}
          </div>

          {savedImages.length > 0 && (
            <div className="shrink-0 border-t border-border-default bg-surface-secondary">
              <button
                onClick={() => setGalleryOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-content-secondary hover:text-content-primary uppercase tracking-wide"
              >
                <span>{savedImages.length} snapshot{savedImages.length !== 1 ? 's' : ''}</span>
                {galleryOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              {galleryOpen && (
                <div className="flex gap-2 overflow-x-auto px-3 pb-3">
                  {savedImages.map((img) => (
                    <button
                      key={img.path}
                      onClick={() => setSelectedImage(img)}
                      className={`shrink-0 flex flex-col items-center gap-1 p-1 rounded border transition-colors ${
                        selectedImage?.path === img.path
                          ? 'border-accent-primary bg-accent-primary/10'
                          : 'border-border-default hover:border-border-hover'
                      }`}
                    >
                      <img
                        src={`${SCREENSHOT_SERVER}/snapshots/${encodeURIComponent(img.path)}`}
                        alt={img.name}
                        className="w-20 h-14 object-cover rounded"
                      />
                      <span className="text-[10px] text-content-secondary max-w-[80px] truncate">
                        {img.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

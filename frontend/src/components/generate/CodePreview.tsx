import { useRef, useEffect, useCallback, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import { Copy, Download, Check } from 'lucide-react';
import toast from 'react-hot-toast';

hljs.registerLanguage('typescript', typescript);

interface CodePreviewProps {
  code: string;
  filename: string;
}

export default function CodePreview({ code, filename }: CodePreviewProps) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (codeRef.current && code) {
      const highlighted = hljs.highlight(code, { language: 'typescript' }).value;
      codeRef.current.innerHTML = highlighted;
    }
  }, [code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [code]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop() || 'test.spec.ts';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  }, [code, filename]);

  const lineCount = code.split('\n').length;

  return (
    <div className="bg-surface-secondary border border-border-default rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-content-primary">
            Generated Test
          </span>
          <span className="text-[11px] font-mono text-content-tertiary truncate">
            {filename}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] text-content-secondary
              hover:bg-surface-tertiary hover:text-content-primary transition-colors"
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] text-content-secondary
              hover:bg-surface-tertiary hover:text-content-primary transition-colors"
            aria-label="Download test file"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="overflow-auto max-h-[500px]">
        <div className="flex min-w-0">
          {/* Line numbers */}
          <div
            className="shrink-0 select-none text-right pr-3 pl-4 py-3 text-[12px] leading-[1.6] font-mono text-content-tertiary border-r border-border-subtle"
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Highlighted code */}
          <pre className="flex-1 overflow-x-auto py-3 px-4">
            <code ref={codeRef} className="hljs font-mono text-[12px] leading-[1.6]" />
          </pre>
        </div>
      </div>
    </div>
  );
}

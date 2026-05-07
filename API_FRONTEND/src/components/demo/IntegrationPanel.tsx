// ============================================================
// IntegrationPanel — Code / Request / Response viewer
//
// This is the right-side panel that appears in every demo.
// Features:
//   - Sticky tab header
//   - Line numbers with gutter
//   - GitHub-Dark syntax highlighting
//   - Response meta bar (status, latency, size)
//   - One-click copy with visual feedback
//   - Dark custom scrollbar
// ============================================================

import { useState, useMemo } from 'react';
import { Copy, Check, FileCode2, Send, FileJson2 } from 'lucide-react';

interface IntegrationPanelProps {
  codeContent: string;
  requestContent: string;
  responseContent: string | null;
  responseStatus?: number;
  responseTimeMs?: number;
  responseSizeKb?: string;
  highlightedZone?: string | null;
}

// ── Syntax Highlighting ─────────────────────────────────────

function highlightCode(code: string): string {
  const strings: string[] = [];
  const comments: string[] = [];

  // 1. Escape HTML
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Extract strings and comments to protect them
  // Protect strings (double, single, template)
  html = html.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, (match) => {
    strings.push(match);
    return `__STR_${strings.length - 1}__`;
  });

  // Protect comments (// ...)
  html = html.replace(/(?<!:)(\/\/.*)/g, (match) => {
    comments.push(match);
    return `__COM_${comments.length - 1}__`;
  });

  // 3. Highlight keywords, built-ins, and numbers in the remaining code
  // Keywords
  html = html.replace(
    /\b(const|let|var|function|async|await|return|if|else|import|from|export|new|typeof|class|extends|interface|type|void|null|undefined|this|throw|try|catch|finally|for|of|in|switch|case|break|default)\b/g,
    '<span class="syn-keyword">$1</span>',
  );
  // Built-ins
  html = html.replace(
    /\b(console|Object|Array|Set|Map|Date|Promise|setInterval|clearInterval|setTimeout|useEffect|useState|useCallback|useRef)\b/g,
    '<span class="syn-builtin">$1</span>',
  );
  // Numbers
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-number">$1</span>');
  // Arrow / operators
  html = html.replace(/(=&gt;)/g, '<span class="syn-keyword">$1</span>');

  // 4. Restore strings and comments with their highlighting spans
  html = html.replace(/__STR_(\d+)__/g, (_, i) => `<span class="syn-string">${strings[parseInt(i)]}</span>`);
  html = html.replace(/__COM_(\d+)__/g, (_, i) => `<span class="syn-comment">${comments[parseInt(i)]}</span>`);

  return html;
}

function highlightJson(json: string): string {
  const strings: string[] = [];

  // 1. Escape HTML
  let html = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Extract keys and strings
  html = html.replace(/("([^"]+)"(\s*:)|:\s*"([^"]*)")/g, (match) => {
    strings.push(match);
    return `__STR_${strings.length - 1}__`;
  });

  // 3. Highlight numbers, booleans, null
  html = html.replace(/:\s*(\d+\.?\d*)/g, ': <span class="syn-number">$1</span>');
  html = html.replace(/:\s*(true|false|null)/g, ': <span class="syn-keyword">$1</span>');

  // 4. Restore protected parts
  html = html.replace(/__STR_(\d+)__/g, (_, i) => {
    const raw = strings[parseInt(i)];
    if (raw.includes(':')) {
      const parts = raw.split(':');
      if (parts[0].includes('"')) {
        return `<span class="syn-json-key">${parts[0]}</span>:${parts[1]}`;
      }
      return `:${parts[0]}<span class="syn-string">${parts[1]}</span>`;
    }
    return `<span class="syn-string">${raw}</span>`;
  });

  // Simple key fix for the token approach
  html = html.replace(/__STR_(\d+)__/g, (_, i) => {
     const val = strings[parseInt(i)];
     if (val.endsWith(':')) {
        return `<span class="syn-json-key">${val.slice(0, -1)}</span>:`;
     }
     return `<span class="syn-string">${val}</span>`;
  });

  return html;
}

function lineCount(text: string): number {
  return text.split('\n').length;
}

function lineNumbers(count: number): string {
  return Array.from({ length: count }, (_, i) => i + 1).join('\n');
}

// ─────────────────────────────────────────────────────────────

const IntegrationPanel = ({
  codeContent,
  requestContent,
  responseContent,
  responseStatus = 200,
  responseTimeMs,
  responseSizeKb,
  highlightedZone,
}: IntegrationPanelProps) => {
  const [activeTab, setActiveTab] = useState<'code' | 'request' | 'response'>('code');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'code' as const, label: 'Integration Code', icon: FileCode2 },
    { id: 'request' as const, label: 'Request', icon: Send },
    { id: 'response' as const, label: 'Response', icon: FileJson2 },
  ];

  const rawContent = activeTab === 'code'
    ? codeContent
    : activeTab === 'request'
    ? requestContent
    : responseContent || '';

  const highlighted = useMemo(() => {
    if (activeTab === 'response' && responseContent) return highlightJson(responseContent);
    if (activeTab === 'code') return highlightCode(codeContent);
    return highlightCode(requestContent);
  }, [activeTab, codeContent, requestContent, responseContent]);

  const lines = useMemo(() => lineCount(rawContent), [rawContent]);

  return (
    <div className="code-panel">
      {/* ── Sticky Tab Bar ────────────────────────────── */}
      <div className="code-panel-tabs">
        <div className="flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`code-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.id === 'response' && responseContent && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pr-3">
          {activeTab === 'code' && (
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">TypeScript</span>
          )}
          {activeTab === 'response' && (
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">JSON</span>
          )}
          <button
            onClick={() => copyToClipboard(rawContent)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* ── Response Meta Bar ─────────────────────────── */}
      {activeTab === 'response' && responseContent && (
        <div className="response-meta">
          <span className={`response-badge ${responseStatus === 200 ? 'ok' : 'err'}`}>
            {responseStatus} {responseStatus === 200 ? 'OK' : 'Error'}
          </span>
          {responseTimeMs !== undefined && (
            <span className="response-stat">{responseTimeMs}ms</span>
          )}
          {responseSizeKb && (
            <span className="response-stat">{responseSizeKb}</span>
          )}
        </div>
      )}

      {/* ── Body ──────────────────────────────────────── */}
      <div className="code-panel-body dark-scrollbar">
        {activeTab === 'response' && !responseContent ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-16">
            <FileJson2 size={32} strokeWidth={1} />
            <span className="text-xs">Click <span className="text-emerald-600 font-bold">Run Demo</span> to see the live API response</span>
            <span className="text-[10px] text-slate-400">Response will appear here with syntax highlighting</span>
          </div>
        ) : (
          <div className="code-with-lines">
            <div className="code-line-numbers" aria-hidden="true">
              <pre>{lineNumbers(lines)}</pre>
            </div>
            <pre>
              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationPanel;

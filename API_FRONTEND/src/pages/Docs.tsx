import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Lightbulb,
  Lock,
  Gauge,
  Copy,
  Check,
  ChevronRight,
  Terminal,
  FileJson2,
  Code2
} from 'lucide-react';
import { endpoints } from '../lib/constants';

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

  // Protect comments (// ... and # ...)
  html = html.replace(/((?<!:)\/\/.*|(?<!\S)#.*)/g, (match) => {
    comments.push(match);
    return `__COM_${comments.length - 1}__`;
  });

  // 3. Highlight keywords, built-ins, and numbers in the remaining code
  // Keywords
  html = html.replace(
    /\b(const|let|var|function|async|await|return|if|else|import|from|export|new|typeof|class|extends|interface|type|void|null|undefined|this|throw|try|catch|finally|for|of|in|switch|case|break|default|package|func|defer|with|as|def|pass)\b/g,
    '<span class="syn-keyword">$1</span>',
  );
  // Built-ins
  html = html.replace(
    /\b(console|Object|Array|Set|Map|Date|Promise|fetch|urllib|json|http|io|fmt|requests)\b/g,
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

type Language = 'curl' | 'node' | 'python' | 'go' | 'response';

const getSnippet = (ep: typeof endpoints[0], tab: Language) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.voltaris.ai/v1';
  const url = `${baseUrl}${ep.path}`;
  if (tab === 'curl') {
    return `curl -X ${ep.method} "${url}" \\
  -H "X-API-Key: YOUR_API_KEY"`;
  }
  if (tab === 'node') {
    return `const response = await fetch("${url}", {
  method: "${ep.method}",
  headers: {
    "X-API-Key": "YOUR_API_KEY"
  }
});

const data = await response.json();
console.log(data);`;
  }
  if (tab === 'python') {
    return `import urllib.request
import json

url = "${url}"
headers = {"X-API-Key": "YOUR_API_KEY"}

req = urllib.request.Request(url, headers=headers, method="${ep.method}")
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    print(data)`;
  }
  if (tab === 'go') {
    return `package main

import (
\t"fmt"
\t"io"
\t"net/http"
)

func main() {
\treq, _ := http.NewRequest("${ep.method}", "${url}", nil)
\treq.Header.Add("X-API-Key", "YOUR_API_KEY")

\tres, _ := http.DefaultClient.Do(req)
\tdefer res.Body.Close()
\t
\tbody, _ := io.ReadAll(res.Body)
\tfmt.Println(string(body))
}`;
  }
  // response
  return `{\n  "status": "success",\n  "data": ${JSON.stringify(ep.response, null, 2).split('\n').join('\n  ')}\n}`;
};

const EndpointPanel = ({ ep, globalLang, setGlobalLang }: { ep: typeof endpoints[0], globalLang: Language, setGlobalLang: (l: Language) => void }) => {
  const [localTab, setLocalTab] = useState<Language>(globalLang);
  const [copied, setCopied] = useState(false);

  // Sync with global language if it changes, unless we are currently viewing response
  useMemo(() => {
    if (localTab !== 'response' && globalLang !== 'response') {
      setLocalTab(globalLang);
    }
  }, [globalLang]);

  const handleTabClick = (tab: Language) => {
    setLocalTab(tab);
    if (tab !== 'response') {
      setGlobalLang(tab);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'curl' as const, label: 'cURL', icon: Terminal },
    { id: 'node' as const, label: 'Node.js', icon: Code2 },
    { id: 'python' as const, label: 'Python', icon: Code2 },
    { id: 'go' as const, label: 'Go', icon: Code2 },
    { id: 'response' as const, label: 'Response', icon: FileJson2 },
  ];

  const rawContent = getSnippet(ep, localTab);
  const highlighted = localTab === 'response' ? highlightJson(rawContent) : highlightCode(rawContent);
  const lines = lineCount(rawContent);

  return (
    <div className="code-panel my-8">
      {/* ── Sticky Tab Bar ────────────────────────────── */}
      <div className="code-panel-tabs">
        <div className="flex overflow-x-auto custom-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`code-tab ${localTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.id === 'response' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pr-3 pl-2 border-l border-[#63738740] shrink-0">
          <button
            onClick={() => copyToClipboard(rawContent)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#63738740] transition-all"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────── */}
      <div className="code-panel-body dark-scrollbar">
        <div className="code-with-lines">
          <div className="code-line-numbers" aria-hidden="true">
            <pre>{lineNumbers(lines)}</pre>
          </div>
          <pre>
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
        </div>
      </div>
    </div>
  );
};

const Docs = () => {
  const [globalLang, setGlobalLang] = useState<Language>('curl');

  return (
    <div className="flex-1 px-12 py-16 max-w-5xl mx-auto h-[calc(100vh-72px)] overflow-y-auto custom-scrollbar">
      <nav className="flex items-center gap-sm text-body-sm text-on-surface-variant mb-md">
        <span>Reference</span>
        <ChevronRight size={16} />
        <span className="text-primary font-semibold">Core API</span>
      </nav>

      <header className="mb-16">
        <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-6">
          Voltatis <span className="text-brand-600">API Reference</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-3xl leading-relaxed">
          The Voltatis API is organized around REST. Our API has predictable resource-oriented URLs, returns JSON-encoded responses, and uses standard HTTP response codes and authentication.
        </p>
      </header>

      {endpoints.map((ep, idx) => (
        <div key={ep.id} className={`mb-xxl ${idx !== 0 ? 'pt-xl border-t border-outline-variant' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              ep.method === 'POST' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {ep.method}
            </span>
            <h2 className="text-h2 font-h2 text-on-surface">{ep.name}</h2>
          </div>
          <code className="text-body-sm font-code-md text-on-surface-variant bg-surface-container-low px-2 py-1 rounded border border-outline-variant inline-block mb-md">
            {ep.path}
          </code>
          
          <p className="text-body-md text-on-surface-variant mb-lg leading-relaxed">
            {ep.desc}
          </p>

          {ep.params && ep.params.length > 0 && (
            <div className="mb-lg">
              <h3 className="text-h3 font-h3 mb-sm text-on-surface">Parameters</h3>
              <div className="border border-outline-variant rounded-xl overflow-hidden">
                <table className="w-full text-left text-body-sm">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-md py-sm font-bold text-on-surface">Parameter</th>
                      <th className="px-md py-sm font-bold text-on-surface">Type</th>
                      <th className="px-md py-sm font-bold text-on-surface">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant bg-surface">
                    {ep.params.map((p, pi) => (
                      <tr key={pi}>
                        <td className="px-md py-sm font-code-md text-primary">
                          {p.name} {p.required && <span className="text-error ml-1">*</span>}
                        </td>
                        <td className="px-md py-sm text-on-surface-variant">{p.type}</td>
                        <td className="px-md py-sm text-on-surface-variant">{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* API Interaction Section */}
          <EndpointPanel ep={ep} globalLang={globalLang} setGlobalLang={setGlobalLang} />

          {idx === 0 && (
            <div className="bg-[#f0f9f1] border-l-4 border-[#22c55e] p-md rounded-xl flex gap-md items-start shadow-sm mb-xl mt-6">
              <div className="bg-[#22c55e] rounded-full p-xs text-white shrink-0 mt-0.5">
                <Lightbulb size={16} />
              </div>
              <div>
                <p className="text-body-md font-semibold text-[#166534] mb-1">Pagination & Limits</p>
                <p className="text-body-sm text-[#166534]/80">List endpoints return a maximum of 100 records per page. Use the cursor parameter provided in the response to fetch subsequent pages efficiently.</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Footer Next Steps */}
      <footer className="mt-24 pt-12 border-t border-outline-variant flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Previous</p>
          <Link to="/getting-started" className="text-lg font-bold text-slate-900 hover:text-brand-600 transition-colors">Getting Started</Link>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Next Up</p>
          <Link to="/demo" className="text-lg font-bold text-slate-900 hover:text-brand-600 transition-colors flex items-center gap-2 justify-end">
            Live Demos
            <ChevronRight size={20} />
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Docs;

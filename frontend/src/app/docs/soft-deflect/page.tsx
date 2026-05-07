'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, ShieldCheck, Sparkles, Workflow } from 'lucide-react';

const BASE_URL = 'https://api.gridwise.in/api/deflect';
const getLiveApiBase = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  if (envUrl.startsWith('ws')) {
    return envUrl.replace(/^ws/, 'http');
  }
  return envUrl;
};

const LIVE_API_BASE = getLiveApiBase();

const navItems = [
  'Overview',
  'Authentication',
  'GET /routing',
  'POST /community-alert',
  'GET /impact-summary',
  'GET /partner-status',
  'Error Codes',
  'Changelog',
] as const;

type NavItem = (typeof navItems)[number];

export default function SoftDeflectDocsPage() {
  const [active, setActive] = useState<NavItem>('Overview');
  const [result, setResult] = useState<string>('');
  const [zoneInput, setZoneInput] = useState('');
  const [copied, setCopied] = useState(false);

  const quickStart = `curl -X GET "${BASE_URL}/routing" \\
  -H "Accept: application/json"`;

  const runPlayground = async () => {
    try {
      let response: Response;
      if (active === 'POST /community-alert') {
        response = await fetch(`${LIVE_API_BASE}/deflect/community-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zoneInput ? { zone_id: zoneInput } : {}),
        });
      } else if (active === 'GET /impact-summary') {
        response = await fetch(`${LIVE_API_BASE}/deflect/impact-summary`);
      } else if (active === 'GET /partner-status') {
        response = await fetch(`${LIVE_API_BASE}/deflect/partner-status`);
      } else {
        response = await fetch(`${LIVE_API_BASE}/deflect/routing`);
      }
      const payload = await response.json();
      setResult(JSON.stringify(payload, null, 2));
    } catch (err: any) {
      setResult(JSON.stringify({ error: err?.message || 'Request failed' }, null, 2));
    }
  };

  const endpointPreview = useMemo(() => {
    if (active === 'POST /community-alert') return 'POST /community-alert';
    if (active === 'GET /impact-summary') return 'GET /impact-summary';
    if (active === 'GET /partner-status') return 'GET /partner-status';
    return 'GET /routing';
  }, [active]);

  const sectionContent = useMemo(() => {
    if (active === 'Authentication') {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Authentication</h2>
          <p className="text-sm text-slate-300">
            Current demo environment accepts direct API calls. Production deployments can enforce
            API keys or OAuth2 at the gateway layer without changing payload contracts.
          </p>
          <pre className="bg-[#09101d] border border-white/10 rounded-xl p-4 text-xs text-cyan-100 overflow-x-auto">
{`curl -X GET "${BASE_URL}/routing" \\
  -H "Authorization: Bearer <token>" \\
  -H "Accept: application/json"`}
          </pre>
        </section>
      );
    }
    if (active === 'GET /routing') {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-black">GET /routing</h2>
          <p className="text-sm text-slate-300">
            Returns live zone-level Soft-Deflect status, routing penalty, and alternative zone hints
            for CRITICAL zones.
          </p>
          <pre className="bg-[#09101d] border border-white/10 rounded-xl p-4 text-xs text-cyan-100 overflow-x-auto">
{`{
  "timestamp": "2026-05-06T10:30:00Z",
  "deflect_layer": [
    {
      "zone_id": "Z01",
      "status": "CRITICAL",
      "routing_penalty": 0.95,
      "recommended_alternative_zone": "Z02"
    }
  ]
}`}
          </pre>
        </section>
      );
    }
    if (active === 'POST /community-alert') {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-black">POST /community-alert</h2>
          <p className="text-sm text-slate-300">
            Fires temporal deflection nudges to partner channels for zones above 85% load. Accepts
            optional `zone_id`; if omitted, all zones are evaluated.
          </p>
          <pre className="bg-[#09101d] border border-white/10 rounded-xl p-4 text-xs text-cyan-100 overflow-x-auto">
{`{
  "zone_id": "Z01"
}`}
          </pre>
        </section>
      );
    }
    if (active === 'GET /impact-summary') {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-black">GET /impact-summary</h2>
          <p className="text-sm text-slate-300">
            Returns aggregate impact metrics and today’s deflection events with predicted, actual,
            and computed deflected kW.
          </p>
        </section>
      );
    }
    if (active === 'GET /partner-status') {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-black">GET /partner-status</h2>
          <p className="text-sm text-slate-300">
            Provides synthetic health and latency telemetry for integrated partner APIs and webhooks.
          </p>
        </section>
      );
    }
    if (active === 'Error Codes') {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Error Codes</h2>
          <div className="space-y-2 text-sm text-slate-300">
            <div><strong>200</strong> Success</div>
            <div><strong>400</strong> No eligible zones / bad request payload</div>
            <div><strong>422</strong> Validation error</div>
            <div><strong>500</strong> Internal server error</div>
          </div>
        </section>
      );
    }
    if (active === 'Changelog') {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Changelog</h2>
          <div className="text-sm text-slate-300">
            <div><strong>v1.0.0</strong> Initial Soft-Deflect release with routing, community alerts, impact summary, and partner-status APIs.</div>
          </div>
        </section>
      );
    }
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Soft-Deflect API</h1>
          <p className="text-cyan-200 mt-2">Translate AI grid predictions into real-world EV behavior.</p>
        </div>

        <p className="text-slate-300 text-sm">
          Built for map providers, RWA applications, and BESCOM operators. Soft-Deflect converts
          forecasted transformer stress into actionable, partner-facing routing and temporal guidance.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs uppercase text-slate-400">How It Works</div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-300" /> 1. GridWise detects zone stress via XGBoost.</div>
              <div className="flex items-center gap-2"><Workflow className="w-4 h-4 text-cyan-300" /> 2. Soft-Deflect translates load % into routing penalties.</div>
              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-cyan-300" /> 3. Partner apps nudge drivers spatially or temporally.</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs uppercase text-slate-400">Spatial Deflection</div>
            <div className="text-sm mt-1 text-slate-200">Public chargers via Ola Maps and MapMyIndia.</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xs uppercase text-slate-400">Temporal Deflection</div>
            <div className="text-sm mt-1 text-slate-200">Home charging nudges via MyGate and NoBrokerHood.</div>
          </div>
        </div>

        <div className="bg-[#09101d] border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-400">Quick Start</span>
            <button
              className="text-xs text-cyan-300"
              onClick={async () => {
                await navigator.clipboard.writeText(quickStart);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? <Check className="w-3 h-3 inline" /> : <Copy className="w-3 h-3 inline" />} Copy
            </button>
          </div>
          <pre className="p-4 text-xs text-cyan-100 overflow-x-auto">{quickStart}</pre>
        </div>
      </section>
    );
  }, [active, copied, quickStart]);

  return (
    <div className="h-screen bg-[#0b1220] text-slate-100 overflow-hidden">
      <div className="h-full flex">
        <aside className="w-[220px] border-r border-white/10 p-4 space-y-4 shrink-0">
          <div>
            <div className="text-sm font-black tracking-tight">GridWise</div>
            <div className="text-xs text-slate-400">Soft-Deflect API</div>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => setActive(item)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                  active === item ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="space-y-2 pt-3 border-t border-white/10">
            <div className="text-[11px] text-slate-400">Base URL</div>
            <div className="text-[10px] bg-white/5 px-2 py-1 rounded">{BASE_URL}</div>
            <div className="flex gap-2">
              <span className="text-[10px] bg-white/5 rounded px-2 py-1">v1.0.0</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 rounded px-2 py-1 animate-pulse">
                ● API Live
              </span>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-10 max-w-[680px]">{sectionContent}</main>

        <aside className="w-[340px] border-l border-white/10 p-4 shrink-0">
          <div className="sticky top-4 space-y-3">
            <div className="text-xs uppercase text-slate-400">Live Playground</div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-3">
              <div className="text-sm font-bold">{endpointPreview}</div>
              {active === 'POST /community-alert' && (
                <input
                  value={zoneInput}
                  onChange={(e) => setZoneInput(e.target.value)}
                  placeholder="Optional zone_id (e.g. Z01)"
                  className="w-full text-xs px-3 py-2 rounded bg-black/30 border border-white/10"
                />
              )}
              <button
                onClick={runPlayground}
                className="w-full text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black py-2 rounded-lg"
              >
                Execute Request <ArrowRight className="w-4 h-4 inline" />
              </button>
            </div>
            <div className="bg-[#09101d] border border-white/10 rounded-xl">
              <div className="px-3 py-2 border-b border-white/10 text-xs text-slate-400">Response</div>
              <pre className="p-3 text-xs max-h-[70vh] overflow-auto text-slate-100">
                {result || '// Run a request to view response JSON'}
              </pre>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

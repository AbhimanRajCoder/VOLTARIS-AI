// ============================================================
// Demo 6 — Partner Health Monitor
// Endpoint: GET /api/deflect/partner-status
//
// Teaches developers how to:
//   1. Build a partner health dashboard
//   2. Implement graceful degradation when a partner goes down
//   3. Monitor latency trends for SLA tracking
//
// The code snippet shows the exact degradation pattern —
// if any partner is unhealthy, fall back to direct BESCOM
// operator alerts instead of Soft-Deflect routing.
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import DemoSection from './DemoSection';
import { fetchPartnerStatus, DEMO_KEY } from '../../lib/deflectApi';
import type { PartnerInfo } from '../../lib/mockData';

const LINE_COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

const PARTNER_ICONS: Record<string, string> = {
  'Ola Maps API': '🗺',
  'MyGate Webhook': '🏢',
  'MapMyIndia API': '📍',
  'NoBrokerHood Webhook': '🏘',
};

// ── Integration-ready code snippet ──────────────────────────

const CODE = `import axios from 'axios';

const API_BASE = 'https://voltaris-ai.onrender.com';
const API_KEY  = 'YOUR_API_KEY';

/**
 * Step 1 — Poll partner health status.
 *
 * The endpoint returns a list of partners with their current
 * status ("healthy" | "degraded" | "offline") and latency.
 */
async function checkPartnerHealth() {
  const { data } = await axios.get(
    \`\${API_BASE}/api/deflect/partner-status\`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return data;
  // {
  //   partners: [
  //     { name: "Ola Maps API", status: "healthy",
  //       latency_ms: 42, last_ping: "..." },
  //     { name: "MyGate Webhook", status: "healthy",
  //       latency_ms: 87, last_ping: null },
  //     ...
  //   ]
  // }
}

/**
 * Step 2 — Detect degradation.
 */
function isDegraded(partners) {
  return partners.some(p => p.status !== 'healthy');
}

/**
 * Step 3 — Implement graceful degradation.
 *
 * When a partner is down, skip the Soft-Deflect
 * spatial/temporal deflection path and fall back to
 * direct BESCOM operator alerts.
 */
async function deflectWithFallback(zoneId) {
  const { partners } = await checkPartnerHealth();

  if (!isDegraded(partners)) {
    // ✅ Full Soft-Deflect path
    const routing = await axios.get(
      \`\${API_BASE}/api/deflect/routing\`,
      { headers: { 'X-API-Key': API_KEY } }
    );
    await axios.post(
      \`\${API_BASE}/api/deflect/community-alert\`,
      { zone_id: zoneId },
      { headers: { 'X-API-Key': API_KEY } }
    );
    return { mode: 'full', routing: routing.data };
  } else {
    // ⚠️ Degraded — direct operator alert
    const offline = partners
      .filter(p => p.status !== 'healthy')
      .map(p => p.name);
    console.warn('Partners degraded:', offline);

    await notifyBescomOperator(zoneId, offline);
    return { mode: 'fallback', offlinePartners: offline };
  }
}

/**
 * Step 4 — Track latency history for SLA reporting.
 */
function useLatencyHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const poll = async () => {
      const { partners } = await checkPartnerHealth();
      const point = { time: new Date().toISOString() };
      partners.forEach(p => {
        point[p.name] = p.latency_ms;
      });
      setHistory(prev => [...prev.slice(-19), point]);
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, []);

  return history;
}`;

const REQUEST = `GET /api/deflect/partner-status HTTP/1.1
Host: api.gridwise.in
X-API-Key: ${DEMO_KEY}
Accept: application/json`;

// ── Helper ──────────────────────────────────────────────────

const toKey = (name: string) => name.toLowerCase().replace(/\s+/g, '_');

// ─────────────────────────────────────────────────────────────

interface LatencyPoint { time: string; [key: string]: string | number; }

const Demo6Health = () => {
  const [partners, setPartners] = useState<PartnerInfo[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [latencyHistory, setLatencyHistory] = useState<LatencyPoint[]>([]);
  const historyRef = useRef<LatencyPoint[]>([]);
  const [responseJson, setResponseJson] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPartnerStatus();
      const list = res.data.partners.map(p =>
        overrides[toKey(p.name)] ? { ...p, status: 'offline' as const, latency_ms: 0 } : p
      );
      setPartners(list);

      const pt: LatencyPoint = {
        time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
      };
      list.forEach(p => { pt[toKey(p.name)] = p.latency_ms; });
      historyRef.current = [...historyRef.current.slice(-9), pt];
      setLatencyHistory([...historyRef.current]);

      setResponseJson(JSON.stringify({ partners: list }, null, 2));
      setResponseTime(res.responseTimeMs);
      setResponseSize(`${(res.sizeBytes / 1024).toFixed(1)} kB`);
      setLastRun(new Date());
    } finally { setLoading(false); }
  }, [overrides]);

  const toggle = (name: string) =>
    setOverrides(prev => ({ ...prev, [toKey(name)]: !prev[toKey(name)] }));

  const isDegraded = partners.some(p => p.status !== 'healthy');
  const offlinePartner = partners.find(p => p.status === 'offline');

  return (
    <DemoSection
      number={6}
      title="Partner Health Monitor"
      subtitle="Build a health dashboard with graceful degradation and SLA latency tracking"
      method="GET"
      endpoint="/api/deflect/partner-status"
      autoRunIntervalSec={10}
      codeContent={CODE}
      requestContent={REQUEST}
      onRun={run}
      responseJson={responseJson}
      responseTimeMs={responseTime}
      responseSizeKb={responseSize}
      lastRunTime={lastRun}
      isLoading={loading}
    >
      <div className="flex flex-col gap-5 h-full">
        {/* Overall status */}
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all ${
          isDegraded
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : partners.length ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          <div className={`w-3 h-3 rounded-full ${
            isDegraded ? 'bg-amber-500 animate-pulse' : partners.length ? 'bg-emerald-500' : 'bg-slate-300'
          }`} />
          <span className="text-sm font-bold">
            {!partners.length ? 'Run demo to check partner status'
              : isDegraded ? 'Degraded Performance' : 'All Systems Operational'}
          </span>
        </div>

        {/* Degradation alert */}
        {isDegraded && offlinePartner && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 animate-slide-up">
            <div className="text-xs font-bold text-red-700 mb-1">⚠ Graceful Degradation Active</div>
            <p className="text-xs text-red-600 leading-relaxed">
              <span className="font-bold">{offlinePartner.name}</span> is offline.
              Routing penalties will not be delivered to this partner.
              Fallback: direct BESCOM operator alerts only.
            </p>
          </div>
        )}

        {/* Partner grid */}
        <div className="grid grid-cols-2 gap-4">
          {partners.map(p => (
            <div key={p.name} className={`rounded-2xl border p-4 transition-all shadow-sm ${
              p.status === 'offline' ? 'bg-red-50 border-red-200'
              : p.status === 'degraded' ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{PARTNER_ICONS[p.name] ?? '🔌'}</span>
                  <span className="text-sm font-bold text-slate-800">{p.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  p.status === 'healthy' ? 'bg-emerald-100 text-emerald-700'
                  : p.status === 'degraded' ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
                }`}>● {p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400 text-[10px] block">Latency</span>
                  <span className="font-mono font-bold text-slate-700">{p.status === 'offline' ? '—' : `${p.latency_ms}ms`}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400 text-[10px] block">Last Ping</span>
                  <span className="font-mono text-slate-600">{p.last_ping ? 'now' : '—'}</span>
                </div>
              </div>
            </div>
          ))}
          {!partners.length && (
            <div className="col-span-2 flex items-center justify-center py-12 text-slate-400 text-xs">
              Click "Run Demo" to load partner statuses
            </div>
          )}
        </div>

        {/* Latency sparkline */}
        {latencyHistory.length > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h5 className="text-xs font-bold text-slate-700 mb-3">Latency History — Last 10 Polls</h5>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={latencyHistory}>
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} unit="ms" width={40} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 10 }} />
                {partners.map((p, i) => (
                  <Line key={p.name} type="monotone" dataKey={toKey(p.name)} stroke={LINE_COLORS[i]} strokeWidth={2} dot={false} name={p.name} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
              {partners.map((p, i) => (
                <div key={p.name} className="flex items-center gap-1.5 text-[9px] text-slate-500">
                  <div className="w-3 h-1 rounded-full" style={{ backgroundColor: LINE_COLORS[i] }} />
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulate failures */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <h5 className="text-xs font-bold text-slate-700 mb-2">Simulate Partner Failures</h5>
          <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
            Toggle a partner OFF, then click <span className="font-bold text-slate-600">Run Demo</span> again to see the degradation handling kick in.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(PARTNER_ICONS).map(name => {
              const off = !!overrides[toKey(name)];
              return (
                <button key={name} onClick={() => toggle(name)}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    off ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}>
                  <span className="flex items-center gap-2">
                    <span>{PARTNER_ICONS[name]}</span>
                    {name}
                  </span>
                  <div className={`w-8 h-4 rounded-full flex items-center transition-all ${off ? 'bg-red-400 justify-start' : 'bg-emerald-400 justify-end'}`}>
                    <div className="w-3 h-3 rounded-full bg-white mx-0.5 shadow-sm" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DemoSection>
  );
};

export default Demo6Health;

// ============================================================
// Demo 4 — Deflection Impact Dashboard
// Endpoint: GET /api/deflect/impact-summary
//
// Teaches developers how to build a KPI dashboard from the
// impact-summary endpoint for stakeholder ROI reporting.
//
// Key insight: the `status` field transitions from
// PENDING_EVAL → COMPUTED after 45 minutes, when the backend
// resolves actual metered load and calculates deflected_kw.
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { Zap, AlertTriangle, ShieldCheck } from 'lucide-react';
import DemoSection from './DemoSection';
import { fetchImpactSummary, DEMO_KEY } from '../../lib/deflectApi';
import { zoneGeoLookup, type DeflectionEventRecord } from '../../lib/mockData';

// ── Integration-ready code snippet ──────────────────────────

const CODE = `import axios from 'axios';

const API_BASE = 'https://voltaris-ai.onrender.com';
const API_KEY  = 'YOUR_API_KEY';

/**
 * Step 1 — Fetch today's impact summary.
 */
async function loadImpactData() {
  const { data } = await axios.get(
    \`\${API_BASE}/api/deflect/impact-summary\`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return data;
  // {
  //   total_deflected_kw_today: 412,
  //   events_fired_today:       5,
  //   blackouts_prevented:      3,
  //   events: [
  //     {
  //       id:           "uuid",
  //       zone_id:      "Z01",
  //       fired_at:     "2026-05-07T09:45:00Z",
  //       predicted_kw: 612.0,       // ML forecast at fire time
  //       actual_kw:    487.0,       // metered load 45 min later
  //       deflected_kw: 125.0,       // predicted - actual
  //       status:       "COMPUTED"   // PENDING_EVAL → COMPUTED
  //     }
  //   ]
  // }
}

/**
 * Step 2 — Build KPI cards from the summary fields.
 */
function renderKPIs(data) {
  setDeflected(data.total_deflected_kw_today);
  setFired(data.events_fired_today);
  setBlackouts(data.blackouts_prevented);
}

/**
 * Step 3 — Build time-series charts from event list.
 *
 * Note: events with status === "PENDING_EVAL" will have
 * actual_kw and deflected_kw as null. Display predicted_kw
 * only and mark them as "evaluating" in your UI.
 */
function buildChartData(events) {
  return events.map(e => ({
    time:      formatHour(e.fired_at),
    predicted: e.predicted_kw,
    actual:    e.actual_kw ?? e.predicted_kw,
    deflected: e.deflected_kw ?? 0,
    status:    e.status,
  }));
}

/**
 * Step 4 — Auto-refresh for live dashboards.
 */
useEffect(() => {
  loadImpactData().then(renderDashboard);
  const id = setInterval(() => {
    loadImpactData().then(renderDashboard);
  }, 60_000);
  return () => clearInterval(id);
}, []);`;

const REQUEST = `GET /api/deflect/impact-summary HTTP/1.1
Host: api.gridwise.in
X-API-Key: ${DEMO_KEY}
Accept: application/json`;

// ─────────────────────────────────────────────────────────────

const Demo4Impact = () => {
  const [kpis, setKpis] = useState({ deflectedKw: 0, eventsFired: 0, blackouts: 0 });
  const [events, setEvents] = useState<DeflectionEventRecord[]>([]);
  const [responseJson, setResponseJson] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchImpactSummary();
      const d = res.data;
      setKpis({
        deflectedKw: d.total_deflected_kw_today,
        eventsFired: d.events_fired_today,
        blackouts:   d.blackouts_prevented,
      });
      setEvents(d.events);
      setResponseJson(JSON.stringify(d, null, 2));
      setResponseTime(res.responseTimeMs);
      setResponseSize(`${(res.sizeBytes / 1024).toFixed(1)} kB`);
      setLastRun(new Date());
    } finally { setLoading(false); }
  }, []);

  const areaData = useMemo(() =>
    events.map(e => ({
      time: new Date(e.fired_at).getHours() + ':00',
      predicted: Math.round(e.predicted_kw),
      actual: Math.round(e.actual_kw ?? e.predicted_kw),
    })),
    [events],
  );

  const barData = useMemo(() =>
    events.map(e => ({
      label: `${e.zone_id}`,
      deflected: Math.round(e.deflected_kw ?? 0),
    })),
    [events],
  );

  return (
    <DemoSection
      number={4}
      title="Deflection Impact Dashboard"
      subtitle="Build a stakeholder-facing KPI dashboard from the impact-summary endpoint"
      method="GET"
      endpoint="/api/deflect/impact-summary"
      autoRunIntervalSec={60}
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
        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-4">
          <div className="kpi-tile kpi-tile-emerald">
            <Zap size={22} />
            <div className="kpi-value">{kpis.deflectedKw || '—'}<span className="text-base ml-1">kW</span></div>
            <div className="kpi-label">Load Deflected Today</div>
          </div>
          <div className="kpi-tile kpi-tile-amber">
            <AlertTriangle size={22} />
            <div className="kpi-value">{kpis.eventsFired || '—'}</div>
            <div className="kpi-label">Alerts Fired</div>
          </div>
          <div className="kpi-tile kpi-tile-brand">
            <ShieldCheck size={22} />
            <div className="kpi-value">{kpis.blackouts || '—'}</div>
            <div className="kpi-label">Blackouts Prevented</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-5 gap-4 min-h-[240px]">
          {/* Area chart — predicted vs actual */}
          <div className="col-span-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h5 className="text-xs font-bold text-slate-700 mb-3">Predicted vs Actual Load (kW)</h5>
            {areaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="g-pred" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-actual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#1D9E75" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11 }} />
                  <Area type="monotone" dataKey="predicted" stroke="#EF4444" strokeDasharray="6 3" fill="url(#g-pred)" strokeWidth={2} name="Predicted kW" />
                  <Area type="monotone" dataKey="actual" stroke="#1D9E75" fill="url(#g-actual)" strokeWidth={2} name="Actual kW" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs">Run demo to populate chart</div>
            )}
          </div>

          {/* Bar chart — deflected kW */}
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h5 className="text-xs font-bold text-slate-700 mb-3">kW Deflected per Event</h5>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11 }} />
                  <Bar dataKey="deflected" fill="#1D9E75" radius={[6, 6, 0, 0]} name="Deflected kW" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs">Run demo to populate chart</div>
            )}
          </div>
        </div>

        {/* Events table */}
        {events.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Zone', 'Fired At', 'Predicted', 'Actual', 'Deflected', 'Δ%', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-widest text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => {
                    const d = e.actual_kw != null ? ((e.predicted_kw - e.actual_kw) / e.predicted_kw) * 100 : null;
                    const geo = zoneGeoLookup[e.zone_id];
                    return (
                      <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{e.zone_id}{geo ? <span className="text-slate-400 font-normal"> · {geo.zone_name}</span> : ''}</td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{new Date(e.fired_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{Math.round(e.predicted_kw)} kW</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{e.actual_kw != null ? `${Math.round(e.actual_kw)} kW` : <span className="text-slate-300">pending</span>}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-emerald-600">{e.deflected_kw != null ? `${Math.round(e.deflected_kw)} kW` : <span className="text-slate-300">—</span>}</td>
                        <td className={`px-4 py-2.5 font-mono font-bold ${d != null ? (d > 15 ? 'text-emerald-600' : d > 5 ? 'text-amber-600' : 'text-red-500') : 'text-slate-300'}`}>
                          {d != null ? `${d.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            e.status === 'COMPUTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>{e.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DemoSection>
  );
};

export default Demo4Impact;

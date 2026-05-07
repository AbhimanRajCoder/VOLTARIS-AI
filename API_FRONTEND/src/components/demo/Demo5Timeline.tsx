// ============================================================
// Demo 5 — Real-Time Alert Timeline
// Endpoints: GET  /api/deflect/impact-summary
//            POST /api/deflect/community-alert
//
// Teaches developers how to build a live event feed that:
//   1. Polls impact-summary for new events
//   2. De-duplicates by event ID
//   3. Supports manual event generation
//   4. Exports event audit trail as CSV
// ============================================================

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Download, Plus, Check } from 'lucide-react';
import DemoSection from './DemoSection';
import { fetchImpactSummary, fireCommunityAlert, DEMO_KEY } from '../../lib/deflectApi';
import { ZONE_REGISTRY, zoneGeoLookup, type DeflectionEventRecord } from '../../lib/mockData';

// ── Integration-ready code snippet ──────────────────────────

const CODE = `import axios from 'axios';

const API_BASE = 'https://voltaris-ai.onrender.com'; 
const API_KEY  = 'YOUR_API_KEY';

/**
 * Step 1 — Build a live event feed with polling.
 *
 * The impact-summary endpoint returns today's deflection
 * events. Each event has a unique \`id\` field — use it
 * for deduplication across polls.
 */
function useAlertFeed() {
  const [events, setEvents] = useState([]);

  const fetchEvents = async () => {
    const { data } = await axios.get(
      \`\${API_BASE}/api/deflect/impact-summary\`,
      { headers: { 'X-API-Key': API_KEY } }
    );

    setEvents(prev => {
      const seen = new Set(prev.map(e => e.id));
      const fresh = data.events.filter(e => !seen.has(e.id));
      return [...fresh, ...prev];  // newest first
    });
  };

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, 30_000);
    return () => clearInterval(id);
  }, []);

  return events;
}

/**
 * Step 2 — Fire a new event to populate the feed.
 *
 * POST to /community-alert creates a PENDING_EVAL row
 * in the database. After 45 minutes the backend resolves
 * actual_kw and deflected_kw (status → COMPUTED).
 */
async function generateEvent(zoneId: string) {
  await axios.post(
    \`\${API_BASE}/api/deflect/community-alert\`,
    { zone_id: zoneId },
    { headers: { 'X-API-Key': API_KEY } }
  );
  // Re-fetch to pick up the new event
  await fetchEvents();
}

/**
 * Step 3 — Export the audit trail as CSV.
 */
function exportCSV(events) {
  const header = 'id,zone_id,fired_at,predicted_kw,actual_kw,deflected_kw,status';
  const rows = events.map(e =>
    [e.id, e.zone_id, e.fired_at,
     e.predicted_kw, e.actual_kw ?? '', e.deflected_kw ?? '',
     e.status].join(',')
  );
  downloadFile(
    [header, ...rows].join('\\n'),
    'deflection_events.csv', 'text/csv'
  );
}`;

const REQUEST = `GET /api/deflect/impact-summary HTTP/1.1
Host: api.gridwise.in
X-API-Key: ${DEMO_KEY}
Accept: application/json

---

POST /api/deflect/community-alert HTTP/1.1
Host: api.gridwise.in
X-API-Key: ${DEMO_KEY}
Content-Type: application/json

{ "zone_id": "Z01" }`;

// ─────────────────────────────────────────────────────────────

interface TimelineEvent extends DeflectionEventRecord { isNew?: boolean; }

const ZONE_IDS = ZONE_REGISTRY.map(z => z.zone_id);

const Demo5Timeline = () => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterZone, setFilterZone] = useState('all');
  const [responseJson, setResponseJson] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchImpactSummary();
      setEvents(prev => {
        const seen = new Set(prev.map(e => e.id));
        const fresh = res.data.events.filter(e => !seen.has(e.id));
        return [...fresh, ...prev];
      });
      setResponseJson(JSON.stringify(res.data, null, 2));
      setResponseTime(res.responseTimeMs);
      setResponseSize(`${(res.sizeBytes / 1024).toFixed(1)} kB`);
      setLastRun(new Date());
    } finally { setLoading(false); }
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const z = ZONE_IDS[Math.floor(Math.random() * ZONE_IDS.length)];
      const res = await fireCommunityAlert(z);
      const synth: TimelineEvent = {
        id: res.data.event_id,
        zone_id: z,
        fired_at: new Date().toISOString(),
        predicted_kw: Math.round(600 + Math.random() * 400),
        actual_kw: null,
        deflected_kw: null,
        status: 'PENDING_EVAL',
        isNew: true,
      };
      setEvents(prev => [synth, ...prev]);
      setResponseJson(JSON.stringify(res.data, null, 2));
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } finally { setGenerating(false); }
  }, []);

  const filtered = events.filter(e => filterZone === 'all' || e.zone_id === filterZone);

  const statusDot = (e: TimelineEvent) =>
    e.status === 'COMPUTED'
      ? (e.deflected_kw != null && e.deflected_kw >= 80 ? 'bg-emerald-500' : 'bg-amber-500')
      : 'bg-slate-400';

  const timeAgo = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  const exportCsv = () => {
    const hdr = 'id,zone_id,fired_at,predicted_kw,actual_kw,deflected_kw,status\n';
    const rows = events.map(e =>
      `${e.id},${e.zone_id},${e.fired_at},${Math.round(e.predicted_kw)},${e.actual_kw ?? ''},${e.deflected_kw ?? ''},${e.status}`
    ).join('\n');
    const blob = new Blob([hdr + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `deflect_events_${Date.now()}.csv`;
    a.click();
  };

  return (
    <DemoSection
      number={5}
      title="Real-Time Alert Timeline"
      subtitle="Build a live event feed with deduplication, filtering, and CSV audit export"
      method="GET"
      endpoint="/api/deflect/impact-summary"
      autoRunIntervalSec={30}
      codeContent={CODE}
      requestContent={REQUEST}
      onRun={run}
      responseJson={responseJson}
      responseTimeMs={responseTime}
      responseSizeKb={responseSize}
      lastRunTime={lastRun}
      isLoading={loading}
    >
      <div className="flex flex-col h-full min-h-[520px]">
        {/* Filter / toolbar */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-t-2xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-400 transition-colors">
              <option value="all">All Zones</option>
              {ZONE_IDS.map(z => <option key={z} value={z}>{z} — {zoneGeoLookup[z]?.zone_name}</option>)}
            </select>
            <span className="text-[10px] text-slate-400 font-semibold">{filtered.length} events</span>
          </div>
          <button onClick={exportCsv} disabled={!events.length}
            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-emerald-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40">
            <Download size={12} /> Export CSV
          </button>
        </div>

        {/* Event feed */}
        <div className="flex-1 border-x border-slate-200 overflow-y-auto custom-scrollbar bg-white">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-16">
              <span className="text-sm font-semibold">No events yet</span>
              <span className="text-xs">Click "Run Demo" to load from the backend</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(ev => {
                const geo = zoneGeoLookup[ev.zone_id];
                return (
                  <div key={ev.id}
                    className={`px-4 py-3.5 hover:bg-slate-50/70 transition-all cursor-pointer ${ev.isNew ? 'animate-slide-down bg-emerald-50/30' : ''}`}
                    onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${statusDot(ev)} shadow-sm`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-800">{ev.zone_id}{geo ? ` · ${geo.zone_name}` : ''}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            ev.status === 'COMPUTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>{ev.status}</span>
                          {ev.isNew && <span className="text-[8px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">NEW</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 mb-1">{timeAgo(ev.fired_at)}</div>
                        <div className="text-xs text-slate-600">
                          Predicted: <span className="font-mono font-bold">{Math.round(ev.predicted_kw)} kW</span>
                          {ev.actual_kw != null && (<>
                            <span className="mx-1.5 text-slate-300">→</span>
                            Actual: <span className="font-mono font-bold">{Math.round(ev.actual_kw)} kW</span>
                            <span className="mx-1.5 text-slate-300">→</span>
                            Deflected: <span className="font-mono font-bold text-emerald-600">{Math.round(ev.deflected_kw ?? 0)} kW</span>
                          </>)}
                        </div>
                        {expanded === ev.id && (
                          <pre className="mt-3 bg-[#0d1117] rounded-xl p-3 text-[10px] font-mono text-slate-400 overflow-x-auto dark-scrollbar">{JSON.stringify(ev, null, 2)}</pre>
                        )}
                      </div>
                      <div className="shrink-0 text-slate-300 mt-1">{expanded === ev.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Generate button */}
        <div className="bg-white border border-slate-200 rounded-b-2xl px-4 py-3 shadow-sm">
          <button onClick={generate} disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold rounded-xl px-4 py-2.5 transition-all disabled:opacity-50 shadow-sm">
            {generating ? <div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> : <Plus size={14} />}
            Generate New Event
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-[9999] bg-emerald-600 text-white text-sm font-semibold rounded-xl px-5 py-3 shadow-2xl flex items-center gap-2 animate-slide-up">
            <Check size={16} /> Event generated — will appear in timeline
          </div>
        )}
      </div>
    </DemoSection>
  );
};

export default Demo5Timeline;

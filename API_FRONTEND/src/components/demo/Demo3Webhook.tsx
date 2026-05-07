// ============================================================
// Demo 3 — Community Webhook Fire
// Endpoint: POST /api/deflect/community-alert
//
// Teaches developers the full lifecycle of a temporal
// deflection webhook:
//   1. App fires POST → backend evaluates zone load
//   2. If zone > 85% load, backend creates a deflection event
//   3. Partner webhook is called with a push notification template
//   4. RWA smart meters can auto-defer EV load
//
// The code snippet shows both the client integration (firing
// alerts) and the server integration (receiving webhooks).
// ============================================================

import { useState, useCallback } from 'react';
import DemoSection from './DemoSection';
import { fireCommunityAlert, DEMO_KEY } from '../../lib/deflectApi';
import { ZONE_REGISTRY, type CommunityAlertResponse } from '../../lib/mockData';

// ── Integration-ready code snippet ──────────────────────────

const CODE = `import axios from 'axios';

const API_BASE = 'https://voltaris-ai.onrender.com';
const API_KEY  = 'YOUR_API_KEY';

// ═══════════════════════════════════════════════════════
// CLIENT INTEGRATION — Fire a deflection alert
// ═══════════════════════════════════════════════════════

/**
 * Step 1 — Fire a community alert.
 *
 * If zone_id is omitted the backend auto-selects the
 * highest-load zone above 85%. If no zone qualifies,
 * the API returns 400.
 */
async function fireDeflectionAlert(zoneId?: string) {
  const body = zoneId ? { zone_id: zoneId } : {};
  const { data } = await axios.post(
    \`\${API_BASE}/api/deflect/community-alert\`,
    body,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return data;
  // {
  //   event_id:              "evt_<uuid>",
  //   target_ward:           "Whitefield",
  //   affected_rwa_ids:      ["RWA_402", "RWA_891"],
  //   grid_load_pct:         92.5,
  //   action_required:       "DEFER_EV_CHARGING",
  //   optimal_resume_time:   "2026-05-07T23:00:00Z",
  //   partner_push_template: {
  //     title: "⚠️ Urgent: BESCOM Grid Stress",
  //     body:  "Whitefield grid is at 92.5% capacity..."
  //   }
  // }
}

/**
 * Step 2 — Forward the push template to your users.
 */
async function notifyResidents(alert) {
  const { affected_rwa_ids, partner_push_template } = alert;

  await pushService.sendBatch({
    to:    affected_rwa_ids,
    title: partner_push_template.title,
    body:  partner_push_template.body,
  });
}

// ═══════════════════════════════════════════════════════
// SERVER INTEGRATION — Receive webhooks
// ═══════════════════════════════════════════════════════

/**
 * Step 3 — Register your webhook endpoint once:
 *   POST /api/deflect/register-webhook
 *   { "url": "https://your-app.com/grid-alert" }
 *
 * GridWise will POST the same CommunityAlertResponse
 * payload to your URL whenever any zone exceeds 85%.
 */
app.post('/grid-alert', (req, res) => {
  const {
    action_required,
    optimal_resume_time,
    affected_rwa_ids,
  } = req.body;

  if (action_required === 'DEFER_EV_CHARGING') {
    // Tell smart meters to hold EV charging until resume time
    smartMeterService.deferLoad(
      affected_rwa_ids,
      optimal_resume_time
    );
  }

  res.json({ ack: true });
});`;

const REQUEST = `POST /api/deflect/community-alert HTTP/1.1
Host: api.gridwise.in
X-API-Key: ${DEMO_KEY}
Content-Type: application/json

{
  "zone_id": "Z01"
}`;

// ─────────────────────────────────────────────────────────────

const Demo3Webhook = () => {
  const [selectedZone, setSelectedZone] = useState('Z01');
  const [alertData, setAlertData] = useState<CommunityAlertResponse | null>(null);
  const [responseJson, setResponseJson] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  const run = useCallback(async () => {
    setLoading(true);
    setStep(0);
    try {
      const res = await fireCommunityAlert(selectedZone);
      setAlertData(res.data);
      setResponseJson(JSON.stringify(res.data, null, 2));
      setResponseTime(res.responseTimeMs);
      setResponseSize(`${(res.sizeBytes / 1024).toFixed(1)} kB`);
      setLastRun(new Date());
      // Animate the flow diagram in sequence
      setStep(1);
      setTimeout(() => setStep(2), 500);
      setTimeout(() => setStep(3), 1000);
      setTimeout(() => setStep(4), 1500);
    } finally { setLoading(false); }
  }, [selectedZone]);

  return (
    <DemoSection
      number={3}
      title="Community Webhook Fire"
      subtitle="The full lifecycle: fire an alert → evaluate zone load → deliver push notification → defer EV load"
      method="POST"
      endpoint="/api/deflect/community-alert"
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
      <div className="flex flex-col gap-5 h-full">
        {/* ── Panel A: Trigger Configuration ─────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">1</span>
            Fire Community Alert
          </h4>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest block mb-1">Target Zone</label>
              <select
                value={selectedZone}
                onChange={e => setSelectedZone(e.target.value)}
                className="w-full bg-slate-50 text-sm rounded-xl px-3 py-2.5 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none transition-all"
              >
                {ZONE_REGISTRY.map(z => (
                  <option key={z.zone_id} value={z.zone_id}>{z.zone_id} — {z.zone_name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            The backend evaluates the zone's current load. If above <span className="font-bold text-slate-600">85%</span>,
            it creates a deflection event and returns the push template.
          </p>
        </div>

        {/* ── Panel B: Delivery Flow Diagram ──────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700">2</span>
            Delivery Flow
          </h4>

          {/* 3-node flow diagram */}
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className={`flow-node ${step >= 1 ? 'flow-node-active' : ''}`}>
              <div className="text-xl mb-1">⚡</div>
              <div className="text-[10px] font-bold">GridWise API</div>
              <div className="text-[8px] text-slate-400 mt-0.5">POST /community-alert</div>
            </div>
            <div className={`flow-arrow ${step >= 2 ? 'flow-arrow-active' : ''}`}><div className="flow-dot" /></div>
            <div className={`flow-node ${step >= 2 ? 'flow-node-active' : ''}`}>
              <div className="text-xl mb-1">🏢</div>
              <div className="text-[10px] font-bold">Partner Server</div>
              <div className="text-[8px] text-slate-400 mt-0.5">Webhook handler</div>
            </div>
            <div className={`flow-arrow ${step >= 3 ? 'flow-arrow-active' : ''}`}><div className="flow-dot" /></div>
            <div className={`flow-node ${step >= 3 ? 'flow-node-active' : ''}`}>
              <div className="text-xl mb-1">📱</div>
              <div className="text-[10px] font-bold">RWA Push</div>
              <div className="text-[8px] text-slate-400 mt-0.5">Resident notification</div>
            </div>
          </div>

          {/* Push notification mockup */}
          {step >= 4 && alertData && (
            <div className="push-notification animate-slide-up">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">M</div>
                  <span className="text-xs font-bold text-slate-800">MyGate</span>
                </div>
                <span className="text-[9px] text-slate-400">now</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mb-0.5">{alertData.partner_push_template.title}</div>
              <div className="text-xs text-slate-600 leading-relaxed">{alertData.partner_push_template.body}</div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                <span className="text-[9px] text-slate-400 font-mono">event: {alertData.event_id.slice(0, 20)}…</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Panel C: Event Summary ─────────────────── */}
        {alertData && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-fade-in">
            <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">3</span>
              Event Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-slate-400 text-[10px] block mb-0.5">Target Ward</span>
                <span className="font-bold text-slate-800">{alertData.target_ward}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-slate-400 text-[10px] block mb-0.5">Grid Load</span>
                <span className="font-bold text-red-600">{alertData.grid_load_pct}%</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-slate-400 text-[10px] block mb-0.5">Affected RWAs</span>
                <span className="font-bold text-slate-800">{alertData.affected_rwa_ids.join(', ')}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <span className="text-slate-400 text-[10px] block mb-0.5">Resume At</span>
                <span className="font-bold text-emerald-600">
                  {new Date(alertData.optimal_resume_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DemoSection>
  );
};

export default Demo3Webhook;

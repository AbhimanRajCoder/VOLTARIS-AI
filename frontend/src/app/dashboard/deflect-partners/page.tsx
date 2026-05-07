'use client';

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Power, Send, X } from 'lucide-react';

import {
  triggerCommunityAlert,
  useDeflectImpactSummary,
  useDeflectPartnerStatus,
  useDeflectRouting,
} from '@/lib/api';
import { CommunityAlertResponse } from '@/lib/types';

type PartnerMode = 'active' | 'paused';

function relativeSeconds(timestamp?: string | null): string {
  if (!timestamp) return 'just now';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  return `${diff} seconds ago`;
}

function statusTone(status: string): { label: string; className: string } {
  if (status === 'offline') {
    return { label: '● Offline', className: 'bg-red-50 text-red-700 border-red-200' };
  }
  if (status === 'degraded') {
    return { label: '● Degraded', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return { label: '● Live', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

export default function DeflectPartnersPage() {
  const { data: partnerStatus } = useDeflectPartnerStatus();
  const { data: routing } = useDeflectRouting();
  const { data: impact } = useDeflectImpactSummary(30_000);

  const [modes, setModes] = useState<Record<string, PartnerMode>>({});
  const [modalPayload, setModalPayload] = useState<CommunityAlertResponse | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cards = partnerStatus?.partners || [];
  const layerRows = routing?.deflect_layer || [];

  const sortedEvents = useMemo(
    () => [...(impact?.events || [])].sort((a, b) => new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime()),
    [impact?.events]
  );

  const onTestWebhook = async () => {
    setIsSending(true);
    setError(null);
    try {
      const payload = await triggerCommunityAlert();
      setModalPayload(payload);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to fire webhook test');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Soft-Deflect Partner Operations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Live partner health, routing penalties, and deflection activity feed.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-700" />
          <h2 className="text-lg font-black">Partner API Status Panel</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((partner) => {
            const tone = statusTone(partner.status);
            const mode = modes[partner.name] || 'active';
            return (
              <div
                key={partner.name}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{partner.name}</p>
                  <span className={`text-xs border rounded-full px-2 py-1 font-bold ${tone.className}`}>
                    {tone.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Latency: {partner.latency_ms} ms</p>
                <p className="text-xs text-slate-500">
                  Last pinged: {relativeSeconds(partner.last_ping || new Date().toISOString())}
                </p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() =>
                      setModes((prev) => ({
                        ...prev,
                        [partner.name]: prev[partner.name] === 'paused' ? 'active' : 'paused',
                      }))
                    }
                    className={`text-xs px-3 py-1.5 rounded-full border font-bold ${
                      mode === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    <Power className="w-3 h-3 inline mr-1" />
                    {mode === 'active' ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={onTestWebhook}
                    disabled={isSending}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-60"
                  >
                    <Send className="w-3 h-3 inline mr-1" />
                    {isSending ? 'Sending...' : 'Test Webhook'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-slate-700" />
          <h2 className="text-lg font-black">Live Deflect Layer Table</h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 border-b">
              <tr>
                <th className="text-left px-4 py-3">Zone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Penalty Score</th>
                <th className="text-left px-4 py-3">Message</th>
                <th className="text-left px-4 py-3">Alternative Zone</th>
                <th className="text-left px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {layerRows.map((row) => {
                const rowClass =
                  row.status === 'CRITICAL'
                    ? 'bg-red-50'
                    : row.status === 'AMBER'
                    ? 'bg-yellow-50'
                    : 'bg-green-50';
                return (
                  <tr key={row.zone_id} className={rowClass}>
                    <td className="px-4 py-3 font-bold">{row.zone_id}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        {row.status === 'CRITICAL' ? (
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                        ) : row.status === 'AMBER' ? (
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.routing_penalty}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[420px]">{row.user_facing_message}</td>
                    <td className="px-4 py-3">{row.recommended_alternative_zone || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {routing?.timestamp ? new Date(routing.timestamp).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-slate-700" />
          <h2 className="text-lg font-black">Recent Deflection Events Feed</h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 max-h-[320px] overflow-y-auto space-y-2">
          {sortedEvents.length === 0 && (
            <p className="text-sm text-slate-500">No deflection events fired yet today.</p>
          )}
          {sortedEvents.map((evt) => (
            <div key={evt.id} className="text-sm border border-slate-100 rounded-xl p-3 bg-slate-50">
              {evt.zone_id} · Ward {evt.zone_id} · {(evt.predicted_kw || 0).toFixed(1)} kW load · Webhook fired{' '}
              {relativeSeconds(evt.fired_at)} · Est. {(evt.deflected_kw || 0).toFixed(0)} kW deflected
            </div>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

      {modalPayload && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black">Webhook Response Payload</h3>
              </div>
              <button onClick={() => setModalPayload(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="p-4 text-xs overflow-auto max-h-[420px] bg-slate-900 text-slate-100 rounded-b-2xl">
              {JSON.stringify(modalPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

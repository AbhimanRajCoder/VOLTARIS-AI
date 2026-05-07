'use client';

import { Clock, Zap } from 'lucide-react';
import type { ControlLogEntry } from '@/lib/control-api';
import { format } from 'date-fns';

const actionBadge: Record<string, { bg: string; text: string }> = {
  DEFER:          { bg: 'bg-red-50 border-red-200',    text: 'text-red-600' },
  OPTIMAL_WINDOW: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600' },
  NO_ACTION:      { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500' },
  ROLLBACK:       { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-600' },
};

export default function ControlLogPanel({ entries }: { entries: ControlLogEntry[] }) {
  return (
    <div className="card p-6 bg-white border border-slate-100 shadow-sm flex flex-col max-h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Audit Trail</h2>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Control Log</h3>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <Zap className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-black text-slate-400">{entries.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Clock className="w-8 h-8 text-slate-200 mb-3" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No actions recorded</p>
          </div>
        ) : entries.map((entry, i) => {
          const badge = actionBadge[entry.action] || actionBadge.NO_ACTION;
          return (
            <div key={`${entry.timestamp}-${i}`} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text}`}>
                  {entry.action.replace('_', ' ')}
                </span>
                <span className="text-[10px] font-bold text-slate-300 tabular-nums">
                  {format(new Date(entry.timestamp), 'HH:mm:ss')}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-600 line-clamp-2">{entry.detail}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] font-bold text-slate-400">{entry.zone_id}</span>
                <span className="text-[9px] font-bold text-emerald-500">-{entry.impact_kw.toFixed(0)} kW</span>
                <span className="text-[9px] font-bold text-slate-400">{entry.stations_affected} stations</span>
                <span className="text-[9px] font-bold text-slate-300 ml-auto">{entry.operator}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

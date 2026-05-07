'use client';

import { Shield, Zap, AlertTriangle } from 'lucide-react';
import type { ZoneControlState } from '@/lib/control-api';

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: typeof Shield; label: string }> = {
  NORMAL: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Shield, label: 'Grid Stable' },
  WARNING: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, label: 'Elevated Risk' },
  CONTROL_ACTIVE: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: Zap, label: 'Control Active' },
};

const riskColors: Record<string, string> = {
  LOW: 'bg-emerald-500', MODERATE: 'bg-amber-500', SEVERE: 'bg-orange-500', CRITICAL: 'bg-red-500',
};

interface Props {
  zoneState?: ZoneControlState | null;
  zoneId: string;
  liveData?: { load_kw: number; capacity_kw: number; ev_share_pct: number } | null;
  alertCount?: number;
}

export default function StatusHeader({ zoneState, zoneId, liveData, alertCount = 0 }: Props) {
  const status = zoneState?.status || 'NORMAL';
  const cfg = statusConfig[status] || statusConfig.NORMAL;
  const Icon = cfg.icon;
  const risk = zoneState?.risk_level || 'LOW';

  // Use REAL forecast data when available, fallback to control state
  const peakLoad = liveData?.load_kw || zoneState?.peak_load_kw || 0;
  const capacity = liveData?.capacity_kw || zoneState?.capacity_kw || 0;
  const utilization = capacity > 0 ? (peakLoad / capacity) * 100 : zoneState?.utilization_pct || 0;
  const evShare = liveData?.ev_share_pct ? liveData.ev_share_pct.toFixed(1) : '—';

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-2xl p-6 transition-all duration-500`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${cfg.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${riskColors[risk]} ${status === 'CONTROL_ACTIVE' ? 'animate-pulse shadow-lg shadow-red-500/30' : ''}`} />
              <span className={`text-lg font-black uppercase tracking-tight ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              Zone {zoneId} • {risk} Risk {alertCount > 0 && `• ${alertCount} Active Alerts`}
            </p>
          </div>
        </div>

        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Load</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums">{peakLoad.toFixed(0)}<span className="text-sm font-bold text-slate-400 ml-1">kW</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Capacity</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums">{capacity.toFixed(0)}<span className="text-sm font-bold text-slate-400 ml-1">kW</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utilization</p>
            <p className={`text-2xl font-black tabular-nums ${utilization > 85 ? 'text-red-600' : utilization > 65 ? 'text-amber-600' : 'text-slate-900'}`}>{utilization.toFixed(1)}<span className="text-sm font-bold text-slate-400 ml-1">%</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">EV Share</p>
            <p className="text-2xl font-black text-blue-600 tabular-nums">{evShare}<span className="text-sm font-bold text-blue-400 ml-1">%</span></p>
          </div>
          {zoneState?.reduction_kw ? (
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reduction</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums">{zoneState.reduction_kw.toFixed(0)}<span className="text-sm font-bold text-emerald-400 ml-1">kW</span></p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

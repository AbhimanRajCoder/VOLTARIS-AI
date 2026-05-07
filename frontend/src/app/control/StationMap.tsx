'use client';

import { MapPin } from 'lucide-react';
import type { Station, OrchestrateResponse, StationMode } from '@/lib/control-api';

const modeConfig: Record<StationMode, { color: string; bg: string; border: string; pulse: boolean; label: string }> = {
  NORMAL:  { color: 'text-emerald-600', bg: 'bg-emerald-500', border: 'border-emerald-300', pulse: false, label: 'Normal' },
  LIMITED: { color: 'text-red-600',     bg: 'bg-red-500',     border: 'border-red-300',     pulse: true,  label: 'Limited' },
  DELAY:   { color: 'text-amber-600',   bg: 'bg-amber-500',   border: 'border-amber-300',   pulse: false, label: 'Delay' },
  OFFLINE: { color: 'text-slate-400',   bg: 'bg-slate-400',   border: 'border-slate-300',   pulse: false, label: 'Offline' },
};

export default function StationMap({ stations, result }: { stations: Station[]; result: OrchestrateResponse | null }) {
  // Merge result station updates to get current modes
  const stationMap = new Map(stations.map(s => [s.station_id, s]));
  if (result?.stations) {
    result.stations.forEach(u => {
      const st = stationMap.get(u.station_id);
      if (st) {
        st.mode = u.new_mode;
        st.current_load_kw = u.load_after_kw;
      }
    });
  }
  const displayStations = Array.from(stationMap.values());

  return (
    <div className="card p-6 bg-white border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Station Network</h2>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Live Station Map</h3>
        </div>
        <div className="flex gap-4">
          {(['NORMAL', 'DELAY', 'LIMITED'] as StationMode[]).map(mode => {
            const cfg = modeConfig[mode];
            return (
              <div key={mode} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.bg} ${cfg.pulse ? 'animate-pulse' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{cfg.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Station Grid (visual map representation) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayStations.length === 0 ? (
          <div className="col-span-3 text-center py-12">
            <MapPin className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">No stations loaded</p>
          </div>
        ) : displayStations.map(station => {
          const cfg = modeConfig[station.mode] || modeConfig.NORMAL;
          const loadPct = station.capacity_kw > 0 ? (station.current_load_kw / station.capacity_kw) * 100 : 0;
          return (
            <div
              key={station.station_id}
              className={`p-4 rounded-xl border-2 ${cfg.border} transition-all duration-500 hover:shadow-md ${
                cfg.pulse ? 'animate-pulse' : ''
              }`}
              style={{ animationDuration: cfg.pulse ? '2s' : undefined }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${cfg.bg} ${cfg.pulse ? 'shadow-lg shadow-red-500/40' : ''}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{station.station_id}</span>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${cfg.bg} text-white`}>{cfg.label}</span>
              </div>
              <p className="text-xs font-bold text-slate-700 mb-2 truncate">{station.name}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{station.current_load_kw.toFixed(0)}<span className="text-[10px] text-slate-400 ml-0.5">kW</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400">{station.connected_vehicles} EVs</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${loadPct > 85 ? 'bg-red-500' : loadPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, loadPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

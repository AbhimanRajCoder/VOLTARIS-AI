'use client';

import { Zap, Pause, Clock, RotateCcw, Loader2, Play } from 'lucide-react';
import type { ZoneControlState, ControlAction } from '@/lib/control-api';

interface Props {
  mode: 'auto' | 'manual';
  loading: boolean;
  zoneState?: ZoneControlState | null;
  onOrchestrate: () => void;
  onManualAction: (action: ControlAction) => void;
  onRollback: () => void;
}

export default function ActionPanel({ mode, loading, zoneState, onOrchestrate, onManualAction, onRollback }: Props) {
  const isActive = zoneState?.status === 'CONTROL_ACTIVE';

  return (
    <div className="card p-6 bg-white border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Decision Engine</h2>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            {mode === 'auto' ? 'AI-Controlled Actions' : 'Manual Override'}
          </h3>
        </div>
        {isActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Control Active</span>
          </div>
        )}
      </div>

      {mode === 'auto' ? (
        <div className="space-y-4">
          <button
            onClick={onOrchestrate}
            disabled={loading}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Processing Pipeline...</>
            ) : (
              <><Zap className="w-5 h-5" />Run Smart Control</>
            )}
          </button>
          <p className="text-xs text-slate-400 text-center font-medium">
            AI will analyze grid state, select optimal strategy, and execute automatically
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => onManualAction('DEFER')}
            disabled={loading}
            className="w-full py-3.5 px-6 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 disabled:opacity-50"
          >
            <Pause className="w-4 h-4" />
            <span>Defer Charging</span>
            <span className="ml-auto text-[10px] font-bold text-red-400">Load × 0.4</span>
          </button>
          <button
            onClick={() => onManualAction('OPTIMAL_WINDOW')}
            disabled={loading}
            className="w-full py-3.5 px-6 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 disabled:opacity-50"
          >
            <Clock className="w-4 h-4" />
            <span>Shift Load Window</span>
            <span className="ml-auto text-[10px] font-bold text-amber-400">Load × 0.7</span>
          </button>
          <button
            onClick={() => onManualAction('NO_ACTION')}
            disabled={loading}
            className="w-full py-3.5 px-6 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>Resume Normal</span>
            <span className="ml-auto text-[10px] font-bold text-emerald-400">Full Load</span>
          </button>
        </div>
      )}

      {/* Rollback */}
      {isActive && (
        <button
          onClick={onRollback}
          disabled={loading}
          className="w-full mt-4 py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />Rollback to Normal
        </button>
      )}
    </div>
  );
}

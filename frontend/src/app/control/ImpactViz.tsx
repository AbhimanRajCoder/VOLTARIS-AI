'use client';

import { TrendingDown, ArrowDown, ArrowRight } from 'lucide-react';
import type { OrchestrateResponse } from '@/lib/control-api';

export default function ImpactViz({ result }: { result: OrchestrateResponse | null }) {
  if (!result) {
    return (
      <div className="card p-6 bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center min-h-[280px]">
        <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
          <TrendingDown className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-300">Run Control to See Impact</p>
      </div>
    );
  }

  const sim = result.simulation;
  const reductionPct = sim.peak_reduction_percentage;

  return (
    <div className="card p-6 bg-white border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Impact Analysis</h2>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Before vs After</h3>
        </div>
        <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
          <span className="text-xs font-black text-emerald-600">-{reductionPct.toFixed(1)}% Peak</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Peak Load', before: `${sim.before_load_kw.toFixed(0)}`, after: `${sim.after_load_kw.toFixed(0)}`, unit: 'kW', improved: sim.after_load_kw < sim.before_load_kw },
          { label: 'Stress Hours', before: `${sim.stress_hours_before}`, after: `${sim.stress_hours_after}`, unit: 'hrs', improved: sim.stress_hours_after < sim.stress_hours_before },
          { label: 'Status', before: '🔴', after: sim.stress_hours_after <= 2 ? '🟢' : '🟡', unit: '', improved: true },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{m.label}</p>
            <div className="flex items-center justify-center gap-2">
              <div className="px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                <span className="text-sm font-black text-red-600">{m.before}</span>
                <span className="text-[10px] text-red-400 ml-0.5">{m.unit}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
              <div className={`px-3 py-2 rounded-lg border ${m.improved ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <span className={`text-sm font-black ${m.improved ? 'text-emerald-600' : 'text-amber-600'}`}>{m.after}</span>
                <span className={`text-[10px] ml-0.5 ${m.improved ? 'text-emerald-400' : 'text-amber-400'}`}>{m.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Compliance Rate</p>
          <div className="flex items-end gap-2">
            <span className="text-xl font-black text-slate-900">{(sim.compliance_rate * 100).toFixed(0)}%</span>
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden mb-1">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${sim.compliance_rate * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Actual Reduction</p>
          <div className="flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-emerald-500" />
            <span className="text-xl font-black text-emerald-600">{sim.actual_reduction_kw.toFixed(0)}</span>
            <span className="text-xs font-bold text-emerald-400">kW saved</span>
          </div>
        </div>
      </div>
    </div>
  );
}

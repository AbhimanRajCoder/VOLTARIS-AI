'use client';

import { CheckCircle2, ChevronRight } from 'lucide-react';
import type { TimelineStep } from '@/lib/control-api';
import { useEffect, useState } from 'react';

const stepIcons: Record<string, string> = {
  detect: '🔍', decide: '🧠', execute: '⚡', simulate: '📊', stabilize: '✅',
};

export default function Timeline({ steps }: { steps: TimelineStep[] }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    const timer = setInterval(() => {
      setVisibleCount(prev => {
        if (prev >= steps.length) { clearInterval(timer); return prev; }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [steps]);

  return (
    <div className="card p-6 bg-white border border-slate-100 shadow-sm">
      <div className="mb-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Orchestration Pipeline</h2>
        <h3 className="text-lg font-black text-slate-900 tracking-tight">Execution Timeline</h3>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          const visible = i < visibleCount;
          const isLast = i === steps.length - 1;
          return (
            <div key={step.step} className="flex items-center">
              <div className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all duration-500 ${
                visible 
                  ? 'bg-emerald-50 border-emerald-200 scale-100 opacity-100' 
                  : 'bg-slate-50 border-slate-100 scale-95 opacity-40'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{stepIcons[step.step] || '📌'}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">{step.label}</span>
                  {visible && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-1" />}
                </div>
                <p className="text-[10px] font-medium text-slate-400 max-w-[200px] truncate">{step.detail}</p>
                {step.duration_ms > 0 && (
                  <p className="text-[9px] font-bold text-slate-300 mt-1">{step.duration_ms}ms</p>
                )}
              </div>
              {!isLast && (
                <ChevronRight className={`w-4 h-4 mx-1 flex-shrink-0 transition-all duration-500 ${visible ? 'text-emerald-400' : 'text-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useZones, useSimulateScenario, executeSimulation, SimulationPayload } from '@/lib/api';
import { useZone } from '@/context/ZoneContext';
import { 
  Play, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  TrendingDown, 
  TrendingUp,
  ShieldCheck,
  ZapOff
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { useTranslation } from '@/hooks/useTranslation';

export default function SimulatePage() {
  const { selectedZone } = useZone();
  const { t } = useTranslation();
  const { data: zones } = useZones();
  
  const [scenario, setScenario] = useState<SimulationPayload['scenario']>('normal_day');
  const [multiplier, setMultiplier] = useState(1.5);
  const [followRecs, setFollowRecs] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setResults(null);
    
    // Artificial delay for realism
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const payload: SimulationPayload = {
        zone_id: selectedZone,
        date: new Date().toISOString().split('T')[0],
        scenario: scenario,
        ev_adoption_multiplier: multiplier,
        follow_recommendations: followRecs
      };
      
      const realResults = await executeSimulation(payload);
      setResults(realResults);
    } catch (error) {
      console.error("Simulation failed", error);
    } finally {
      setIsSimulating(false);
    }
  };

  const scenarios = [
    { id: 'normal_day', label: t('simulate.normalDay'), desc: t('simulate.normalDayDesc') },
    { id: 'holiday_spike', label: t('simulate.holidaySpike'), desc: t('simulate.holidaySpikeDesc') },
    { id: 'peak_ev_surge', label: t('simulate.peakEvSurge'), desc: t('simulate.peakEvSurgeDesc') },
    { id: 'monsoon_dip', label: t('simulate.monsoonDip'), desc: t('simulate.monsoonDipDesc') },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-[var(--color-text-primary)] uppercase italic">{t('simulate.title')}</h1>
        <p className="text-sm text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-1">{t('simulate.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="card p-8 space-y-8">
          <div className="space-y-4">
             <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-accent)]">{t('simulate.parameters')}</h2>
             
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('simulate.selectScenario')}</label>
                <div className="grid grid-cols-1 gap-2">
                   {scenarios.map((s) => (
                     <button
                        key={s.id}
                        onClick={() => setScenario(s.id as any)}
                        className={`text-left p-4 rounded-2xl border transition-all ${
                          scenario === s.id 
                            ? 'bg-white border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' 
                            : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]'
                        }`}
                     >
                        <p className="text-xs font-black uppercase text-[var(--color-text-primary)] mb-1">{s.label}</p>
                        <p className="text-[10px] font-medium text-[var(--color-text-muted)] leading-tight">{s.desc}</p>
                     </button>
                   ))}
                </div>
             </div>

             <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                   <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('simulate.evAdoptionMultiplier')}</label>
                   <span className="text-sm font-black text-[var(--color-accent)]">{multiplier.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="3.0" 
                  step="0.1" 
                  value={multiplier}
                  onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   <span>{t('simulate.conservative')}</span>
                   <span>{t('simulate.aggressive')}</span>
                </div>
             </div>

             <div className="pt-4">
                <label className="flex items-center gap-3 p-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-2xl cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-colors">
                  <input 
                    type="checkbox" 
                    checked={followRecs}
                    onChange={(e) => setFollowRecs(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--color-border-bright)] bg-white text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <div>
                    <p className="text-xs font-black uppercase text-[var(--color-text-primary)]">{t('simulate.followRecommendations')}</p>
                    <p className="text-[10px] font-medium text-[var(--color-text-muted)]">{t('simulate.applyLogic')}</p>
                  </div>
                </label>
             </div>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
          >
            {isSimulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
            {isSimulating ? t('simulate.processingModel') : t('simulate.runSimulation')}
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-8">
          {!results && !isSimulating && (
            <div className="h-full min-h-[400px] border-4 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-center p-12">
               <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                  <Zap className="w-10 h-10 text-slate-200" />
               </div>
               <h3 className="text-xl font-black text-slate-300 uppercase italic tracking-tighter">{t('simulate.awaitingData')}</h3>
               <p className="text-sm text-slate-400 font-medium max-w-xs mt-2">{t('simulate.awaitingDesc')}</p>
            </div>
          )}

          {isSimulating && (
             <div className="h-full min-h-[400px] bg-white rounded-[40px] shadow-sm border border-slate-100 flex flex-col items-center justify-center p-12 space-y-6">
                <div className="relative">
                   <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-[var(--color-accent)] animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-[var(--color-accent)] fill-current animate-pulse" />
                   </div>
                </div>
                <div className="text-center">
                   <p className="text-sm font-black text-slate-900 uppercase tracking-widest">{t('simulate.runningSim')}</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">{t('simulate.synthesizing', { zone: selectedZone })}</p>
                </div>
             </div>
          )}

          {results && (
            <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8">
               {/* Verdict Banner */}
               <div className={`p-8 rounded-[32px] border-2 flex items-center justify-between ${
                 results.optimized.stress_hours === 0 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
                  : 'bg-amber-50 border-amber-100 text-amber-900'
               }`}>
                  <div className="flex items-center gap-6">
                     <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                       results.optimized.stress_hours === 0 ? 'bg-emerald-500 shadow-emerald-200' : 'bg-amber-500 shadow-amber-200'
                     }`}>
                        {results.optimized.stress_hours === 0 ? <ShieldCheck className="w-8 h-8 text-white" /> : <AlertTriangle className="w-8 h-8 text-white" />}
                     </div>
                     <div>
                        <h3 className="text-2xl font-black italic tracking-tight uppercase">
                          {results.optimized.stress_hours === 0 ? t('simulate.gridResilient') : t('simulate.capacityWarning')}
                        </h3>
                        <p className="text-sm font-medium opacity-70">
                          {results.optimized.stress_hours === 0 
                            ? t('simulate.resilientDesc')
                            : t('simulate.warningDesc', { count: results.optimized.stress_hours })}
                        </p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{t('simulate.impactDelta')}</p>
                     <div className="flex items-center gap-2 justify-end">
                        <TrendingDown className="w-5 h-5" />
                        <span className="text-3xl font-black tracking-tighter">-{results.peak_reduction_pct.toFixed(0)}%</span>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Stress Hours Comparison */}
                  <div className="card p-8 bg-slate-900 text-white overflow-hidden relative">
                     <div className="absolute -right-8 -bottom-8 opacity-5">
                        <ZapOff className="w-48 h-48" />
                     </div>
                     <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-8">Grid Stress Comparison</h4>
                     
                     <div className="space-y-8">
                        <div className="space-y-3">
                           <div className="flex justify-between items-end">
                              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Unmanaged</span>
                              <span className="text-2xl font-black tracking-tighter">{results.unmanaged.stress_hours} hrs</span>
                           </div>
                           <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-red-500" style={{ width: '100%' }} />
                           </div>
                        </div>

                        <div className="space-y-3">
                           <div className="flex justify-between items-end">
                              <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Optimized</span>
                              <div className="flex items-center gap-2">
                                 <Badge variant="success" label={`-${results.unmanaged.stress_hours - results.optimized.stress_hours} hrs`} />
                                 <span className="text-2xl font-black tracking-tighter text-emerald-400">{results.optimized.stress_hours} hrs</span>
                              </div>
                           </div>
                           <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 transition-all duration-1000" 
                                style={{ width: `${(results.optimized.stress_hours / results.unmanaged.stress_hours) * 100}%` }} 
                              />
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Recommendations Card */}
                  <div className="card p-8 flex flex-col justify-between">
                     <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Operator Directives</h4>
                        <div className="space-y-4">
                           <div className="flex gap-4">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                 <CheckCircle2 className="w-4 h-4 text-slate-900" />
                              </div>
                              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                                Deploy dynamic price signals during 18:00–22:00 to shift approximately {multiplier * 15}% of demand.
                              </p>
                           </div>
                           <div className="flex gap-4">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                 <CheckCircle2 className="w-4 h-4 text-slate-900" />
                              </div>
                              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                                Reserve {multiplier * 200}kW of secondary transformer capacity for emergency load balancing.
                              </p>
                           </div>
                        </div>
                     </div>
                     <button className="w-full mt-8 py-3 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                        Generate Detailed Report
                     </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useForecastDemand, useForecastExplain, useForecastSummary, useZones } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, BarChart, Bar, Cell, YAxis as BarYAxis, XAxis as BarXAxis, ComposedChart, ReferenceLine } from 'recharts';
import { AlertCircle, Loader2, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';

import { useZone } from '@/context/ZoneContext';

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={`h-3 rounded bg-slate-200/80 animate-pulse ${className || ''}`}
    />
  );
}

function SectionLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
    </div>
  );
}

function ChartSectionLoader({ label }: { label: string }) {
  return (
    <div className="w-full h-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4">
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <div className="w-full mt-4 grid grid-cols-12 gap-2 h-[180px] opacity-20">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="col-span-1 flex items-end">
              <div className="w-full rounded bg-slate-200" style={{ height: `${30 + (i % 5) * 14}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShapSectionLoader({ label }: { label: string }) {
  return (
    <div className="w-full h-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4">
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <div className="w-full mt-5 space-y-3 opacity-20">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="flex-1 h-3 bg-slate-200 rounded" style={{ width: `${60 + (i % 3) * 12}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ZoneGridLoader() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] animate-pulse flex flex-col items-center justify-center gap-2"
        >
          <div className="h-2 w-8 bg-slate-200 rounded" />
          <div className="h-4 w-12 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function ForecastPage() {
  const { selectedZone, setSelectedZone } = useZone();
  const { t } = useTranslation();
  const [showEV, setShowEV] = useState(true);
  const { startTs, endTs, explainTs } = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 7);

    return {
      startTs: start.toISOString(),
      endTs: now.toISOString(),
      explainTs: now.toISOString(),
    };
  }, []);

  const { data: rawZones, isLoading: zonesLoading } = useZones();
  
  // Ensure unique zones by zone_id
  const zones = useMemo(() => {
    if (!rawZones) return [];
    return Array.from(new Map((rawZones as any[]).map(z => [z.zone_id, z])).values());
  }, [rawZones]);

  const { data: zoneSummary, isLoading: zoneSummaryLoading } = useForecastSummary();
  const { data: forecast, isLoading: forecastLoading, error: forecastError, mutate: mutateForecast } = useForecastDemand(selectedZone, startTs, endTs);
  const latestTs = forecast && forecast.length > 0 ? forecast[0].timestamp : explainTs;
  const { data: explainData, isLoading: explainLoading, error: explainError, mutate: mutateExplain } = useForecastExplain(selectedZone, explainTs);

  const handleRetry = () => {
    mutateForecast();
    mutateExplain();
  };

  // Helper to get color based on utilization (copied from dashboard for consistency)
  const getConsumptionColor = (utilization: number) => {
    if (utilization > 0.85) return 'bg-red-500 text-white border-red-600';
    if (utilization > 0.5) return 'bg-amber-400 text-slate-900 border-amber-500';
    return 'bg-emerald-500 text-white border-emerald-600';
  };

  if (forecastError || explainError) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="border border-red-200 bg-red-50  rounded-lg p-6 text-center space-y-4 max-w-md">
          <div className="w-12 h-12 rounded-full bg-red-100  flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-600 " />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-800 ">{t('forecast.failedToLoad')}</h2>
            <p className="text-sm text-red-600  mt-1">{t('forecast.checkConnection')}</p>
          </div>
          <button 
            onClick={handleRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            {t('forecast.retry')}
          </button>
        </div>
      </div>
    );
  }

  const zoneInfo = (zones || []).find(z => z.zone_id === selectedZone);
  const transformerCapacity = typeof zoneInfo?.capacity_kw === 'number' && zoneInfo.capacity_kw > 0
    ? zoneInfo.capacity_kw
    : 5000;

  // Format forecast data for Recharts
  const chartData = forecast?.map(f => {
    const d = new Date(f.timestamp);
    const isPeak = d.getHours() >= 18 && d.getHours() <= 22;
    const predicted = Number.isFinite(f.predicted_kw) ? f.predicted_kw : 0;
    const evSharePct = Number.isFinite(f.ev_share_pct) ? f.ev_share_pct : 0;
    const evLoad = predicted * (evSharePct > 1 ? evSharePct / 100 : evSharePct);

    return {
      time: format(d, 'HH:mm dd/MM'),
      timestamp: f.timestamp,
      predicted,
      evLoad,
      peakLoad: isPeak ? predicted : 0,
      offPeakLoad: isPeak ? 0 : predicted,
      confidence_lo: f.confidence_lo,
      confidence_hi: f.confidence_hi,
      isPeak: isPeak,
    };
  }) || [];

  const zoneLoadMap = new Map(
    (zoneSummary || []).map((zone: any) => [
      zone.zone_id,
      {
        load_kw: Number.isFinite(zone.load_kw) ? zone.load_kw : 0,
        capacity_kw: Number.isFinite(zone.capacity_kw) && zone.capacity_kw > 0 ? zone.capacity_kw : 5000,
      },
    ])
  );

  // Find index bounds for peak highlighting
  const peakStartIndex = chartData.findIndex(d => d.isPeak);
  const peakEndIndex = chartData.findLastIndex(d => d.isPeak);

  // Format SHAP data
  const formatFeatureName = (name: string) => {
    const map: Record<string, string> = {
      is_peak_hour: 'Peak Hour Period',
      day_of_week: 'Day of Week (Cyclical)',
      hour_sin: 'Time of Day (Pattern)',
      hour_cos: 'Time of Day (Phase)',
      temperature: 'Ambient Temperature',
      humidity: 'Relative Humidity',
      is_weekend: 'Weekend Effect',
      zone_id_encoded: 'Zone Characteristics',
      month: 'Seasonal Trend'
    };
    return map[name] || name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const shapData = explainData?.shap_values 
    ? Object.entries(explainData.shap_values).map(([key, value]) => ({
        name: formatFeatureName(key),
        value: value as number,
        originalName: key
      })).sort((a: any, b: any) => Math.abs(b.value) - Math.abs(a.value))
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t('forecast.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('forecast.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer group">
            <input 
              type="checkbox" 
              checked={showEV} 
              onChange={(e) => setShowEV(e.target.checked)} 
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-primary)]"></div>
            <span className="ml-3 text-sm font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-900 transition-colors">
              {t('forecast.showEvLoad')}
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 card p-5 flex flex-col min-h-[400px]">
          <div className="mb-6">
            <h2 className="section-title">{t('forecast.demandForecast48h')}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('forecast.predictedLoadConfidence')}</p>
          </div>
          <div className="flex-1 w-full min-h-[300px]">
            {forecastLoading ? (
              <ChartSectionLoader label={t('forecast.loadingForecast')} />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} dy={10} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}kW`} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: 'var(--color-text-primary)', fontSize: '12px' }}
                    labelStyle={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '4px' }}
                  />
                  
                  {/* Confidence Band */}
                  <Area 
                    type="monotone" 
                    dataKey="confidence_hi" 
                    stroke="none" 
                    fill="var(--color-accent)" 
                    fillOpacity={0.05}
                    isAnimationActive={false} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="confidence_lo" 
                    stroke="none" 
                    fill="var(--color-bg-surface)" 
                    fillOpacity={1}
                    isAnimationActive={false} 
                  />
 
                  {/* Predicted Load */}
                  <Area 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="var(--color-accent)" 
                    fill="url(#colorPredicted)" 
                    strokeWidth={2}
                    isAnimationActive={false}
                  />

                  {/* EV Load (Optional) - Rendered last for maximum visibility */}
                  {showEV && (
                    <Area 
                      type="monotone" 
                      dataKey="evLoad" 
                      stroke="var(--color-chart-purple)" 
                      fill="url(#colorEv)" 
                      strokeWidth={3}
                      fillOpacity={0.5}
                      isAnimationActive={false}
                    />
                  )}
 
                  {/* Highlight Peak Hours */}
                  {peakStartIndex !== -1 && peakEndIndex !== -1 && (
                    <ReferenceArea 
                      x1={chartData[peakStartIndex]?.time} 
                      x2={chartData[peakEndIndex]?.time} 
                      strokeOpacity={0.3} 
                      fill="var(--color-danger)" 
                      fillOpacity={0.05} 
                    />
                  )}
 
                  <defs>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-purple)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-chart-purple)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full skeleton rounded-md" />
            )}
          </div>
        </div>
        {/* SHAP Panel - AI Model Explainability */}
        <div className="card flex flex-col min-h-[400px] border-none shadow-xl overflow-hidden">
          <div className="p-6 bg-slate-900 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t('forecast.modelExplainability')}</h2>
                <h3 className="text-lg font-black text-white tracking-tight">AI Decision Attribution</h3>
              </div>
              <div className="px-3 py-1 bg-white/10 rounded-full border border-white/10">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">XGBoost Explainer</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Baseline Start</p>
                <p className="text-xl font-black text-white italic">{explainData?.base_value?.toFixed(1) || '0.0'}<span className="text-[10px] ml-1 opacity-50">kW</span></p>
              </div>
              <div className="p-3 bg-[var(--color-brand-primary)]/10 rounded-xl border border-[var(--color-brand-primary)]/20">
                <p className="text-[9px] font-black text-[var(--color-brand-primary)] uppercase tracking-widest mb-1">Final Forecast</p>
                <p className="text-xl font-black text-white italic">{explainData?.predicted_kw?.toFixed(1) || '0.0'}<span className="text-[10px] ml-1 opacity-50">kW</span></p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 p-6 bg-white min-h-[300px]">
            <div className="flex items-center justify-between mb-6">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Feature Contributions (kW Impact)</p>
               <div className="flex gap-4">
                 <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-red-500" />
                   <span className="text-[9px] font-black text-slate-500 uppercase">Increases Load</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-blue-500" />
                   <span className="text-[9px] font-black text-slate-500 uppercase">Decreases Load</span>
                 </div>
               </div>
            </div>

            <div className="h-[250px] w-full">
              {explainLoading ? (
                <ShapSectionLoader label={t('forecast.loadingExplainability')} />
              ) : shapData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shapData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={true} vertical={false} />
                    <BarXAxis type="number" hide />
                    <BarYAxis dataKey="name" type="category" stroke="#1E293B" fontSize={10} tickLine={false} axisLine={false} width={120} fontWeight="800" />
                    <Tooltip 
                      cursor={{fill: '#F8FAFC'}}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const isPositive = data.value > 0;
                          return (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xl">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{data.name}</p>
                              <p className={`text-sm font-black ${isPositive ? 'text-red-600' : 'text-blue-600'}`}>
                                {isPositive ? '+' : ''}{data.value.toFixed(2)} kW
                              </p>
                              <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">
                                {isPositive ? 'This factor is pushing demand higher' : 'This factor is pulling demand lower'}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                      {shapData.map((entry: any, index: number) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.value > 0 ? '#EF4444' : '#3B82F6'} 
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full skeleton rounded-md" />
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100">
             <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                   <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Model Insights</p>
                   {explainData?.explanation ? (
                     <p className="text-sm font-bold text-slate-900 leading-relaxed italic">
                       "{explainData.explanation}"
                     </p>
                   ) : (
                     <div className="h-4 w-48 bg-slate-200 animate-pulse rounded" />
                   )}
                </div>
             </div>
          </div>

          <div className="p-4 bg-slate-100/50 flex items-center justify-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Inference Engine Active</p>
          </div>
        </div>
      </div>

      {/* Peak Load Analysis */}
      <div className="card p-5">
        <div className="mb-6">
          <h2 className="section-title">{t('forecast.peakLoadAnalysis')}</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('forecast.capacityThresholdViolations')}</p>
        </div>
        <div className="h-[280px] w-full">
          {forecastLoading ? (
            <ChartSectionLoader label={t('forecast.loadingForecast')} />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} dy={10} />
                <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}k`} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderRadius: '6px' }}
                  itemStyle={{ fontSize: '12px' }}
                  labelStyle={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '4px' }}
                />
                
                <Area type="monotone" dataKey="offPeakLoad" name={t('forecast.offPeak')} fill="var(--color-text-muted)" stroke="var(--color-text-muted)" fillOpacity={0.2} strokeWidth={1} isAnimationActive={false} />
                <Area type="monotone" dataKey="peakLoad" name={t('forecast.peakLoad')} fill="var(--color-danger)" stroke="var(--color-danger)" fillOpacity={0.3} strokeWidth={1} isAnimationActive={false} />
                
                <ReferenceLine 
                  y={transformerCapacity} 
                  stroke="var(--color-warning)" 
                  strokeDasharray="4 4" 
                  label={{ position: 'insideTopLeft', value: t('forecast.transformerCapacityLabel'), fill: 'var(--color-warning)', fontSize: 11, dy: -10 }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full skeleton rounded-md" />
          )}
        </div>
      </div>

      {/* Network Overview Grid (Consumption Based) */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">{t('forecast.networkLoadDistribution')}</h2>
          <div className="flex gap-3 items-center bg-[var(--color-bg-surface)] px-3 py-1 rounded-md border border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('forecast.low')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('forecast.mid')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('forecast.high')}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          {zonesLoading || zoneSummaryLoading ? (
            <ZoneGridLoader />
          ) : (zones || []).map((z: any) => {
            const zoneMetrics = zoneLoadMap.get(z.zone_id);
            const capacityKw = zoneMetrics?.capacity_kw || (Number.isFinite(z.capacity_kw) && z.capacity_kw > 0 ? z.capacity_kw : 5000);
            const loadKw = zoneMetrics?.load_kw || 0;
            const utilization = capacityKw > 0 ? loadKw / capacityKw : 0;
            const isActive = selectedZone === z.zone_id;
            return (
              <div 
                key={`forecast-grid-${z.zone_id}`}
                onClick={() => setSelectedZone(z.zone_id)}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all cursor-pointer hover:scale-105 ${isActive ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 border-transparent' : 'border-transparent'} ${getConsumptionColor(utilization)}`}
              >
                <span className="text-[10px] font-black italic">{z.zone_id}</span>
                <span className="text-xs font-bold">{Number.isFinite(utilization) ? `${(utilization * 100).toFixed(0)}%` : '0%'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

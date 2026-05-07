'use client';

import { useState, useMemo } from 'react';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check, Clock, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { useScheduleComparison, useScheduleOptimize, useZones, useGridSummary, useScheduleHeatmap } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Area, ComposedChart } from 'recharts';
import { useZone } from '@/context/ZoneContext';
import { useTranslation } from '@/hooks/useTranslation';

function SectionLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const formatHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

import { useIsMounted } from '@/hooks/useIsMounted';

export default function SchedulerPage() {
  const { selectedZone } = useZone();
  const { t } = useTranslation();
  const { data: rawZones } = useZones();
  
  // Ensure unique zones by zone_id
  const zones = useMemo(() => {
    if (!rawZones) return [];
    return Array.from(new Map((rawZones as any[]).map(z => [z.zone_id, z])).values());
  }, [rawZones]);

  const { data: summary, isLoading: summaryLoading } = useGridSummary();
  const isMounted = useIsMounted();
  
  // Use latest date from summary if available, otherwise today's date from system (only on client)
  const latestTs = summary?.system_summary?.timestamp || (isMounted ? new Date().toISOString() : '2024-05-04T00:00:00Z');
  const targetDate = latestTs.split('T')[0];

  const zoneInfo = (zones || []).find(z => z.zone_id === selectedZone);
  const capacityLimit = zoneInfo?.capacity_kw || 5000.0;

  const { data: optimizeData, isLoading: optLoading, error: optError, mutate: mutateOpt } = useScheduleOptimize({ 
    zone_id: selectedZone, 
    date: targetDate,
    capacity_limit_kw: capacityLimit,
    user_window_start: 18,
    user_window_end: 22
  });
  const { data: comparisonData, isLoading: compLoading, error: compError, mutate: mutateComp } = useScheduleComparison(selectedZone, targetDate);
  const { data: heatmapData, isLoading: heatmapLoading } = useScheduleHeatmap(targetDate);

  const handleRetry = () => {
    mutateOpt();
    mutateComp();
  };

  if (optError || compError) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="border border-red-200 bg-red-50  rounded-lg p-6 text-center space-y-4 max-w-md">
          <div className="w-12 h-12 rounded-full bg-red-100  flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-600 " />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-800 ">{t('scheduler.failedToLoad')}</h2>
            <p className="text-sm text-red-600  mt-1">{t('scheduler.checkConnection')}</p>
          </div>
          <button 
            onClick={handleRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            {t('scheduler.retry')}
          </button>
        </div>
      </div>
    );
  }

  // recommendations for sidebar
  const deferRecommendations = optimizeData?.filter((r: any) => r.action === 'DEFER') || [];

  const getActionColor = (zone: string, hour: number) => {
    if (heatmapData && heatmapData[zone]) {
      const rec = heatmapData[zone].find((r: any) => r.hour === hour);
      if (rec?.action === 'CHARGE_NOW') return 'bg-success';
      if (rec?.action === 'OPTIMAL_WINDOW') return 'bg-warning';
      if (rec?.action === 'DEFER') return 'bg-danger';
    }
    
    return 'bg-[var(--color-bg-elevated)]';
  };

  const chartData = comparisonData?.unmanaged_curve?.map((u: any, i: number) => {
    const opt = comparisonData.optimized_curve?.[i];
    const unmanaged = u.load_kw;
    const optimized = opt?.load_kw || u.load_kw;
    return {
      hour: formatHourLabel(u.hour),
      unmanaged: unmanaged,
      optimized: optimized,
      // Array for Area fill between two lines
      savingsArea: [optimized, unmanaged],
      isPeak: u.hour >= 18 && u.hour <= 23
    };
  }) || [];

  // Phase 4 fix: use peak_delta_kw directly, peak_reduction_pct is already %
  const peakReduction = comparisonData?.peak_delta_kw || 0;
  const peakReductionPct = comparisonData?.peak_reduction_pct || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t('scheduler.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('scheduler.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] font-medium shadow-sm">
            {t('scheduler.target', { date: targetDate })}
          </div>
          <div className="px-4 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] font-bold shadow-sm uppercase tracking-wider">
            {t('scheduler.zone', { zone: selectedZone })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Comparison Chart */}
          <div className="card p-5 flex flex-col h-[380px]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="section-title">{t('scheduler.loadProfileComparison', { zone: selectedZone })}</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('scheduler.unmanagedVsOptimized')}</p>
              </div>
              {peakReduction > 0 && (
                <div className="px-3 py-1.5 bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-[var(--color-success)] rounded text-xs font-semibold">
                  {t('scheduler.peakReducedBy', { value: peakReduction.toFixed(0), percent: String(peakReductionPct) })}
                </div>
              )}
            </div>
            
            <div className="flex-1 w-full min-h-[250px]">
              {compLoading ? (
                <SectionLoader label={t('scheduler.loadingComparison')} />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                    <XAxis dataKey="hour" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} dy={10} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}k`} dx={-10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      itemStyle={{ color: 'var(--color-text-primary)', fontSize: '12px' }}
                      labelStyle={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '4px' }}
                      formatter={(value: any, name: any) => {
                        if (name === 'savingsArea') return null; // hide array from tooltip
                        return [`${value} kW`, name === 'unmanaged' ? t('scheduler.unmanaged') : t('scheduler.optimized')];
                      }}
                    />
                    
                    {/* Peak highlighting */}
                    <ReferenceArea x1="18:00" x2="23:00" strokeOpacity={0} fill="var(--color-danger)" fillOpacity={0.05} />
                    
                    {/* Highlighted Savings Area */}
                    <Area type="step" dataKey="savingsArea" fill="var(--color-success)" fillOpacity={0.15} stroke="none" isAnimationActive={false} />

                    <Line type="step" dataKey="unmanaged" stroke="var(--color-danger)" strokeDasharray="5 5" strokeWidth={2} dot={false} name={t('scheduler.unmanaged')} isAnimationActive={false} />
                    <Line type="step" dataKey="optimized" stroke="var(--color-accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--color-accent)' }} name={t('scheduler.optimized')} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-surface)] border border-dashed border-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-muted)] text-sm italic">
                  {t('scheduler.noComparisonData', { date: targetDate })}
                </div>
              )}
            </div>
          </div>

          {/* Heatmap */}
          <div className="card p-5">
            <h2 className="section-title mb-6">{t('scheduler.gridNetworkScheduleHeatmap')}</h2>
            
            <div className="flex">
              {/* Y Axis Labels (Zones) */}
              <div className="flex flex-col mt-6 mr-3 gap-1">
                {(zones || []).map((z: any) => (
                  <div key={`heatmap-label-${z.zone_id}`} className="h-6 flex items-center justify-end text-xs text-[var(--color-text-secondary)] font-medium w-8">
                    {z.zone_id}
                  </div>
                ))}
              </div>
              
              {/* Heatmap Grid */}
              <div className="flex-1 overflow-x-auto pb-2">
                <div className="min-w-[960px]">
                  {/* X Axis Labels (Hours) */}
                  <div className="flex mb-2 gap-1">
                    {HOURS.map(h => (
                      <div key={`hour-label-${h}`} className="flex-1 min-w-[36px] text-center text-[10px] text-[var(--color-text-muted)] font-mono">
                        {formatHourLabel(h)}
                      </div>
                    ))}
                  </div>
                  
                  {/* Grid Rows */}
                  <div className="flex flex-col gap-1">
                    {heatmapLoading ? (
                      <SectionLoader label={t('scheduler.loadingHeatmap')} />
                    ) : (zones || []).map((z: any) => (
                      <div key={`heatmap-row-${z.zone_id}`} className="flex gap-1 h-6">
                        {HOURS.map(h => {
                          const actionClass = getActionColor(z.zone_id, h);
                          const rec = heatmapData?.[z.zone_id]?.find((r: any) => r.hour === h);
                          const actionLabel = rec?.action === 'CHARGE_NOW' ? t('scheduler.chargeNow') : 
                                             rec?.action === 'OPTIMAL_WINDOW' ? t('scheduler.optimalWindow') : 
                                             rec?.action === 'DEFER' ? t('scheduler.defer') : 'Unknown';
                          return (
                            <div 
                              key={`cell-${z.zone_id}-${h}`} 
                              className={`flex-1 min-w-[36px] rounded-sm opacity-90 hover:opacity-100 transition-all cursor-pointer hover:scale-[1.15] ${actionClass}`}
                              title={`${z.zone_id} at ${formatHourLabel(h)}\nAction: ${actionLabel}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-6 mt-6 justify-center text-xs text-[var(--color-text-secondary)] font-medium">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[var(--color-success)]" /> {t('scheduler.chargeNow')}</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[var(--color-warning)]" /> {t('scheduler.optimalWindow')}</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[var(--color-danger)]" /> {t('scheduler.defer')}</div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Recommendations */}
        <div className="card overflow-hidden flex flex-col h-[780px]">
          <div className="p-5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
            <h2 className="section-title">{t('scheduler.recommendedInterventions')}</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('scheduler.unmanagedVsOptimized')}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {optLoading ? (
              <SectionLoader label={t('scheduler.loadingComparison')} />
            ) : deferRecommendations.length > 0 ? (
              deferRecommendations.map((rec: any, idx: number) => (
                <div key={idx} className="bg-[var(--color-bg-primary)] border-l-4 border-l-[var(--color-danger)] border border-[var(--color-border-subtle)] rounded-r-lg p-4 shadow-sm hover:border-[var(--color-border-bright)] transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-danger)] uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t('scheduler.defer')}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-bg-elevated)] rounded text-xs text-[var(--color-text-primary)] font-mono font-medium">
                      <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
                      {formatHourLabel(rec.hour_slot)}
                    </div>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                    {rec.reason}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-border-subtle)]">
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Optimization Impact</span>
                    <span className="text-sm font-bold text-[var(--color-danger)] font-mono">
                      -{Math.abs(rec.expected_delta_kw).toFixed(1)} kW Reduction
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)] text-center p-6">
                <div className="w-12 h-12 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center mb-4">
                  <Check className="w-6 h-6 text-[var(--color-success)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('alerts.allClear')}</h3>
                <p className="text-xs mt-1">{t('alerts.noActiveAlerts')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

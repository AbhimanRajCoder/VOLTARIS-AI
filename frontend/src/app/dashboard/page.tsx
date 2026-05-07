'use client';

import { Activity, AlertTriangle, ShieldAlert, Zap, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import KPICard from '@/components/ui/KPICard';
import { useDeflectImpactSummary, useForecastDemand, useGridAlerts, useGridSummary } from '@/lib/api';
import { useLiveLoad } from '@/hooks/useLiveLoad';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import Badge from '@/components/ui/Badge';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-100 rounded-xl ${className || ''}`} />
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

// Data for EV Growth Projection (based on BESCOM 6.7x growth factor)
const evGrowthData = [
  { year: '2024', share: 15, total: 4500 },
  { year: '2025', share: 22, total: 5200 },
  { year: '2026', share: 35, total: 6800 },
  { year: '2027', share: 50, total: 8500 },
  { year: '2028', share: 68, total: 11000 },
  { year: '2029', share: 85, total: 14500 },
  { year: '2030', share: 100, total: 18000 },
];

import { format } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const { data: summary, error: summaryError, isLoading: summaryLoading } = useGridSummary();
  const { data: alerts, error: alertsError, isLoading: alertsLoading } = useGridAlerts();
  const { data: deflectImpact, isLoading: deflectLoading } = useDeflectImpactSummary(60_000);
  
  // briefing API gives system_summary and zone_briefings
  const systemSummary = (summary as any)?.system_summary;
  const rawZoneBriefings = ((summary as any)?.zone_briefings || []) as any[];
  
  // Ensure unique zones by zone_id
  const zoneBriefings = Array.from(new Map(rawZoneBriefings.map((z) => [z.zone_id, z])).values());
  
  const alertsSummary = (summary as any)?.alerts_summary;

  // Use first zone from briefings or default to Z01
  const activeZone = zoneBriefings[0]?.zone_id || 'Z01';
  const { data: forecast, error: forecastError, isLoading: forecastLoading } = useForecastDemand(activeZone);
  const { data: liveData, connected } = useLiveLoad(activeZone); 

  if (summaryError || alertsError || forecastError) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-[var(--color-danger)]" />
          </div>
          <h2 className="text-lg font-semibold">{t('dashboard.failedToLoad')}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{t('dashboard.checkConnection')}</p>
        </div>
      </div>
    );
  }

  const currentForecast = forecast?.[0]; 
  const unresolvedAlerts = alerts?.filter(a => !a.resolved) || [];
  const criticalAlerts = unresolvedAlerts.filter(a => a.severity === 'CRITICAL');

  // Prepare chart data
  const chartData = forecast?.slice(0, 24).reverse().map(f => ({
    time: format(new Date(f.timestamp), 'HH:mm'),
    totalLoad: f.predicted_kw,
    evLoad: f.predicted_kw * (f.ev_share_pct > 1 ? f.ev_share_pct / 100 : f.ev_share_pct)
  })) || [];

  // Prepare Zone Distribution data from API summary
  const zoneDistribution = zoneBriefings.map((z: any) => {
    const util = z.load_kw / z.capacity_kw;
    return {
      zone: z.zone_id,
      load: Math.round(z.load_kw),
      capacity: z.capacity_kw,
      utilization: util,
      ev_share_pct: z.ev_share_pct,
      status: z.status.toLowerCase()
    };
  });

  // Prepare Peak Load Analysis data
  const peakLoadAnalysis = zoneBriefings.map((z: any) => ({
    zone: z.zone_id,
    peak_load: Math.round(z.peak_load_kw || z.load_kw), // Fixed to use actual peak
    current_load: Math.round(z.load_kw),
    capacity: z.capacity_kw
  })).sort((a: any, b: any) => b.peak_load - a.peak_load).slice(0, 5);

  // Prepare Action Center data
  const topActions = (summary as any)?.top_actions || [];

  // Helper to get color based on utilization
  const getConsumptionColor = (utilization: number) => {
    if (utilization > 0.85) return 'bg-red-500 text-white border-red-600';
    if (utilization > 0.5) return 'bg-amber-400 text-slate-900 border-amber-500';
    return 'bg-emerald-500 text-white border-emerald-600';
  };

  const bannerColor = systemSummary?.overall_status === 'CRITICAL' ? 'bg-red-600' : systemSummary?.overall_status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-600';

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 bg-[var(--color-bg-primary)]">
      {summaryLoading ? (
        <div className="h-16 w-full animate-pulse bg-slate-100 rounded-2xl" />
      ) : systemSummary && (
        <div className={`${bannerColor} p-4 rounded-2xl text-white flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-4 duration-500`}>
          <div className="flex items-center gap-4">
            <ShieldAlert className="w-6 h-6" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest opacity-80">{t('dashboard.systemStatus')}: {systemSummary.overall_status}</p>
              <p className="text-sm font-bold">{t('dashboard.peakAt', { hour: systemSummary.peak_hour })}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('severity.critical')}</p>
              <p className="text-lg font-black">{alertsSummary?.critical || 0}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('dashboard.warning')}</p>
              <p className="text-lg font-black">{alertsSummary?.warning || 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-[var(--color-text-primary)] uppercase italic">{t('dashboard.title')}</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-[var(--color-border-subtle)] shadow-sm">
          <div className="px-4 py-2 bg-slate-900 rounded-xl">
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('dashboard.networkMode')}</p>
             <p className="text-xs text-white font-black uppercase">{t('dashboard.productionAlpha')}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
        {summaryLoading || alertsLoading || forecastLoading || deflectLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 w-full animate-pulse bg-slate-100 rounded-2xl" />
          ))
        ) : (
          <>
            <KPICard 
              title={t('dashboard.currentGridLoad')} 
              value={liveData?.current_load_kw?.toFixed(0) || currentForecast?.predicted_kw?.toFixed(0) || '...'}
              unit="kW"
              trend="up"
              subtitle={t('dashboard.realTimeDemand')}
              icon={Activity}
            />
            <KPICard 
              title={t('dashboard.evDemandShare')} 
              value={(() => {
                const val = liveData?.ev_share_pct ?? currentForecast?.ev_share_pct;
                if (val === undefined || val === null) return '...';
                return (val > 1 ? val : val * 100).toFixed(1);
              })()}
              unit="%"
              trend="neutral"
              subtitle={t('dashboard.aggregatedShare')}
              icon={Zap}
            />
            <KPICard 
              title={t('dashboard.vulnerableZones')} 
              value={new Set(unresolvedAlerts.map(a => a.zone_id)).size || 0} 
              trend="down"
              subtitle={t('dashboard.above85Load')}
              icon={AlertTriangle}
              accentColor="#F59E0B"
            />
            <KPICard 
              title={t('dashboard.systemHealth')} 
              value={criticalAlerts.length > 0 ? t('dashboard.warning') : t('dashboard.optimal')}
              unit=""
              trend={criticalAlerts.length > 0 ? "up" : "neutral"}
              subtitle={t('dashboard.criticalEvents')}
              icon={ShieldAlert}
              accentColor={criticalAlerts.length > 0 ? "#EF4444" : "#10B981"}
            />
            <KPICard
              title="Load Deflected Today"
              value={String(deflectImpact?.total_deflected_kw_today ?? 0)}
              unit="kW"
              trend="neutral"
              subtitle={`Across ${deflectImpact?.events_fired_today ?? 0} deflection events`}
              icon={Zap}
              accentColor="#3B82F6"
            />
            <KPICard
              title="Blackouts Prevented"
              value={String(deflectImpact?.blackouts_prevented ?? 0)}
              unit=""
              trend="down"
              subtitle="Transformer stress events avoided today"
              icon={ShieldCheck}
              accentColor="#10B981"
            />
          </>
        )}
      </div>

      {/* Consumption Heat Grid */}
      <div className="card p-6 bg-white border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t('dashboard.spatialDistribution')}</h2>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('dashboard.zoneConsumptionGrid')}</h3>
          </div>
          <div className="flex gap-4 items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{t('dashboard.low')}</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{t('dashboard.mid')}</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{t('dashboard.high')}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          {summaryLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={`heat-skeleton-${i}`} className="h-24 w-full animate-pulse bg-slate-100 rounded-xl" />
            ))
          ) : zoneBriefings.map((z: any) => {
            const utilization = z.load_kw / z.capacity_kw;
            return (
              <div 
                key={`heat-${z.zone_id}`}
                onClick={() => router.push(`/forecast?zone=${z.zone_id}`)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 hover:shadow-lg flex flex-col items-center justify-center gap-2 group ${getConsumptionColor(utilization)}`}
              >
                <span className="text-[10px] font-black opacity-70 group-hover:opacity-100 transition-opacity">{t('dashboard.zone')}</span>
                <span className="text-xl font-black italic tracking-tighter">{z.zone_id}</span>
                <div className="w-full h-1 bg-black/10 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-white/40" style={{ width: `${Math.min(100, utilization * 100)}%` }} />
                </div>
                <span className="text-[10px] font-bold mt-1">{(utilization * 100).toFixed(0)}% {t('dashboard.load')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Live Chart (Span 2) */}
        <div className="lg:col-span-2 card p-8 group">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{t('dashboard.demandAnalytics')}</h2>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('dashboard.activeLoadProfile')}</h3>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-900" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{t('dashboard.total')}</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[var(--color-brand-primary)]" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{t('dashboard.evLoadLabel')}</span>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className={`w-2 h-2 rounded-full ${connected ? (liveData?.status === 'CRITICAL' ? 'bg-red-500' : liveData?.status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-red-500'} ${connected ? 'animate-pulse' : ''}`} />
                  <span className={`text-[10px] font-black tracking-widest uppercase ${connected ? (liveData?.status === 'CRITICAL' ? 'text-red-600' : liveData?.status === 'WARNING' ? 'text-amber-600' : 'text-emerald-600') : 'text-red-600'}`}>
                    {connected ? (liveData?.status || t('dashboard.liveTelemetry')) : t('dashboard.disconnected')}
                  </span>
               </div>
            </div>
          </div>
          
          <div className="h-[320px] w-full">
            {forecastLoading ? (
              <SectionLoader label={t('dashboard.loadingDemandAnalytics')} />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F172A" stopOpacity={0.05}/>
                      <stop offset="95%" stopColor="#0F172A" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-brand-primary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--color-brand-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} dy={15} fontWeight="bold" />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}kW`} dx={-10} fontWeight="bold" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}
                    labelStyle={{ fontSize: '10px', color: '#94A3B8', fontWeight: 'bold', marginBottom: '8px' }}
                  />
                  <Area type="monotone" dataKey="totalLoad" stroke="#0F172A" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="evLoad" stroke="var(--color-brand-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorEV)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full skeleton rounded-3xl" />
            )}
          </div>
        </div>

        {/* Peak Analysis */}
        <div className="card p-8 bg-slate-900 border-none shadow-2xl">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{t('dashboard.operationalLimits')}</h2>
          <h3 className="text-xl font-black text-white tracking-tight mb-10">{t('dashboard.peakLoadAnalysis')}</h3>
          <div className="space-y-8">
            {summaryLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={`peak-skeleton-${i}`} className="space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 animate-pulse bg-slate-800 rounded" />
                    <div className="h-4 w-16 animate-pulse bg-slate-800 rounded" />
                  </div>
                  <div className="h-2 w-full animate-pulse bg-slate-800 rounded-full" />
                </div>
              ))
            ) : peakLoadAnalysis.map((p: any, i: number) => (
              <div key={`peak-${p.zone}`} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 w-6">0{i+1}</span>
                    <span className="text-sm font-black text-white uppercase tracking-tight">{p.zone}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{p.peak_load} / {p.capacity} kW</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-1000 ${p.peak_load / p.capacity > 0.9 ? 'bg-red-500' : 'bg-[var(--color-brand-primary)]'}`}
                    style={{ width: `${(p.peak_load / p.capacity) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 p-5 bg-white/5 rounded-2xl border border-white/5">
             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">{t('dashboard.safetyThreshold')}</p>
             <div className="flex items-center justify-between">
                <p className="text-sm text-white font-black italic">{t('dashboard.nominalCapacity', { percent: '85.0' })}</p>
                <Badge variant="warning" label={t('dashboard.autoLimit')} />
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* EV Growth Projection */}
        <div className="card p-8">
          <div className="mb-10">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{t('dashboard.futureReadiness')}</h2>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('dashboard.demandGrowthProjection')}</h3>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-brand-primary)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--color-brand-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="year" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} dy={15} fontWeight="bold" />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} fontWeight="bold" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => [name === 'share' ? `${value}%` : value, name === 'share' ? 'EV PENETRATION' : 'UNIT COUNT']}
                />
                <Area type="monotone" dataKey="share" stroke="var(--color-brand-primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorGrowth)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card overflow-hidden flex flex-col border-none shadow-xl">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t('dashboard.actionCenter')}</h2>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('dashboard.pendingInterventions')}</h3>
            </div>
            <button 
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
              onClick={() => router.push('/scheduler')}
            >
              {t('dashboard.scheduler')}
            </button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto flex-1 max-h-[400px]">
            {summaryLoading ? (
              <SectionLoader label={t('dashboard.loadingInterventions')} />
            ) : topActions.length > 0 ? topActions.map((action: any, i: number) => {
              const zoneInfo = zoneBriefings.find((z: any) => z.zone_id === action.zone_id);
              const utilization = zoneInfo ? zoneInfo.load_kw / zoneInfo.capacity_kw : 0;
              return (
                <div key={`action-${action.zone_id}-${i}`} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs italic shadow-sm transition-colors ${getConsumptionColor(utilization)}`}>
                    {action.zone_id}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-tight text-slate-900">{action.action_type.replace('_', ' ')}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{action.reason}</p>
                  </div>
                  <Badge variant={action.action_type === 'DEFER' ? 'critical' : 'warning'} label={t('dashboard.pending')} />
                </div>
              );
            }) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <Activity className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('dashboard.noPendingActions')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Zone Status Table */}
        <div className="card overflow-hidden flex flex-col border-none shadow-xl">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t('dashboard.gridDistribution')}</h2>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{t('dashboard.zoneOperationalMatrix')}</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2 items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-[9px] font-black text-slate-500">{t('dashboard.low')}</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-100 pl-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                  <span className="text-[9px] font-black text-slate-500">{t('dashboard.mid')}</span>
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-100 pl-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                  <span className="text-[9px] font-black text-slate-500">{t('dashboard.high')}</span>
                </div>
              </div>
              <button 
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
                onClick={() => router.push('/forecast')}
              >
                {t('dashboard.fullAnalysis')}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 uppercase bg-white tracking-[0.15em]">
                <tr>
                  <th className="px-8 py-4 font-black">{t('dashboard.zoneId')}</th>
                  <th className="px-8 py-4 font-black">{t('dashboard.realTimeLoad')}</th>
                  <th className="px-8 py-4 font-black">{t('dashboard.evConcentration')}</th>
                  <th className="px-8 py-4 font-black text-right">{t('dashboard.operationalStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`matrix-skeleton-${i}`}>
                      <td className="px-8 py-5"><div className="h-8 w-32 animate-pulse bg-slate-100 rounded-lg" /></td>
                      <td className="px-8 py-5"><div className="h-6 w-24 animate-pulse bg-slate-100 rounded-lg" /></td>
                      <td className="px-8 py-5"><div className="h-6 w-32 animate-pulse bg-slate-100 rounded-lg" /></td>
                      <td className="px-8 py-5"><div className="h-6 w-20 animate-pulse bg-slate-100 rounded-lg ml-auto" /></td>
                    </tr>
                  ))
                ) : zoneDistribution.slice(0, 6).map((z: any) => {
                  return (
                    <tr 
                      key={`matrix-${z.zone}`} 
                      onClick={() => router.push(`/forecast?zone=${z.zone}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-black text-[10px] italic shadow-sm ${getConsumptionColor(z.utilization)}`}>
                            {z.zone}
                          </div>
                          <span className="font-black text-slate-900 tracking-tight uppercase">{z.zone}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 font-bold text-slate-600 tabular-nums">{z.load.toLocaleString()} kW</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                           <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[60px] overflow-hidden">
                              <div className="h-full bg-slate-900" style={{ width: `${z.ev_share_pct}%` }} />
                           </div>
                           <span className="font-bold text-slate-500 text-[11px]">{z.ev_share_pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          z.status === 'critical' ? 'bg-red-50 text-red-600' : 
                          z.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                             z.status === 'critical' ? 'bg-red-500' : 
                             z.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} />
                          {z.status}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

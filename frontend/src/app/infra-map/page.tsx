'use client';

import { useState } from 'react';
import { useDeflectRouting, useInfraHotspots, useInfraRecommend, useInfraZones, useGridSummary } from '@/lib/api';
import dynamic from 'next/dynamic';
import { InfraSiteCandidate } from '@/lib/types';
import { ArrowLeft, Download, Layers, MapPin, Zap, Navigation2, Activity, AlertCircle, Loader2, TrendingUp, BatteryCharging, Map as MapIcon } from 'lucide-react';
import ScoreBar from '@/components/ui/ScoreBar';
import { useTranslation } from '@/hooks/useTranslation';
import Link from 'next/link';

const GridMap = dynamic(() => import('@/components/map/GridMap'), { ssr: false });

function SectionLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
    </div>
  );
}

export default function InfraMapPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'planning' | 'demand'>('planning');
  const [clusterCount, setClusterCount] = useState(5);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSites, setShowSites] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [showGridTrafficLayer, setShowGridTrafficLayer] = useState(true);

  const [selectedSite, setSelectedSite] = useState<InfraSiteCandidate | null>(null);
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  const { data: hotspots, error: hotspotsError, isLoading: hotspotsLoading } = useInfraHotspots(clusterCount);
  const { data: candidatesData, error: candidatesError, isLoading: candidatesLoading } = useInfraRecommend(50, 0.0);
  const { data: zonesData, isLoading: zonesLoading } = useInfraZones();
  const { data: summary, isLoading: summaryLoading } = useGridSummary();
  const { data: deflectRouting } = useDeflectRouting();

  const zoneBriefings = (summary as any)?.zone_briefings || [];
  const zoneDemandData = zoneBriefings.reduce((acc: any, z: any) => {
    acc[z.zone_id] = z.load_kw;
    return acc;
  }, {});
  const zoneCapacity = zoneBriefings.reduce((acc: any, z: any) => {
    acc[z.zone_id] = z.capacity_kw;
    return acc;
  }, {});

  if (hotspotsError || candidatesError) {
    return (
      <div className="p-6 h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center space-y-3 bg-[var(--color-bg-surface)] p-8 rounded-lg border border-[var(--color-border-subtle)] shadow-sm max-w-md">
          <div className="w-12 h-12 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-[var(--color-danger)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('infraMap.failedToLoad')}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{t('infraMap.checkConnection')}</p>
        </div>

        <div className="bg-[var(--color-bg-surface)]/95 backdrop-blur-sm border border-[var(--color-border-subtle)] rounded-lg shadow-xl p-3 pointer-events-auto flex flex-col gap-2 w-48">
          <div className="px-1 py-1 border-b border-[var(--color-border-subtle)] mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-secondary)]">
            <Activity className="w-3 h-3" />
            {t('infraMap.demandDensity')}
          </div>
          <div className="flex flex-col gap-2 px-1">
            <div className="h-2 w-full rounded-full bg-gradient-to-r from-slate-200 via-slate-400 to-slate-800 shadow-inner" />
            <div className="flex justify-between text-[8px] font-bold text-[var(--color-text-muted)] uppercase">
              <span>{t('infraMap.low')}</span>
              <span>{t('infraMap.medium')}</span>
              <span>{t('infraMap.peak')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const candidates = candidatesData || [];
  const displayCandidates = candidates;
  const topScore = candidates.length > 0 ? Math.max(...candidates.map(c => c.composite_score)) : 0;

  // Helper for zone colors to match map markers
  const getZoneColor = (ward: string) => {
    const zoneColors: Record<string, string> = {
      'Indiranagar': '#3b82f6',
      'Koramangala': '#8b5cf6',
      'Whitefield': '#10b981',
      'HSR Layout': '#f59e0b',
      'Jayanagar': '#ef4444',
      'Malleshwaram': '#ec4899',
      'Electronic City': '#06b6d4',
      'Banashankari': '#84cc16',
      'Rajajinagar': '#f97316',
      'BTM Layout': '#6366f1',
      'Hebbal': '#14b8a6',
      'Yelahanka': '#f43f5e',
      'Yeshwanthpur': '#8b5cf6',
      'Basavanagudi': '#f97316',
    };
    if (zoneColors[ward]) return zoneColors[ward];
    let hash = 0;
    for (let i = 0; i < ward.length; i++) hash = ward.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8,site_id,ward,score\n" + 
      (selectedSite ? `${selectedSite.site_id},${selectedSite.ward_name},${selectedSite.composite_score}` : "");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "site_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-full h-[calc(100vh-56px)] overflow-hidden bg-[var(--color-bg-primary)] flex flex-col selection:bg-[#ef4444]/30">
      <style jsx global>{`
        .leaflet-container { outline: none !important; }
        .selection-red::selection { background: #ef444433; }
      `}</style>
      
      {/* ─── Upper Tab Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 h-14 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] shrink-0 z-20">
        <div className="flex items-center gap-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">
            <MapIcon className="w-3.5 h-3.5" />
            Infrastructure Map
          </div>
          <Link
            href="/infra-map/planner"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-all"
          >
            <BatteryCharging className="w-3.5 h-3.5" />
            EV Charging
          </Link>
        </div>

        {/* Right side info chips (Mirroring the planner's aesthetic) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-subtle)]">
            <Activity className="w-3.5 h-3.5 text-[#ef4444]" />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">{displayCandidates.length} Active Hotspots</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-success)]/10 rounded-lg border border-[var(--color-success)]/20">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
            <span className="text-xs font-bold text-[var(--color-success)]">System Optimal</span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
      
      {/* Mapbox Layer */}
      <GridMap 
        candidates={displayCandidates}
        clusters={hotspots} // hotspots IS the FeatureCollection
        zones={zonesData}
        kdeGrid={hotspots?.kde_grid}
        showHeatmap={showHeatmap}
        showSites={showSites}
        showClusters={showClusters}
        onSiteSelect={setSelectedSite}
        selectedSite={selectedSite}
        onClusterSelect={setSelectedClusterId}
        hoveredSiteId={hoveredSiteId}
        mode={mode}
        zoneDemandData={zoneDemandData}
        zoneCapacity={zoneCapacity}
        gridTrafficLayer={deflectRouting?.deflect_layer}
        showGridTrafficLayer={showGridTrafficLayer}
      />

      {/* Mode Toggle Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex p-1 bg-[#111] rounded-xl border border-white/10 shadow-2xl backdrop-blur-md">
        <button
          onClick={() => setMode('planning')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
            mode === 'planning' 
              ? 'bg-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
              : 'text-slate-500 hover:text-white'
          }`}
        >
          {t('infraMap.planningView')}
        </button>
        <button
          onClick={() => setMode('demand')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
            mode === 'demand' 
              ? 'bg-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
              : 'text-slate-500 hover:text-white'
          }`}
        >
          {t('infraMap.demandView')}
        </button>
      </div>

      {/* Floating Panel: Site Rankings (Left) */}
      <div className="absolute left-4 top-4 w-full max-w-[320px] max-h-[calc(100vh-80px)] flex flex-col pointer-events-none z-10 hidden sm:flex">
        <div className="bg-[var(--color-bg-surface)]/95 backdrop-blur-sm border border-[var(--color-border-subtle)] rounded-lg shadow-xl flex flex-col max-h-full pointer-events-auto overflow-hidden transition-all duration-300">
          
          {!selectedSite ? (
            <>
              {/* List View */}
              <div className="p-4 border-b border-[var(--color-border-subtle)] flex justify-between items-center shrink-0">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">{t('infraMap.topCandidates')}</h2>
                <span className="px-2 py-0.5 bg-[var(--color-accent-dim)] text-[var(--color-accent)] rounded text-[10px] font-bold">
                  {displayCandidates.length}
                </span>
              </div>
              
              <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
                {candidatesLoading ? (
                  <SectionLoader label={t('infraMap.loadingCandidates')} />
                ) : displayCandidates.slice(0, 50).map((site, idx) => (
                  <div 
                    key={`site-${site.site_id}`}
                    className="flex items-center p-3 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-bright)] hover:shadow-md transition-all cursor-pointer group"
                    onMouseEnter={() => setHoveredSiteId(site.site_id)}
                    onMouseLeave={() => setHoveredSiteId(null)}
                    onClick={() => setSelectedSite(site)}
                  >
                    <div className="w-7 text-sm font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                      {idx + 1}.
                    </div>
                    <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: getZoneColor(site.ward_name) }} />
                    <div className="flex-1 min-w-0 px-2">
                      <div className="font-semibold text-xs text-[var(--color-text-primary)] truncate">{site.ward_name}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">{site.site_id}</div>
                      
                      {/* Mini Sparklines */}
                      <div className="flex gap-0.5 mt-1.5 h-1">
                        <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--color-accent)]" style={{ width: `${site.demand_score * 100}%` }} />
                        </div>
                        <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--color-chart-purple)]" style={{ width: `${site.gap_score * 100}%` }} />
                        </div>
                        <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--color-warning)]" style={{ width: `${site.transformer_score * 100}%` }} />
                        </div>
                        <div className="flex-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--color-success)]" style={{ width: `${site.access_score * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-mono font-semibold text-[var(--color-accent)]">
                      {(site.composite_score * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Detail View */}
              <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => setSelectedSite(null)}
                  className="p-1.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-bright)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Rank #{selectedSite.composite_rank}</div>
                  <h2 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{selectedSite.ward_name}</h2>
                </div>
                <div className="text-lg font-mono font-bold text-[var(--color-accent)]">
                  {(selectedSite.composite_score * 100).toFixed(0)}%
                </div>
              </div>

              <div className="p-5 flex-1 overflow-y-auto">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">{t('infraMap.scoreBreakdown')}</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                    <ScoreBar label={t('infraMap.demandScore')} score={selectedSite.demand_score} color="var(--color-accent)" />
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-[var(--color-chart-purple)] shrink-0" />
                    <ScoreBar label={t('infraMap.coverageGap')} score={selectedSite.gap_score} color="var(--color-chart-purple)" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
                    <ScoreBar label={t('infraMap.transformerCap')} score={selectedSite.transformer_score} color="var(--color-warning)" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Navigation2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
                    <ScoreBar label={t('infraMap.roadAccess')} score={selectedSite.access_score} color="var(--color-success)" />
                  </div>
                </div>

                <div className="mt-8 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">{t('infraMap.siteMetadata')}</h3>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
                    <span className="text-xs text-[var(--color-text-secondary)]">{t('infraMap.nearestTransformer')}</span>
                    <span className="text-xs font-mono font-medium text-[var(--color-text-primary)]">{selectedSite.nearest_transformer_id}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
                    <span className="text-xs text-[var(--color-text-secondary)]">{t('infraMap.existingChargers')}</span>
                    <span className="text-xs font-mono font-medium text-[var(--color-text-primary)]">{selectedSite.existing_chargers_500m}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
                    <span className="text-xs text-[var(--color-text-secondary)]">{t('infraMap.siteId')}</span>
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{selectedSite.site_id}</span>
                  </div>
                </div>

                <button 
                  onClick={handleExport}
                  className="w-full mt-8 py-2 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  {t('infraMap.exportSiteReport')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Panel: Map Controls (Top Right) */}
      <div className="absolute right-4 top-4 flex flex-col gap-2 pointer-events-none z-10 hidden sm:flex">
        <div className="bg-[var(--color-bg-surface)]/95 backdrop-blur-sm border border-[var(--color-border-subtle)] rounded-lg shadow-xl p-2 pointer-events-auto flex flex-col gap-1 w-48">
          <div className="px-3 py-2 border-b border-[var(--color-border-subtle)] mb-1 flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-[var(--color-text-secondary)]">
            <Layers className="w-3.5 h-3.5" />
            {t('infraMap.mapLayers')}
          </div>
          
          <label className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-elevated)] rounded-md cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              checked={showHeatmap} 
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="rounded border-[var(--color-border-bright)] bg-[var(--color-bg-primary)] text-[#ef4444] focus:ring-[#ef4444]"
            />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">{t('infraMap.demandDensity')}</span>
          </label>
          
          <label className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-elevated)] rounded-md cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              checked={showSites} 
              onChange={(e) => setShowSites(e.target.checked)}
              className="rounded border-[var(--color-border-bright)] bg-[var(--color-bg-primary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">{t('infraMap.allSites')}</span>
          </label>

          <label className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-elevated)] rounded-md cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              checked={showClusters} 
              onChange={(e) => setShowClusters(e.target.checked)}
              className="rounded border-[var(--color-border-bright)] bg-[var(--color-bg-primary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">{t('infraMap.topClusters')}</span>
          </label>
          <label className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-elevated)] rounded-md cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={showGridTrafficLayer}
              onChange={(e) => setShowGridTrafficLayer(e.target.checked)}
              className="rounded border-[var(--color-border-bright)] bg-[var(--color-bg-primary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <span className="text-xs font-medium text-[var(--color-text-primary)]">Grid Traffic Layer</span>
          </label>
        </div>

        <div className="bg-[var(--color-bg-surface)]/95 backdrop-blur-sm border border-[var(--color-border-subtle)] rounded-lg shadow-xl p-3 pointer-events-auto flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('infraMap.clusters')}</span>
          <div className="flex gap-1">
            {[3, 5, 7, 10].map(n => (
              <button
                key={n}
                onClick={() => setClusterCount(n)}
                className={`w-7 h-6 rounded text-[10px] font-mono font-semibold transition-colors ${
                  clusterCount === n 
                    ? 'bg-[var(--color-accent)] text-white shadow-sm' 
                    : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-bg-surface)]/95 backdrop-blur-sm border border-[var(--color-border-subtle)] rounded-lg shadow-xl p-3 pointer-events-auto flex flex-col gap-2 w-48">
          <div className="px-1 py-1 border-b border-[var(--color-border-subtle)] mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-secondary)]">
            <Activity className="w-3 h-3" />
            Demand Density
          </div>
          <div className="flex flex-col gap-2 px-1">
            <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#fef3c7] via-[#f59e0b] to-[#dc2626] shadow-inner" />
            <div className="flex justify-between text-[8px] font-bold text-[var(--color-text-muted)] uppercase">
              <span>Low</span>
              <span>Medium</span>
              <span>Peak</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mini Stats Bar (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10 hidden sm:block">
        <div className="bg-[var(--color-bg-surface)]/95 backdrop-blur-md border border-[var(--color-border-subtle)] rounded-full px-6 py-2 shadow-lg pointer-events-auto flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('infraMap.analyzed')}:</span>
            <span className="text-sm text-[var(--color-text-primary)] font-semibold font-mono">{candidates.length} {t('infraMap.sites')}</span>
          </div>
          <div className="w-px h-3 bg-[var(--color-border-bright)]" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('infraMap.clusters')}:</span>
            <span className="text-sm text-[var(--color-text-primary)] font-semibold font-mono">{clusterCount}</span>
          </div>
          <div className="w-px h-3 bg-[var(--color-border-bright)]" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('infraMap.topScore')}:</span>
            <span className="text-sm text-[var(--color-accent)] font-semibold font-mono">{topScore.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}

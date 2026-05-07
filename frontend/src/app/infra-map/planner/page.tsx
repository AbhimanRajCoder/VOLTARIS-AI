'use client';

import { useState, useMemo } from 'react';
import { useInfraRecommend, useInfraZones, useGridSummary } from '@/lib/api';
import { InfraSiteCandidate } from '@/lib/types';
import { 
  ArrowLeft, Download, Zap, MapPin, Activity, Navigation2, 
  Loader2, TrendingUp, ChevronRight, AlertCircle, BatteryCharging, Map as MapIcon
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PlannerMap = dynamic(() => import('./PlannerMap'), { ssr: false });

/* ─── Loaders ──────────────────────────────────────────────────────── */
function SectionLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <Loader2 className="w-8 h-8 text-[var(--color-brand-primary)] animate-spin" />
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
    </div>
  );
}

/* ─── Score Bar ────────────────────────────────────────────────────── */
function PlannerScoreBar({ label, score, color, icon: Icon }: { 
  label: string; score: number; color: string; icon: React.ElementType 
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</span>
        </div>
        <span className="text-xs font-black font-mono" style={{ color }}>{(score * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ─── Ward Card ───────────────────────────────────────────────────── */
function WardCard({ site, rank, isSelected, onClick }: { 
  site: InfraSiteCandidate; rank: number; isSelected: boolean; onClick: () => void 
}) {
  const score = site.composite_score;
  const scoreColor = score >= 0.7 ? 'var(--color-success)' : score >= 0.5 ? 'var(--color-warning)' : 'var(--color-text-muted)';

  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 group ${
        isSelected 
          ? 'bg-[var(--color-brand-primary)]/5 border-[var(--color-brand-primary)]/30 ring-1 ring-[var(--color-brand-primary)]/20 shadow-md' 
          : 'bg-[var(--color-bg-primary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-bright)] hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Rank Badge */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black ${
          rank <= 3 ? 'bg-[var(--color-brand-primary)] text-white shadow-lg shadow-blue-500/20' : 
          rank <= 10 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
        }`}>
          {rank}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{site.ward_name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Zap className="w-3 h-3 text-[var(--color-warning)]" />
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] truncate">
              EV Charging Site · {site.existing_chargers_500m} nearby
            </p>
          </div>
        </div>

        {/* Score */}
        <div className="text-right shrink-0">
          <span className="text-lg font-black font-mono" style={{ color: scoreColor }}>
            {(score * 100).toFixed(0)}
          </span>
          <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)] tracking-tight">Score</p>
        </div>
      </div>

      {/* Mini Score Bars */}
      <div className="grid grid-cols-4 gap-1 mt-3">
        {[
          { score: site.demand_score, color: 'var(--color-accent)' },
          { score: site.gap_score, color: 'var(--color-chart-purple)' },
          { score: site.transformer_score, color: 'var(--color-warning)' },
          { score: site.access_score, color: 'var(--color-success)' },
        ].map((bar, i) => (
          <div key={i} className="h-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${bar.score * 100}%`, backgroundColor: bar.color }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────── */
export default function InfraPlannerPage() {
  const { data: candidatesData, isLoading: candidatesLoading, error: candidatesError } = useInfraRecommend(50, 0.0);
  const { data: zonesData } = useInfraZones();
  const { data: summary } = useGridSummary();

  const [selectedSite, setSelectedSite] = useState<InfraSiteCandidate | null>(null);

  const candidates = candidatesData || [];

  // Group by ward and pick the best site per ward
  const wardRanking = useMemo(() => {
    if (!candidates.length) return [];
    const wardMap = new Map<string, InfraSiteCandidate>();
    candidates.forEach(c => {
      const existing = wardMap.get(c.ward_name);
      if (!existing || c.composite_score > existing.composite_score) {
        wardMap.set(c.ward_name, c);
      }
    });
    return Array.from(wardMap.values()).sort((a, b) => b.composite_score - a.composite_score);
  }, [candidates]);

  // Summary stats
  const stats = useMemo(() => {
    if (!wardRanking.length) return { avgScore: 0, topScore: 0, totalWards: 0, highPriority: 0 };
    const scores = wardRanking.map(w => w.composite_score);
    return {
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      topScore: Math.max(...scores),
      totalWards: wardRanking.length,
      highPriority: scores.filter(s => s >= 0.7).length,
    };
  }, [wardRanking]);

  if (candidatesError) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-3 bg-[var(--color-bg-surface)] p-8 rounded-2xl border border-[var(--color-border-subtle)] shadow-sm max-w-md">
          <div className="w-12 h-12 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-[var(--color-danger)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Failed to Load Infrastructure Data</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Check backend connection and try again.</p>
          <Link href="/infra-map" className="inline-block px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-semibold">
            Back to Map View
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-56px)] overflow-hidden bg-[var(--color-bg-primary)] flex flex-col">
      
      {/* ─── Upper Tab Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 h-14 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] shrink-0 z-20">
        <div className="flex items-center gap-6">
          {/* Navigation Tabs */}
          <Link
            href="/infra-map"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-all"
          >
            <MapIcon className="w-3.5 h-3.5" />
            Infrastructure Map
          </Link>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">
            <BatteryCharging className="w-3.5 h-3.5" />
            EV Charging
          </div>
        </div>

        {/* Right side info chips */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-subtle)]">
            <Zap className="w-3.5 h-3.5 text-[var(--color-warning)]" />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">{candidates.length} Charging Points Analyzed</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-success)]/10 rounded-lg border border-[var(--color-success)]/20">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
            <span className="text-xs font-bold text-[var(--color-success)]">{stats.highPriority} High Priority Sites</span>
          </div>
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Left Panel: Ward Rankings ──────────────────────────── */}
        <div className="w-[380px] flex flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] z-10 overflow-hidden shrink-0">
          
          {/* Header */}
          <div className="p-5 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-primary)] flex items-center justify-center shadow-lg shadow-blue-500/20">
                <BatteryCharging className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-[var(--color-text-primary)]">EV Charging Site Priority</h1>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Optimal Deployment Ranking</p>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-subtle)]">
                <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Wards</p>
                <p className="text-lg font-black text-[var(--color-text-primary)]">{stats.totalWards}</p>
              </div>
              <div className="p-2.5 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-subtle)]">
                <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">High Priority</p>
                <p className="text-lg font-black text-[#ef4444]">{stats.highPriority}</p>
              </div>
              <div className="p-2.5 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border-subtle)]">
              <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Top Score</p>
              <p className="text-lg font-black text-[#ef4444]">{(stats.topScore * 100).toFixed(0)}%</p>
            </div>
            </div>
          </div>

          {/* Score Legend */}
          <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            <div className="flex items-center gap-4 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" /> Demand</div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-chart-purple)]" /> Gap</div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" /> Grid</div>
              <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" /> Access</div>
            </div>
          </div>

          {/* Ward List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {candidatesLoading ? (
              <SectionLoader label="Analyzing EV charging feasibility" />
            ) : wardRanking.map((site, idx) => (
              <WardCard 
                key={site.site_id}
                site={site}
                rank={idx + 1}
                isSelected={selectedSite?.site_id === site.site_id}
                onClick={() => setSelectedSite(site)}
              />
            ))}
          </div>
        </div>

        {/* ─── Map Area ──────────────────────────────────────────── */}
        <div className="flex-1 relative">
          <PlannerMap 
            candidates={wardRanking}
            allCandidates={candidates}
            zones={zonesData}
            selectedSite={selectedSite}
            onSiteSelect={setSelectedSite}
          />

          {/* ─── Floating Detail Panel (Top Right) ────────────────── */}
          {selectedSite && (
            <div className="absolute top-4 right-4 w-[300px] bg-[var(--color-bg-surface)]/95 backdrop-blur-xl border border-[var(--color-border-subtle)] rounded-2xl shadow-2xl z-20 overflow-hidden">
              {/* Panel Header */}
              <div className="p-5 bg-[var(--color-accent)] text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <BatteryCharging className="w-3.5 h-3.5 opacity-60" />
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">EV Charging Site · Rank #{selectedSite.composite_rank}</p>
                    </div>
                    <h2 className="text-xl font-black tracking-tight">{selectedSite.ward_name}</h2>
                    <p className="text-[10px] font-mono opacity-60 mt-0.5">{selectedSite.site_id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black">{(selectedSite.composite_score * 100).toFixed(0)}</span>
                    <p className="text-[8px] font-black uppercase opacity-60 tracking-tight">Score</p>
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="p-5 space-y-3.5">
                <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.15em] mb-3">Score Breakdown</p>
                <PlannerScoreBar label="EV Demand Density" score={selectedSite.demand_score} color="var(--color-accent)" icon={Activity} />
                <PlannerScoreBar label="Charger Coverage Gap" score={selectedSite.gap_score} color="var(--color-chart-purple)" icon={MapPin} />
                <PlannerScoreBar label="Transformer Headroom" score={selectedSite.transformer_score} color="var(--color-warning)" icon={Zap} />
                <PlannerScoreBar label="Road Accessibility" score={selectedSite.access_score} color="var(--color-success)" icon={Navigation2} />
              </div>

              {/* Site Metadata */}
              <div className="px-5 pb-5 space-y-2">
                <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.15em] mb-2">Charging Infrastructure</p>
                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
                  <span className="text-xs text-[var(--color-text-secondary)]">Nearest Transformer</span>
                  <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">{selectedSite.nearest_transformer_id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-subtle)]">
                  <span className="text-xs text-[var(--color-text-secondary)]">Existing EV Chargers (500m)</span>
                  <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">{selectedSite.existing_chargers_500m}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-[var(--color-text-secondary)]">Coordinates</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{selectedSite.lat.toFixed(4)}, {selectedSite.lon.toFixed(4)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border-subtle)] flex gap-2">
                <button 
                  onClick={() => setSelectedSite(null)}
                  className="flex-1 py-2.5 px-4 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-xl text-xs font-bold transition-colors hover:border-[var(--color-border-bright)]"
                >
                  Close
                </button>
                <button className="flex-1 py-2.5 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                  <Download className="w-3.5 h-3.5" />
                  Export Report
                </button>
              </div>
            </div>
          )}

          {/* Bottom Status Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-[var(--color-bg-surface)]/95 backdrop-blur-md border border-[var(--color-border-subtle)] rounded-full px-6 py-2.5 shadow-lg flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Live Data</span>
              </div>
              <div className="w-px h-3 bg-[var(--color-border-bright)]" />
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-[var(--color-warning)]" />
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">EV Points:</span>
                <span className="text-xs font-bold font-mono text-[var(--color-text-primary)]">{candidates.length}</span>
              </div>
              <div className="w-px h-3 bg-[var(--color-border-bright)]" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Wards:</span>
                <span className="text-xs font-bold font-mono text-[var(--color-text-primary)]">{stats.totalWards}</span>
              </div>
              <div className="w-px h-3 bg-[var(--color-border-bright)]" />
              <Link href="/infra-map" className="flex items-center gap-1 text-xs font-bold text-[var(--color-brand-primary)] hover:underline">
                Full Map <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

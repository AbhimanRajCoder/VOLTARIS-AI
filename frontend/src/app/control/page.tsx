'use client';

import { useState, useCallback } from 'react';
import { Shield, Zap, Radio } from 'lucide-react';
import { useZone } from '@/context/ZoneContext';
import { useForecastSummary, useGridAlerts } from '@/lib/api';
import { useControlState, useControlStations, useControlLog, runOrchestration, executeManualAction, rollbackZone } from '@/lib/control-api';
import type { OrchestrateResponse, ControlAction } from '@/lib/control-api';
import StatusHeader from './StatusHeader';
import ActionPanel from './ActionPanel';
import ImpactViz from './ImpactViz';
import StationMap from './StationMap';
import Timeline from './Timeline';
import ControlLogPanel from './ControlLogPanel';

export default function ControlPage() {
  const { selectedZone, setSelectedZone } = useZone();
  const { data: zoneState, mutate: mutateState } = useControlState(selectedZone);
  const { data: stations, mutate: mutateStations } = useControlStations(selectedZone);
  const { data: logEntries, mutate: mutateLog } = useControlLog(selectedZone);

  // Pull REAL data from existing system
  const { data: forecastSummary } = useForecastSummary();
  const { data: alerts } = useGridAlerts(undefined, selectedZone);

  const [result, setResult] = useState<OrchestrateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  // Derive real zone data from existing forecast summary API
  const zoneData = forecastSummary?.find((z: any) => z.zone_id === selectedZone);
  const activeAlerts = alerts?.filter((a: any) => !a.resolved) || [];

  const refreshAll = useCallback(() => {
    mutateState(); mutateStations(); mutateLog();
  }, [mutateState, mutateStations, mutateLog]);

  const handleOrchestrate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await runOrchestration(selectedZone);
      setResult(res);
      refreshAll();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedZone, refreshAll]);

  const handleManual = useCallback(async (action: ControlAction) => {
    setLoading(true);
    try {
      const res = await executeManualAction(selectedZone, action);
      setResult(res);
      refreshAll();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedZone, refreshAll]);

  const handleRollback = useCallback(async () => {
    setLoading(true);
    try {
      await rollbackZone(selectedZone);
      setResult(null);
      refreshAll();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedZone, refreshAll]);

  // Zone selector from real zones
  const zones = forecastSummary?.map((z: any) => z.zone_id) || [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Demo banner */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <Radio className="w-4 h-4 text-amber-600 animate-pulse" />
        <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">
          Simulation Mode — OCPP-Ready Architecture
        </span>
        <span className="ml-auto text-[10px] font-bold text-amber-500">
          Real forecast data • Real scheduler • Real alerts
        </span>
      </div>

      {/* Header + Zone Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Control Command Center</h1>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">AI-Powered Grid Stabilization Engine</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Zone selector */}
          <select
            value={selectedZone}
            onChange={(e) => { setSelectedZone(e.target.value); setResult(null); }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm"
          >
            {zones.map((z: string) => <option key={z} value={z}>{z}</option>)}
          </select>
          {/* Mode toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setMode('auto')} className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'auto' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
              <Zap className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />AI Auto
            </button>
            <button onClick={() => setMode('manual')} className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'manual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
              <Shield className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Manual
            </button>
          </div>
        </div>
      </div>

      {/* Status Header — uses real forecast data */}
      <StatusHeader zoneState={zoneState} zoneId={selectedZone} liveData={zoneData} alertCount={activeAlerts.length} />

      {/* Action Panel + Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionPanel mode={mode} loading={loading} zoneState={zoneState} onOrchestrate={handleOrchestrate} onManualAction={handleManual} onRollback={handleRollback} />
        <ImpactViz result={result} />
      </div>

      {/* Timeline */}
      {result && <Timeline steps={result.timeline} />}

      {/* Station Map + Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StationMap stations={stations || []} result={result} />
        </div>
        <ControlLogPanel entries={logEntries || []} />
      </div>
    </div>
  );
}

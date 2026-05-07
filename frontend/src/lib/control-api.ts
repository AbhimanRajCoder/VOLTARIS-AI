/**
 * Control Orchestration Engine — API hooks and types.
 *
 * Provides SWR hooks and imperative API calls for the COE endpoints.
 */

import useSWR, { type SWRConfiguration } from 'swr';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const fetcher = (url: string) => axios.get(url).then(r => r.data);

// ── Types ───────────────────────────────────────────────────────────────

export type ControlAction = 'DEFER' | 'OPTIMAL_WINDOW' | 'NO_ACTION' | 'ROLLBACK';
export type ZoneStatus = 'NORMAL' | 'WARNING' | 'CONTROL_ACTIVE';
export type StationMode = 'NORMAL' | 'LIMITED' | 'DELAY' | 'OFFLINE';
export type RiskLevel = 'LOW' | 'MODERATE' | 'SEVERE' | 'CRITICAL';

export interface Station {
  station_id: string;
  zone_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity_kw: number;
  current_load_kw: number;
  mode: StationMode;
  connected_vehicles: number;
  uptime_pct: number;
}

export interface StationUpdate {
  station_id: string;
  previous_mode: StationMode;
  new_mode: StationMode;
  load_before_kw: number;
  load_after_kw: number;
  load_reduction_kw: number;
}

export interface SimulationResult {
  before_load_kw: number;
  after_load_kw: number;
  expected_reduction_kw: number;
  compliance_rate: number;
  actual_reduction_kw: number;
  peak_reduction_percentage: number;
  stress_hours_before: number;
  stress_hours_after: number;
  stress_hours_prevented: number;
  timeline_minutes: number;
}

export interface ZoneControlState {
  zone_id: string;
  status: ZoneStatus;
  risk_level: RiskLevel;
  last_action: ControlAction | null;
  last_action_at: string | null;
  active_until: string | null;
  reduction_kw: number;
  peak_load_kw: number;
  capacity_kw: number;
  utilization_pct: number;
  stations_affected: number;
}

export interface TimelineStep {
  step: string;
  label: string;
  status: 'pending' | 'active' | 'complete';
  detail: string;
  timestamp: string | null;
  duration_ms: number;
}

export interface ControlLogEntry {
  timestamp: string;
  zone_id: string;
  action: ControlAction;
  risk_level: RiskLevel;
  impact_kw: number;
  stations_affected: number;
  detail: string;
  operator: string;
}

export interface OrchestrateResponse {
  zone_id: string;
  risk_level: RiskLevel;
  action_taken: ControlAction;
  reason: string;
  zone_state: ZoneControlState;
  simulation: SimulationResult;
  stations: StationUpdate[];
  timeline: TimelineStep[];
  log_entry: ControlLogEntry;
  demo_mode: boolean;
}

// ── SWR Hooks ───────────────────────────────────────────────────────────

const swrDefaults: SWRConfiguration = {
  dedupingInterval: 5000,
  revalidateOnFocus: false,
  shouldRetryOnError: false,
  errorRetryCount: 1,
};

export function useControlState(zoneId: string) {
  return useSWR<ZoneControlState>(
    zoneId ? `${API_URL}/control/state?zone_id=${zoneId}` : null,
    fetcher,
    { ...swrDefaults, refreshInterval: 10000 }
  );
}

export function useControlStations(zoneId: string) {
  return useSWR<Station[]>(
    zoneId ? `${API_URL}/control/stations?zone_id=${zoneId}` : null,
    fetcher,
    { ...swrDefaults, refreshInterval: 15000 }
  );
}

export function useControlLog(zoneId?: string, limit: number = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (zoneId) params.set('zone_id', zoneId);
  return useSWR<ControlLogEntry[]>(
    `${API_URL}/control/log?${params}`,
    fetcher,
    { ...swrDefaults, refreshInterval: 10000 }
  );
}

// ── Imperative API calls ────────────────────────────────────────────────

export async function runOrchestration(zoneId: string): Promise<OrchestrateResponse> {
  const res = await axios.post(`${API_URL}/control/orchestrate`, { zone_id: zoneId });
  return res.data;
}

export async function executeManualAction(
  zoneId: string,
  action: ControlAction,
  reason: string = 'Manual operator override'
): Promise<OrchestrateResponse> {
  const res = await axios.post(`${API_URL}/control/execute`, {
    zone_id: zoneId,
    action,
    reason,
  });
  return res.data;
}

export async function rollbackZone(zoneId: string) {
  const res = await axios.post(`${API_URL}/control/rollback`, { zone_id: zoneId });
  return res.data;
}

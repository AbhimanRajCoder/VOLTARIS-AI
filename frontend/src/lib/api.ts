import useSWR, { type SWRConfiguration } from 'swr';
import axios from 'axios';
import { 
  ZoneDemandForecast, 
  InfraSiteCandidate, 
  GridAlert, 
  DeflectRoutingResponse,
  CommunityAlertResponse,
  ImpactSummaryResponse,
  PartnerStatusResponse,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const fetcher = (url: string) => axios.get(url).then(r => r.data);

const swrDefaults: SWRConfiguration = {
  dedupingInterval: 5000,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
  errorRetryCount: 2,
};

const forecastSWR: SWRConfiguration = {
  ...swrDefaults,
  dedupingInterval: 10000,
  refreshInterval: 5 * 60 * 1000,
};

const infrequentSWR: SWRConfiguration = {
  ...swrDefaults,
  dedupingInterval: 60000,
};

function buildKey(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
) {
  const query = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });
  }

  const queryString = query.toString();
  return queryString ? `${API_URL}${path}?${queryString}` : `${API_URL}${path}`;
}

export function useZones() {
  return useSWR<any[]>(
    buildKey('/forecast/zones'),
    fetcher,
    infrequentSWR
  );
}

export function useGridSummary() {
  return useSWR<any>(
    buildKey('/briefing/today'),
    fetcher,
    { ...swrDefaults, dedupingInterval: 10000, refreshInterval: 10 * 60 * 1000 }
  );
}

export function useForecastDemand(zone_id: string, start_ts?: string, end_ts?: string) {
  const key = zone_id
    ? buildKey('/forecast/demand', { zone_id, start_ts, end_ts })
    : null;

  return useSWR<ZoneDemandForecast[]>(
    key,
    fetcher,
    forecastSWR
  );
}

export function useForecastExplain(zone_id: string, timestamp: string) {
  const key = zone_id && timestamp
    ? buildKey('/forecast/explain', { zone_id, timestamp })
    : null;

  return useSWR(
    key,
    fetcher,
    forecastSWR
  );
}

export function useForecastSummary() {
  return useSWR<any[]>(
    buildKey('/forecast/summary'),
    fetcher,
    { ...swrDefaults, dedupingInterval: 10000, refreshInterval: 60 * 1000 }
  );
}

export interface ScheduleOptimizePayload {
  zone_id: string;
  date: string;  // Changed back to 'date' as per Part 1 instructions
  capacity_limit_kw: number;
  user_window_start?: number;
  user_window_end?: number;
}

export function useScheduleOptimize(payload: ScheduleOptimizePayload | null) {
  const payloadKey = payload ? JSON.stringify(payload) : null;
  const key = payloadKey
    ? buildKey('/schedule/optimize', { payload: payloadKey })
    : null;

  return useSWR(
    key,
    () => axios.post(`${API_URL}/schedule/optimize`, payload).then(r => r.data),
    { ...swrDefaults, dedupingInterval: 10000 }
  );
}

export function useScheduleComparison(zone_id: string, date: string) {
  const key = zone_id && date
    ? buildKey('/schedule/comparison', { zone_id, date })
    : null;

  return useSWR(
    key,
    fetcher,
    { ...swrDefaults, dedupingInterval: 10000 }
  );
}

export function useScheduleHeatmap(date: string) {
  const key = date ? buildKey('/schedule/heatmap', { date }) : null;

  return useSWR(
    key,
    fetcher,
    { ...swrDefaults, dedupingInterval: 10000 }
  );
}

export function useInfraZones() {
  return useSWR<any>(
    buildKey('/infra/zones'),
    fetcher,
    infrequentSWR
  );
}

export function useInfraHotspots(n_clusters: number = 5) {
  const key = buildKey('/infra/hotspots', { n_clusters });

  return useSWR(
    key,
    fetcher,
    infrequentSWR
  );
}

export function useInfraRecommend(top_n: number = 10, min_score: number = 0.0) {
  const key = buildKey('/infra/recommend', { top_n, min_score });

  return useSWR<InfraSiteCandidate[]>(
    key,
    fetcher,
    infrequentSWR
  );
}

export function useInfraSite(site_id: string) {
  return useSWR<InfraSiteCandidate>(
    site_id ? `${API_URL}/infra/site/${site_id}` : null,
    fetcher,
    infrequentSWR
  );
}

export function useGridAlerts(severity?: string, zone_id?: string) {
  const key = buildKey('/grid/alerts', {
    severity,
    zone_id,
    resolved: false,
    limit: 50,
  });

  return useSWR<GridAlert[]>(
    key,
    fetcher,
    { ...swrDefaults, dedupingInterval: 10000, refreshInterval: 30 * 1000 }
  );
}

export async function acknowledgeAlert(alert_id: string) {
  return axios.post(`${API_URL}/grid/alerts/${alert_id}/acknowledge`);
}

export interface SimulationPayload {
  zone_id: string;
  date: string;
  scenario: 'normal_day' | 'holiday_spike' | 'peak_ev_surge' | 'monsoon_dip';
  ev_adoption_multiplier: number;
  follow_recommendations: boolean;
}

export function useSimulateScenario(payload: SimulationPayload | null) {
  const payloadKey = payload ? JSON.stringify(payload) : null;
  const key = payloadKey
    ? buildKey('/simulate/scenario', { payload: payloadKey })
    : null;

  return useSWR(
    key,
    () => axios.post(`${API_URL}/simulate/scenario`, payload).then(r => r.data),
    { ...swrDefaults, dedupingInterval: 10000 }
  );
}

export async function executeSimulation(payload: SimulationPayload) {
  const response = await axios.post(`${API_URL}/simulate/scenario`, payload);
  return response.data;
}

export function useDeflectRouting() {
  return useSWR<DeflectRoutingResponse>(
    buildKey('/deflect/routing'),
    fetcher,
    { ...swrDefaults, dedupingInterval: 8000, refreshInterval: 15 * 1000 }
  );
}

export function useDeflectImpactSummary(refreshMs: number = 30 * 1000) {
  return useSWR<ImpactSummaryResponse>(
    buildKey('/deflect/impact-summary'),
    fetcher,
    { ...swrDefaults, dedupingInterval: 10000, refreshInterval: refreshMs }
  );
}

export function useDeflectPartnerStatus() {
  return useSWR<PartnerStatusResponse>(
    buildKey('/deflect/partner-status'),
    fetcher,
    { ...swrDefaults, dedupingInterval: 8000, refreshInterval: 10 * 1000 }
  );
}

export async function triggerCommunityAlert(zone_id?: string) {
  const response = await axios.post<CommunityAlertResponse>(
    `${API_URL}/deflect/community-alert`,
    zone_id ? { zone_id } : {}
  );
  return response.data;
}

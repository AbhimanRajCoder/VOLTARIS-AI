// ============================================================
// GridWise Soft-Deflect — API Client
// Calls real backend first, falls back to mock if unreachable.
// Base URL: VITE_API_BASE_URL (default: /api)
// Prefix:   /deflect/*
// ============================================================

import axios from 'axios';
import {
  mockDeflectRouting,
  mockCommunityAlert,
  mockImpactSummary,
  mockPartnerStatus,
  type DeflectRoutingResponse,
  type CommunityAlertResponse,
  type ImpactSummaryResponse,
  type PartnerStatusResponse,
} from './mockData';

export const DEMO_KEY = 'demo_gridwise_2026';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 6000,
});

// ── Result wrapper ──────────────────────────────────────────

export type ApiMode = 'live' | 'demo';

export interface ApiResult<T> {
  data: T;
  mode: ApiMode;
  responseTimeMs: number;
  status: number;
  sizeBytes: number;
}

/** Try real endpoint, silently fall back to mock. */
async function callOrMock<T>(
  realFn: () => Promise<T>,
  mockFn: () => Promise<T>,
): Promise<ApiResult<T>> {
  const t0 = performance.now();

  try {
    const data = await realFn();
    const ms = Math.round(performance.now() - t0);
    const json = JSON.stringify(data);
    return { data, mode: 'live', responseTimeMs: ms, status: 200, sizeBytes: new Blob([json]).size };
  } catch {
    const data = await mockFn();
    const ms = Math.round(performance.now() - t0);
    const json = JSON.stringify(data);
    return { data, mode: 'demo', responseTimeMs: ms, status: 200, sizeBytes: new Blob([json]).size };
  }
}

// ── Typed endpoint functions ────────────────────────────────

export function fetchDeflectRouting(): Promise<ApiResult<DeflectRoutingResponse>> {
  return callOrMock(
    async () => (await client.get('/deflect/routing')).data,
    mockDeflectRouting,
  );
}

export function fireCommunityAlert(zoneId?: string): Promise<ApiResult<CommunityAlertResponse>> {
  return callOrMock(
    async () => {
      const body: Record<string, string> = {};
      if (zoneId) body.zone_id = zoneId;
      return (await client.post('/deflect/community-alert', body)).data;
    },
    () => mockCommunityAlert(zoneId),
  );
}

export function fetchImpactSummary(): Promise<ApiResult<ImpactSummaryResponse>> {
  return callOrMock(
    async () => (await client.get('/deflect/impact-summary')).data,
    mockImpactSummary,
  );
}

export function fetchPartnerStatus(): Promise<ApiResult<PartnerStatusResponse>> {
  return callOrMock(
    async () => (await client.get('/deflect/partner-status')).data,
    mockPartnerStatus,
  );
}

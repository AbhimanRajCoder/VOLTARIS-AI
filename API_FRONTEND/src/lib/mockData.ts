// ============================================================
// GridWise Soft-Deflect — Typed Interfaces & Mock Data Layer
// Mirrors the exact response shapes from the real backend at
//   /api/deflect/routing
//   /api/deflect/community-alert
//   /api/deflect/impact-summary
//   /api/deflect/partner-status
// ============================================================

// ── Response Types (match backend Pydantic schemas exactly) ─

export interface ZoneDeflectInfo {
  zone_id: string;
  status: 'GREEN' | 'AMBER' | 'CRITICAL';
  routing_penalty: number;
  user_facing_message: string;
  recommended_alternative_zone: string | null;
}

export interface DeflectRoutingResponse {
  timestamp: string;
  deflect_layer: ZoneDeflectInfo[];
}

export interface PushTemplate {
  title: string;
  body: string;
}

export interface CommunityAlertResponse {
  event_id: string;
  target_ward: string;
  affected_rwa_ids: string[];
  grid_load_pct: number;
  action_required: 'DEFER_EV_CHARGING';
  optimal_resume_time: string;
  partner_push_template: PushTemplate;
}

export interface DeflectionEventRecord {
  id: string;
  zone_id: string;
  fired_at: string;
  predicted_kw: number;
  actual_kw: number | null;
  deflected_kw: number | null;
  status: string;
}

export interface ImpactSummaryResponse {
  total_deflected_kw_today: number;
  events_fired_today: number;
  blackouts_prevented: number;
  events: DeflectionEventRecord[];
}

export interface PartnerInfo {
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  latency_ms: number;
  last_ping: string | null;
}

export interface PartnerStatusResponse {
  partners: PartnerInfo[];
}

// ── Zone metadata for the UI layer (lat/lng for maps) ───────
// The real API intentionally does NOT expose lat/lng — those
// come from the client-side zone registry the map integrator
// already owns.  This mirrors how a real partner like Ola Maps
// would already have a zone→coordinate mapping.

export interface ZoneGeo {
  zone_id: string;
  zone_name: string;
  lat: number;
  lng: number;
}

export const ZONE_REGISTRY: ZoneGeo[] = [
  { zone_id: 'Z01', zone_name: 'Whitefield',       lat: 12.9698, lng: 77.7500 },
  { zone_id: 'Z02', zone_name: 'Koramangala',       lat: 12.9352, lng: 77.6245 },
  { zone_id: 'Z03', zone_name: 'HSR Layout',        lat: 12.9081, lng: 77.6476 },
  { zone_id: 'Z04', zone_name: 'Indiranagar',       lat: 12.9784, lng: 77.6408 },
  { zone_id: 'Z05', zone_name: 'Electronic City',   lat: 12.8399, lng: 77.6770 },
  { zone_id: 'Z06', zone_name: 'Hebbal',            lat: 13.0358, lng: 77.5970 },
];

export const zoneGeoLookup = Object.fromEntries(
  ZONE_REGISTRY.map(z => [z.zone_id, z])
);

// ── Polygon boundaries for heatmap overlays ─────────────────
// Realistic approximations of Bengaluru ward/zone boundaries.
// Each polygon is an array of [lat, lng] pairs.

export const ZONE_POLYGONS: Record<string, [number, number][]> = {
  Z01: [ // Whitefield
    [12.9850, 77.7350], [12.9870, 77.7550], [12.9750, 77.7680],
    [12.9580, 77.7650], [12.9520, 77.7480], [12.9560, 77.7320],
    [12.9700, 77.7280], [12.9850, 77.7350],
  ],
  Z02: [ // Koramangala
    [12.9480, 77.6100], [12.9500, 77.6320], [12.9400, 77.6420],
    [12.9250, 77.6380], [12.9200, 77.6200], [12.9260, 77.6080],
    [12.9380, 77.6050], [12.9480, 77.6100],
  ],
  Z03: [ // HSR Layout
    [12.9220, 77.6330], [12.9230, 77.6560], [12.9100, 77.6650],
    [12.8950, 77.6580], [12.8920, 77.6400], [12.8980, 77.6300],
    [12.9100, 77.6270], [12.9220, 77.6330],
  ],
  Z04: [ // Indiranagar
    [12.9900, 77.6280], [12.9920, 77.6500], [12.9800, 77.6580],
    [12.9680, 77.6520], [12.9650, 77.6340], [12.9720, 77.6250],
    [12.9820, 77.6230], [12.9900, 77.6280],
  ],
  Z05: [ // Electronic City
    [12.8550, 77.6620], [12.8560, 77.6880], [12.8420, 77.6950],
    [12.8270, 77.6890], [12.8230, 77.6700], [12.8300, 77.6580],
    [12.8430, 77.6550], [12.8550, 77.6620],
  ],
  Z06: [ // Hebbal
    [13.0500, 77.5830], [13.0510, 77.6080], [13.0380, 77.6150],
    [13.0240, 77.6080], [13.0210, 77.5900], [13.0280, 77.5790],
    [13.0400, 77.5770], [13.0500, 77.5830],
  ],
};

// ── Helpers ─────────────────────────────────────────────────

const jitter = (base: number, pct = 0.05): number =>
  Math.round((base + (Math.random() * 2 - 1) * base * pct) * 100) / 100;

const delay = (): Promise<void> =>
  new Promise(r => setTimeout(r, Math.random() * 400 + 400));

const iso = () => new Date().toISOString().replace('+00:00', 'Z');

const uuid4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

// ── Mock: GET /api/deflect/routing ──────────────────────────

const ZONE_LOAD_PROFILES = [
  { zone_id: 'Z01', baseLoadRatio: 0.92, alt: 'Z03' },
  { zone_id: 'Z02', baseLoadRatio: 0.74, alt: 'Z03' },
  { zone_id: 'Z03', baseLoadRatio: 0.45, alt: null },
  { zone_id: 'Z04', baseLoadRatio: 0.68, alt: 'Z06' },
  { zone_id: 'Z05', baseLoadRatio: 0.38, alt: null },
  { zone_id: 'Z06', baseLoadRatio: 0.52, alt: null },
];

function congestionTranslate(loadRatio: number): { penalty: number; status: 'GREEN' | 'AMBER' | 'CRITICAL' } {
  if (loadRatio < 0.65) return { penalty: 0.0, status: 'GREEN' };
  if (loadRatio <= 0.85) return { penalty: 0.4, status: 'AMBER' };
  return { penalty: 0.95, status: 'CRITICAL' };
}

function statusMessage(status: string): string {
  if (status === 'CRITICAL')
    return 'Grid Congestion: Charging speeds may be throttled. Consider alternative locations.';
  if (status === 'AMBER')
    return 'Grid load is moderate. Off-peak charging recommended for optimal speeds.';
  return 'Grid capacity is healthy. Optimal conditions for EV charging.';
}

export const mockDeflectRouting = async (): Promise<DeflectRoutingResponse> => {
  await delay();

  // Jitter load ratios each call for realism
  const loads = ZONE_LOAD_PROFILES.map(z => ({
    ...z,
    loadRatio: Math.max(0.1, Math.min(1.2, jitter(z.baseLoadRatio, 0.06))),
  }));

  const lowestZone = loads.reduce((a, b) => (a.loadRatio < b.loadRatio ? a : b)).zone_id;

  const deflect_layer: ZoneDeflectInfo[] = loads.map(z => {
    const { penalty, status } = congestionTranslate(z.loadRatio);
    return {
      zone_id: z.zone_id,
      status,
      routing_penalty: penalty,
      user_facing_message: statusMessage(status),
      recommended_alternative_zone: status === 'CRITICAL' && lowestZone !== z.zone_id ? lowestZone : null,
    };
  });

  return { timestamp: iso(), deflect_layer };
};

// ── Mock: POST /api/deflect/community-alert ─────────────────

export const mockCommunityAlert = async (
  zoneId?: string,
): Promise<CommunityAlertResponse> => {
  await delay();

  const zone = ZONE_REGISTRY.find(z => z.zone_id === (zoneId || 'Z01')) || ZONE_REGISTRY[0];
  const loadPct = jitter(92, 0.04);

  const resumeDate = new Date();
  resumeDate.setHours(23, 0, 0, 0);
  if (resumeDate.getTime() < Date.now()) resumeDate.setDate(resumeDate.getDate() + 1);

  return {
    event_id: `evt_${uuid4()}`,
    target_ward: zone.zone_name,
    affected_rwa_ids: [`RWA_${Math.floor(Math.random() * 900 + 100)}`, `RWA_${Math.floor(Math.random() * 900 + 100)}`],
    grid_load_pct: Math.round(loadPct * 10) / 10,
    action_required: 'DEFER_EV_CHARGING',
    optimal_resume_time: resumeDate.toISOString(),
    partner_push_template: {
      title: '⚠️ Urgent: BESCOM Grid Stress',
      body: `${zone.zone_name} grid is at ${loadPct.toFixed(1)}% capacity. Please schedule EV charging after 11:00 PM tonight.`,
    },
  };
};

// ── Mock: GET /api/deflect/impact-summary ───────────────────

export const mockImpactSummary = async (): Promise<ImpactSummaryResponse> => {
  await delay();

  const events: DeflectionEventRecord[] = [
    { id: uuid4(), zone_id: 'Z01', fired_at: hoursAgo(5), predicted_kw: jitter(850, 0.03), actual_kw: jitter(720, 0.03), deflected_kw: null, status: 'COMPUTED' },
    { id: uuid4(), zone_id: 'Z02', fired_at: hoursAgo(4), predicted_kw: jitter(620, 0.03), actual_kw: jitter(540, 0.03), deflected_kw: null, status: 'COMPUTED' },
    { id: uuid4(), zone_id: 'Z04', fired_at: hoursAgo(3), predicted_kw: jitter(780, 0.03), actual_kw: jitter(650, 0.03), deflected_kw: null, status: 'COMPUTED' },
    { id: uuid4(), zone_id: 'Z01', fired_at: hoursAgo(2), predicted_kw: jitter(910, 0.03), actual_kw: jitter(790, 0.03), deflected_kw: null, status: 'COMPUTED' },
    { id: uuid4(), zone_id: 'Z06', fired_at: hoursAgo(1), predicted_kw: jitter(480, 0.03), actual_kw: jitter(420, 0.03), deflected_kw: null, status: 'PENDING_EVAL' },
  ].map(e => ({
    ...e,
    deflected_kw: e.actual_kw !== null ? Math.round(Math.max(0, e.predicted_kw - e.actual_kw)) : null,
  }));

  const totalDeflected = events.reduce((a, e) => a + (e.deflected_kw ?? 0), 0);
  const blackouts = events.filter(e => e.status === 'COMPUTED' && (e.deflected_kw ?? 0) >= 80).length;

  return {
    total_deflected_kw_today: Math.round(totalDeflected),
    events_fired_today: events.length,
    blackouts_prevented: blackouts,
    events,
  };
};

// ── Mock: GET /api/deflect/partner-status ───────────────────

export const mockPartnerStatus = async (): Promise<PartnerStatusResponse> => {
  await delay();

  const bases: [string, number][] = [
    ['Ola Maps API', 42],
    ['MyGate Webhook', 87],
    ['MapMyIndia API', 55],
    ['NoBrokerHood Webhook', 61],
  ];

  const partners: PartnerInfo[] = bases.map(([name, baseline]) => ({
    name,
    status: 'healthy',
    latency_ms: Math.max(20, baseline + Math.floor(Math.random() * 27 - 12)),
    last_ping: name === 'Ola Maps API' ? iso() : null,
  }));

  return { partners };
};

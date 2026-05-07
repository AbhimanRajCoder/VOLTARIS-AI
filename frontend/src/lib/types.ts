export interface ZoneDemandForecast {
  zone_id: string;
  timestamp: string;
  predicted_kw: number;
  ev_share_pct: number;
  confidence_lo: number;
  confidence_hi: number;
  model_version: string;
}

export interface ChargingRecommendation {
  zone_id: string;
  hour_slot: number;
  action: 'CHARGE_NOW' | 'DEFER' | 'OPTIMAL_WINDOW';
  grid_load_pct: number;
  optimal_window: string | null;
  reason: string;
  expected_delta_kw: number;
}

export interface InfraSiteCandidate {
  site_id: string;
  lat: number;
  lon: number;
  ward_name: string;
  demand_score: number;
  gap_score: number;
  transformer_score: number;
  access_score: number;
  composite_rank: number;
  composite_score: number;
  nearest_transformer_id: string;
  existing_chargers_500m: number;
}

export interface GridAlert {
  alert_id: string;
  zone_id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  triggered_at: string;
  message: string;
  recommended_action: string | null;
  acknowledged: boolean;
  resolved: boolean;
}

export interface HotspotFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    cluster_id: number;
    site_count: number;
    avg_composite_score: number;
    top_site_id: string;
  };
}

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
  last_ping?: string | null;
}

export interface PartnerStatusResponse {
  partners: PartnerInfo[];
}

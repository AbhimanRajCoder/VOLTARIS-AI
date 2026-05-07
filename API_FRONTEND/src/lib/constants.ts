import { getGridSummary, getAlerts, getHotspots, getDeflectRouting, postCommunityAlert, getImpactSummary, getPartnerStatus } from './api';

export const TEST_KEY = 'API_7730pqx91lmvte4';

export const endpoints = [
  { 
    id: 'summary',
    name: 'Grid Summary', 
    path: '/forecast/summary', 
    method: 'GET', 
    desc: 'Retrieve high-level telemetry for the entire grid network. This includes real-time load, transformer capacity, and EV penetration metrics for every active zone.',
    params: [
      { name: 'include_history', type: 'boolean', desc: 'Include the last 12 hours of trend data.', required: false },
    ],
    response: {
      zone_id: 'string',
      load_kw: 'float',
      capacity_kw: 'float',
      ev_share_pct: 'float',
      timestamp: 'ISO8601'
    },
    func: getGridSummary
  },
  { 
    id: 'alerts',
    name: 'Grid Alerts', 
    path: '/grid/alerts', 
    method: 'GET', 
    desc: 'Access the real-time stream of grid events. Use this endpoint to monitor for outages, load violations, and equipment degradation across the service area.',
    params: [
      { name: 'severity', type: 'string', desc: 'Filter by: low, medium, high', required: false },
      { name: 'limit', type: 'integer', desc: 'Max records to return (default 50)', required: false },
    ],
    response: {
      id: 'uuid',
      type: 'string',
      severity: 'enum',
      zone_id: 'string',
      message: 'string',
      timestamp: 'ISO8601'
    },
    func: getAlerts
  },
  { 
    id: 'hotspots',
    name: 'Infra Hotspots', 
    path: '/infra/hotspots', 
    method: 'GET', 
    desc: 'Leverage spatial intelligence to identify areas of high demand density. This endpoint returns ML-clustered sites recommended for new infrastructure deployment.',
    params: [
      { name: 'n_clusters', type: 'integer', desc: 'Number of clusters to generate (1-10)', required: true, default: 5 },
    ],
    response: {
      clusters: 'array',
      metadata: 'object',
      grid_bounds: 'array'
    },
    func: () => getHotspots(5)
  },
  {
    id: 'deflect-routing',
    name: 'Get Deflect Routing',
    path: '/deflect/routing',
    method: 'GET',
    desc: 'Return the latest Soft-Deflect routing layer for all zones. This endpoint maps each zone\'s current load ratio to a congestion status and routing penalty so partner maps can de-prioritize routes into stressed zones.',
    params: [],
    response: {
      timestamp: 'ISO8601',
      deflect_layer: 'array'
    },
    func: getDeflectRouting
  },
  {
    id: 'community-alert',
    name: 'Post Community Alert',
    path: '/deflect/community-alert',
    method: 'POST',
    desc: 'Fire a community deflection alert for one zone or all zones above 85% load. Payloads are forwarded to MyGate webhook when configured, otherwise logged in mock mode.',
    params: [
      { name: 'zone_id', type: 'string', desc: 'Optional ID of a specific zone to alert.', required: false }
    ],
    response: {
      event_id: 'string',
      target_ward: 'string',
      affected_rwa_ids: 'array',
      grid_load_pct: 'float',
      action_required: 'string',
      optimal_resume_time: 'string',
      partner_push_template: 'string'
    },
    func: postCommunityAlert
  },
  {
    id: 'impact-summary',
    name: 'Get Impact Summary',
    path: '/deflect/impact-summary',
    method: 'GET',
    desc: 'Return today\'s Soft-Deflect impact summary and event records. Includes total kW deflected, total events fired, and a coarse estimate of blackouts prevented based on high-impact computed events.',
    params: [],
    response: {
      total_deflected_kw_today: 'integer',
      events_fired_today: 'integer',
      blackouts_prevented: 'integer',
      events: 'array'
    },
    func: getImpactSummary
  },
  {
    id: 'partner-status',
    name: 'Get Partner Status',
    path: '/deflect/partner-status',
    method: 'GET',
    desc: 'Return synthetic live health for external Soft-Deflect integration partners.',
    params: [],
    response: {
      partners: 'array'
    },
    func: getPartnerStatus
  }
];

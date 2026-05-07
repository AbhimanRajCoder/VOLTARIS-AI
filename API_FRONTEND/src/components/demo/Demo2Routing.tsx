// ============================================================
// Demo 2 — EV Routing Simulator
// Endpoint: GET /api/deflect/routing
//
// Teaches developers how a navigation app (Ola Maps, Google
// Maps, MapMyIndia) uses routing_penalty to reroute EV
// drivers away from congested grid zones.
//
// The code snippet shows the exact scoring algorithm a partner
// would implement in their routing engine.
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import DemoSection from './DemoSection';
import { fetchDeflectRouting, DEMO_KEY } from '../../lib/deflectApi';
import {
  ZONE_REGISTRY, zoneGeoLookup, ZONE_POLYGONS,
  type ZoneDeflectInfo,
} from '../../lib/mockData';

// ── Map icon ────────────────────────────────────────────────

const carIcon = L.divIcon({
  className: '',
  html: `<div style="font-size:26px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5))">🚗</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// ── Integration-ready code snippet ──────────────────────────

const CODE = `import axios from 'axios';

const API_BASE = 'https://voltaris-ai.onrender.com';
const API_KEY  = 'YOUR_API_KEY';

/**
 * Step 1 — Fetch live routing penalties.
 * Each zone gets a penalty between 0.0 (healthy) and 0.95
 * (near-overload) based on real-time transformer load.
 */
async function getPenalties() {
  const { data } = await axios.get(
    \`\${API_BASE}/api/deflect/routing\`,
    { headers: { 'X-API-Key': API_KEY } }
  );

  // Build a zone_id → penalty lookup
  return Object.fromEntries(
    data.deflect_layer.map(z => [z.zone_id, z.routing_penalty])
  );
  // e.g. { Z01: 0.95, Z02: 0.4, Z03: 0.0, ... }
}

/**
 * Step 2 — Integrate into your route scoring function.
 *
 * The key insight: a penalty of 0.95 adds ~10 km equivalent
 * cost, which strongly de-prioritises congested zones without
 * blocking them entirely (soft deflection).
 */
function scoreCharger(charger, driverLocation, penalties) {
  const distanceKm = haversine(driverLocation, charger.coords);
  const gridPenalty = penalties[charger.zone_id] ?? 0;

  // Weighted score: lower is better
  return distanceKm + (gridPenalty * 10);
}

/**
 * Step 3 — Rank all nearby chargers and route to the best.
 */
async function findBestCharger(driver, nearbyChargers) {
  const penalties = await getPenalties();

  const ranked = nearbyChargers
    .map(c => ({ ...c, score: scoreCharger(c, driver.loc, penalties) }))
    .sort((a, b) => a.score - b.score);

  const best = ranked[0];

  // If the best charger is in a zone with an alternative,
  // show the driver a "suggested alternative" chip
  const alt = data.deflect_layer.find(
    z => z.zone_id === best.zone_id
  )?.recommended_alternative_zone;

  return { charger: best, alternativeZone: alt };
}

/**
 * Step 4 — Cache for 30 s (matches server TTL).
 * Call once per route calculation, not per frame.
 */
let cache = { data: null, expiresAt: 0 };

async function getCachedPenalties() {
  if (Date.now() < cache.expiresAt) return cache.data;
  cache.data = await getPenalties();
  cache.expiresAt = Date.now() + 30_000;
  return cache.data;
}`;

const REQUEST = `GET /api/deflect/routing HTTP/1.1
Host: api.gridwise.in
X-API-Key: ${DEMO_KEY}
Accept: application/json`;

// ── Haversine distance ──────────────────────────────────────

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Color helpers ───────────────────────────────────────────

const penaltyColor = (p: number) =>
  p >= 0.95 ? '#EF4444' : p >= 0.4 ? '#F59E0B' : '#1D9E75';

const penaltyLabel = (p: number) =>
  p >= 0.95 ? 'CRITICAL' : p >= 0.4 ? 'AMBER' : 'GREEN';

// ─────────────────────────────────────────────────────────────

const Demo2Routing = () => {
  const [driverZone, setDriverZone] = useState('Z01');
  const [battery, setBattery] = useState(15);
  const [zones, setZones] = useState<ZoneDeflectInfo[]>([]);
  const [responseJson, setResponseJson] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Compute recommended charger from zone data
  const routing = useMemo(() => {
    if (!zones.length) return null;
    const driverGeo = zoneGeoLookup[driverZone];
    if (!driverGeo) return null;

    const ranked = zones
      .filter(z => z.zone_id !== driverZone)
      .map(z => {
        const geo = zoneGeoLookup[z.zone_id];
        const dist = geo ? haversineKm(driverGeo, geo) : 99;
        return { zone: z, geo, dist, score: dist + z.routing_penalty * 10 };
      })
      .sort((a, b) => a.score - b.score);

    const avoided = zones.find(z => z.status === 'CRITICAL' && z.zone_id !== driverZone);
    return { best: ranked[0], avoided, all: ranked };
  }, [zones, driverZone]);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDeflectRouting();
      setZones(res.data.deflect_layer);
      setResponseJson(JSON.stringify(res.data, null, 2));
      setResponseTime(res.responseTimeMs);
      setResponseSize(`${(res.sizeBytes / 1024).toFixed(1)} kB`);
      setLastRun(new Date());
    } finally { setLoading(false); }
  }, []);

  const driverGeo = zoneGeoLookup[driverZone];

  return (
    <DemoSection
      number={2}
      title="EV Routing Simulator"
      subtitle="How a navigation app uses routing_penalty to reroute EV drivers away from stressed grid zones"
      method="GET"
      endpoint="/api/deflect/routing"
      autoRunIntervalSec={20}
      codeContent={CODE}
      requestContent={REQUEST}
      onRun={run}
      responseJson={responseJson}
      responseTimeMs={responseTime}
      responseSizeKb={responseSize}
      lastRunTime={lastRun}
      isLoading={loading}
    >
      <div className="relative h-full min-h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        <MapContainer center={[12.94, 77.65]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OSM &copy; CARTO'
          />

          {/* Zone polygons with penalty-based styling */}
          {routing && routing.all.map(({ zone, geo }) => {
            const poly = ZONE_POLYGONS[zone.zone_id];
            if (!poly) return null;
            const isBest = zone.zone_id === routing.best?.zone.zone_id;
            return (
              <Polygon
                key={zone.zone_id}
                positions={poly}
                pathOptions={{
                  fillColor: penaltyColor(zone.routing_penalty),
                  fillOpacity: isBest ? 0.45 : 0.20,
                  color: isBest ? '#ffffff' : penaltyColor(zone.routing_penalty),
                  weight: isBest ? 3 : 1,
                  dashArray: isBest ? '8 4' : undefined,
                }}
              >
                <Popup>
                  <div className="text-xs p-1">
                    <span className="font-bold">{zone.zone_id} · {geo?.zone_name}</span>
                    <div className="text-slate-500 mt-1">{penaltyLabel(zone.routing_penalty)} — penalty {zone.routing_penalty}</div>
                  </div>
                </Popup>
              </Polygon>
            );
          })}

          {/* Driver marker */}
          {routing && driverGeo && (
            <Marker position={[driverGeo.lat, driverGeo.lng]} icon={carIcon}>
              <Popup><span className="text-xs font-bold">Driver · {driverGeo.zone_name} · Battery {battery}%</span></Popup>
            </Marker>
          )}

          {/* Route lines */}
          {routing && driverGeo && routing.all.map(({ zone, geo }) => {
            if (!geo) return null;
            const isBest = zone.zone_id === routing.best?.zone.zone_id;
            return (
              <Polyline
                key={`r-${zone.zone_id}`}
                positions={[[driverGeo.lat, driverGeo.lng], [geo.lat, geo.lng]]}
                pathOptions={{
                  color: penaltyColor(zone.routing_penalty),
                  weight: isBest ? 4 : 1.5,
                  dashArray: isBest ? '12 6' : '4 4',
                  opacity: isBest ? 1 : 0.3,
                }}
              />
            );
          })}
        </MapContainer>

        {/* Controls overlay */}
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-2xl p-4 w-56 border border-slate-200 shadow-md">
          <h4 className="text-[10px] font-bold text-slate-500 mb-3 uppercase tracking-widest">Simulation Controls</h4>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 font-semibold block mb-1">Driver Location</label>
              <select
                value={driverZone}
                onChange={e => setDriverZone(e.target.value)}
                className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
              >
                {ZONE_REGISTRY.map(z => (
                  <option key={z.zone_id} value={z.zone_id}>{z.zone_id} — {z.zone_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-semibold block mb-1">Battery: {battery}%</label>
              <input type="range" min={5} max={30} value={battery} onChange={e => setBattery(+e.target.value)} className="w-full accent-emerald-500" />
            </div>
          </div>
        </div>

        {/* Routing decision card */}
        {routing?.best && (
          <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-2xl p-4 border border-emerald-200 shadow-lg animate-fade-in">
            <div className="text-xs font-bold text-emerald-600 mb-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Routing Decision
            </div>
            <p className="text-slate-800 text-sm">
              Recommended: <span className="font-bold text-emerald-600">{routing.best.zone.zone_id} · {routing.best.geo?.zone_name}</span>
              <span className="text-slate-500 ml-2">({routing.best.dist.toFixed(1)} km · score {routing.best.score.toFixed(1)})</span>
            </p>
            {routing.avoided && (
              <p className="text-slate-500 text-xs mt-1">
                Avoided: <span className="text-red-500 font-semibold">{routing.avoided.zone_id}</span> — CRITICAL zone with penalty {routing.avoided.routing_penalty}
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!routing && (
          <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl px-8 py-5 text-center border border-slate-200 shadow-xl">
              <p className="text-slate-800 text-sm font-bold">Select a driver location and click "Run Demo"</p>
              <p className="text-slate-500 text-xs mt-1.5">The router will rank chargers using grid penalty scores</p>
            </div>
          </div>
        )}
      </div>
    </DemoSection>
  );
};

export default Demo2Routing;

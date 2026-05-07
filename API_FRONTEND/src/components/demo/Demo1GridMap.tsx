// ============================================================
// Demo 1 — Live Grid Traffic Heatmap
// Endpoint: GET /api/deflect/routing
//
// Teaches developers how to overlay a zone-wise congestion
// heatmap on any mapping platform (Leaflet, Google, Ola Maps).
//
// Visualization:
//   - Polygon-based zone regions (not point markers)
//   - Gradient fill opacity based on routing_penalty
//   - Zone labels rendered as DivIcons at polygon centroids
//   - Legend with color scale
//   - Hover effect highlights zone in code panel
//   - CRITICAL zones pulse with glow animation
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip as LeafletTooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import DemoSection from './DemoSection';
import { fetchDeflectRouting, DEMO_KEY } from '../../lib/deflectApi';
import {
  zoneGeoLookup,
  ZONE_POLYGONS,
  type ZoneDeflectInfo,
} from '../../lib/mockData';

// ── Visual config ───────────────────────────────────────────

const STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  GREEN:    { fill: '#1D9E75', stroke: '#15775a' },
  AMBER:    { fill: '#F59E0B', stroke: '#b97708' },
  CRITICAL: { fill: '#EF4444', stroke: '#b91c1c' },
};

const FILL_OPACITY: Record<string, number> = {
  GREEN: 0.25, AMBER: 0.40, CRITICAL: 0.55,
};

// ── Integration-ready code snippet ──────────────────────────

const CODE = `import axios from 'axios';
import L from 'leaflet';

const API_BASE = 'https://voltaris-ai.onrender.com';
const API_KEY  = 'YOUR_API_KEY';

/**
 * Step 1 — Fetch the routing layer.
 * Returns an array of zones with congestion status and
 * routing penalties your navigation engine should apply.
 */
async function fetchDeflectLayer() {
  const { data } = await axios.get(
    \`\${API_BASE}/api/deflect/routing\`,
    { headers: { 'X-API-Key': API_KEY } }
  );
  return data;
  // {
  //   timestamp: "2026-05-07T10:30:00Z",
  //   deflect_layer: [
  //     {
  //       zone_id:  "Z01",
  //       status:   "CRITICAL",        // GREEN | AMBER | CRITICAL
  //       routing_penalty: 0.95,       // 0.0–1.0
  //       user_facing_message: "...",
  //       recommended_alternative_zone: "Z03"  // or null
  //     },
  //     ...
  //   ]
  // }
}

/**
 * Step 2 — Map status → colour for your polygons / markers.
 */
const STATUS_COLORS = {
  GREEN:    { fill: '#1D9E75', opacity: 0.25 },
  AMBER:    { fill: '#F59E0B', opacity: 0.40 },
  CRITICAL: { fill: '#EF4444', opacity: 0.55 },
};

/**
 * Step 3 — Render polygons on your map.
 * You supply zone boundaries from your own GIS database.
 * The API deliberately does NOT expose geometry — you
 * already have it if you're a mapping partner.
 */
function renderHeatmap(map, layer, zoneBoundaries) {
  layer.forEach(zone => {
    const bounds = zoneBoundaries[zone.zone_id];
    if (!bounds) return;

    const style = STATUS_COLORS[zone.status];
    const poly = L.polygon(bounds, {
      fillColor:   style.fill,
      fillOpacity: style.opacity,
      color:       style.fill,
      weight:      2,
    }).addTo(map);

    poly.bindTooltip(
      \`\${zone.zone_id} — \${zone.status}\\n\` +
      \`Penalty: \${zone.routing_penalty}\`,
      { sticky: true }
    );
  });
}

/**
 * Step 4 — Poll every 15 s to keep overlay live.
 * Server caches the layer for 30 s (TTL header).
 */
setInterval(async () => {
  const data = await fetchDeflectLayer();
  clearPolygons();
  renderHeatmap(map, data.deflect_layer, zoneBoundaries);
}, 15_000);`;

const REQUEST = `GET /api/deflect/routing HTTP/1.1
Host: api.gridwise.in
X-API-Key: ${DEMO_KEY}
Accept: application/json`;

// ─────────────────────────────────────────────────────────────

const Demo1GridMap = () => {
  const [zones, setZones] = useState<ZoneDeflectInfo[]>([]);
  const [responseJson, setResponseJson] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState(0);
  const [responseSize, setResponseSize] = useState('');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

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

  // Summary stats
  const stats = useMemo(() => {
    if (!zones.length) return null;
    const critical = zones.filter(z => z.status === 'CRITICAL').length;
    const amber = zones.filter(z => z.status === 'AMBER').length;
    const green = zones.filter(z => z.status === 'GREEN').length;
    return { critical, amber, green };
  }, [zones]);

  return (
    <DemoSection
      number={1}
      title="Live Grid Traffic Heatmap"
      subtitle="Overlay a zone-wise congestion heatmap on any mapping platform using the routing endpoint"
      method="GET"
      endpoint="/api/deflect/routing"
      autoRunIntervalSec={15}
      codeContent={CODE}
      requestContent={REQUEST}
      onRun={run}
      responseJson={responseJson}
      responseTimeMs={responseTime}
      responseSizeKb={responseSize}
      lastRunTime={lastRun}
      isLoading={loading}
      highlightedZone={hoveredZone}
    >
      <div className="relative h-full min-h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
        <MapContainer
          center={[12.94, 77.65]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
          />

          {/* ── Zone Polygons ────────────────────────── */}
          {zones.map(zone => {
            const poly = ZONE_POLYGONS[zone.zone_id];
            const geo = zoneGeoLookup[zone.zone_id];
            if (!poly || !geo) return null;

            const colors = STATUS_COLORS[zone.status];
            const isHovered = hoveredZone === zone.zone_id;
            const isCritical = zone.status === 'CRITICAL';

            return (
              <Polygon
                key={zone.zone_id}
                positions={poly}
                pathOptions={{
                  fillColor: colors.fill,
                  fillOpacity: isHovered
                    ? FILL_OPACITY[zone.status] + 0.15
                    : FILL_OPACITY[zone.status],
                  color: isHovered ? '#ffffff' : colors.stroke,
                  weight: isHovered ? 3 : 1.5,
                  opacity: 0.8,
                }}
                className={isCritical && !isHovered ? 'critical-polygon' : ''}
                eventHandlers={{
                  mouseover: () => setHoveredZone(zone.zone_id),
                  mouseout:  () => setHoveredZone(null),
                }}
              >
                <LeafletTooltip
                  direction="center"
                  permanent
                  className="zone-label"
                >
                  {zone.zone_id}
                </LeafletTooltip>

                {/* Interactive popup on click */}
                <Popup
                  offset={[0, -10]}
                  className="!p-0 !bg-transparent !border-0 !shadow-none"
                >
                  <div className="bg-white text-slate-800 rounded-xl px-4 py-3 min-w-[200px] shadow-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{geo.zone_name}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        zone.status === 'CRITICAL' ? 'bg-red-50 text-red-600' :
                        zone.status === 'AMBER' ? 'bg-amber-50 text-amber-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>{zone.status}</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <div>Routing Penalty: <span className="font-mono text-slate-800 font-bold">{zone.routing_penalty}</span></div>
                      {zone.recommended_alternative_zone && (
                        <div>Alt Zone: <span className="text-emerald-600 font-bold">{zone.recommended_alternative_zone}</span></div>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400 border-t border-slate-100 pt-2 italic">
                      {zone.user_facing_message}
                    </p>
                  </div>
                </Popup>
              </Polygon>
            );
          })}
        </MapContainer>

        {/* ── Legend ──────────────────────────────────── */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 border border-slate-200 shadow-md">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Congestion Level</div>
          <div className="flex items-center gap-1 mb-2">
            <div className="h-2.5 flex-1 rounded-sm" style={{ background: 'linear-gradient(to right, #1D9E75, #F59E0B, #EF4444)' }} />
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-500">
            <span>Low</span>
            <span>High</span>
          </div>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100">
            {[
              { label: 'GREEN', color: '#1D9E75', desc: 'penalty 0.0' },
              { label: 'AMBER', color: '#F59E0B', desc: 'penalty 0.4' },
              { label: 'CRITICAL', color: '#EF4444', desc: 'penalty 0.95' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color, opacity: 0.7 }} />
                <div className="text-[9px] text-slate-600">
                  <span className="font-bold">{item.label}</span>
                  <span className="text-slate-400 ml-1">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats badge ────────────────────────────── */}
        {stats && (
          <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 border border-slate-200 shadow-md animate-fade-in">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Zone Status</div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-lg font-black text-emerald-600">{stats.green}</div>
                <div className="text-[8px] text-slate-500 font-bold">GREEN</div>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="text-center">
                <div className="text-lg font-black text-amber-500">{stats.amber}</div>
                <div className="text-[8px] text-slate-500 font-bold">AMBER</div>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="text-center">
                <div className="text-lg font-black text-red-500">{stats.critical}</div>
                <div className="text-[8px] text-slate-500 font-bold">CRITICAL</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────────────── */}
        {zones.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl px-8 py-5 text-center border border-slate-200 shadow-xl">
              <p className="text-slate-800 text-sm font-bold">Click "Run Demo" to load the deflect layer</p>
              <p className="text-slate-500 text-xs mt-1.5">6 Bengaluru zones will render as polygon overlays</p>
            </div>
          </div>
        )}
      </div>
    </DemoSection>
  );
};

export default Demo1GridMap;

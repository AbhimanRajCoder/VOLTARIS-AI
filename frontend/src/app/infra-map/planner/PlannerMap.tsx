'use client';

import { useEffect, useRef } from 'react';
import { InfraSiteCandidate } from '@/lib/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PlannerMapProps {
  candidates: InfraSiteCandidate[];      // Ward-level best sites (for large markers)
  allCandidates: InfraSiteCandidate[];   // All sites (for EV charging point dots)
  zones?: any;
  selectedSite: InfraSiteCandidate | null;
  onSiteSelect: (site: InfraSiteCandidate | null) => void;
}

// Zone color palette
const ZONE_COLORS: Record<string, string> = {
  'Indiranagar': '#ef4444', // red-500
  'Koramangala': '#f97316', // orange-500
  'Whitefield': '#f59e0b',  // amber-500
  'HSR Layout': '#ea580c',  // orange-600
  'Jayanagar': '#dc2626',   // red-600
  'Malleshwaram': '#f97316',
  'Electronic City': '#ea580c',
  'Banashankari': '#f59e0b',
  'Rajajinagar': '#ef4444',
  'BTM Layout': '#dc2626',
  'Hebbal': '#f97316',
  'Yelahanka': '#f59e0b',
  'Yeshwanthpur': '#ea580c',
  'Basavanagudi': '#ef4444',
};

function getZoneColor(ward: string): string {
  if (ZONE_COLORS[ward]) return ZONE_COLORS[ward];
  let hash = 0;
  for (let i = 0; i < ward.length; i++) hash = ward.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// SVG for the EV charging pin icon
const evPinSvg = (color: string, size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" opacity="0.9"/>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="white" stroke-width="1.5"/>
    <path d="M13.5 7L10.5 11H12.5L11 15L14.5 10.5H12.2L13.5 7Z" fill="white"/>
  </svg>
`;

export default function PlannerMap({
  candidates,
  allCandidates,
  zones,
  selectedSite,
  onSiteSelect,
}: PlannerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const dotsRef = useRef<L.LayerGroup | null>(null);

  // ── Init Map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || mapRef.current) return;

    const styleId = 'planner-map-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes planner-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .planner-pulse { animation: planner-pulse 2s infinite; }
        .planner-zone-label { background: transparent !important; border: none !important; box-shadow: none !important; }
        .planner-tooltip { background: white; border: none; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 0; }
        .ev-pin-icon { background: transparent !important; border: none !important; }
      `;
      document.head.appendChild(style);
    }

    mapRef.current = L.map(containerRef.current, {
      center: [12.9716, 77.5946],
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(mapRef.current);

    zonesRef.current = L.layerGroup().addTo(mapRef.current);
    labelsRef.current = L.layerGroup().addTo(mapRef.current);
    dotsRef.current = L.layerGroup().addTo(mapRef.current);
    markersRef.current = L.layerGroup().addTo(mapRef.current);

    mapRef.current.on('click', () => onSiteSelect(null));

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render Zone Boundaries (borders only, no fill) ────────────────
  useEffect(() => {
    if (!mapRef.current || !zonesRef.current || !labelsRef.current || !zones) return;
    zonesRef.current.clearLayers();
    labelsRef.current.clearLayers();

    L.geoJSON(zones, {
      style: () => ({
        fillColor: 'transparent',
        fillOpacity: 0,
        color: '#cbd5e1',
        weight: 1.5,
        opacity: 0.4,
        dashArray: '6 4',
      }),
      onEachFeature: (feature, layer) => {
        const name = feature?.properties?.zone_name;

        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          const centroid = (layer as L.Polygon).getBounds().getCenter();
          L.marker(centroid, {
            icon: L.divIcon({
              html: `<div style="color:#94a3b8;font-size:10px;font-weight:700;padding:2px 6px;white-space:nowrap;text-transform:uppercase;letter-spacing:1px">${name}</div>`,
              className: 'planner-zone-label',
              iconSize: [0, 0],
            }),
            interactive: false,
          }).addTo(labelsRef.current!);
        }
      },
    }).addTo(zonesRef.current);
  }, [zones]);

  // ── Render All EV Charging Point Candidates ───────────────────────
  useEffect(() => {
    if (!mapRef.current || !dotsRef.current) return;
    dotsRef.current.clearLayers();

    allCandidates.forEach(site => {
      const score = site.composite_score;
      const pinColor = score >= 0.7 ? '#22c55e' : score >= 0.5 ? '#f59e0b' : '#94a3b8';
      const pinSize = 20;

      const icon = L.divIcon({
        html: evPinSvg(pinColor, pinSize),
        className: 'ev-pin-icon',
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize],
      });

      const marker = L.marker([site.lat, site.lon], { icon, zIndexOffset: 100 });

      marker.bindTooltip(`
        <div style="padding:10px;min-width:160px">
          <div style="font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">EV Charging Point</div>
          <div style="font-size:13px;font-weight:900;color:#1e293b">${site.ward_name}</div>
          <div style="font-size:10px;font-weight:600;color:#64748b;margin-top:2px;font-family:monospace">${site.site_id}</div>
          <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:11px">
            <span style="color:#64748b">Score</span>
            <b style="color:${pinColor}">${(score * 100).toFixed(0)}%</b>
          </div>
          <div style="margin-top:4px;display:flex;justify-content:space-between;font-size:11px">
            <span style="color:#64748b">Nearby Chargers</span>
            <b>${site.existing_chargers_500m}</b>
          </div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -pinSize],
        className: 'planner-tooltip',
        opacity: 1,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSiteSelect(site);
      });

      marker.addTo(dotsRef.current!);
    });
  }, [allCandidates, onSiteSelect]);

  // ── Render Ward-Level Priority Markers (large ranked circles) ─────
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    candidates.forEach((site, idx) => {
      const rank = idx + 1;
      const score = site.composite_score;
      const isSelected = selectedSite?.site_id === site.site_id;
      const color = getZoneColor(site.ward_name);

      const baseSize = 38 + (score * 20);
      const size = isSelected ? baseSize + 10 : baseSize;

      const html = `
        <div class="${rank <= 3 ? 'planner-pulse' : ''}" style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          opacity: ${isSelected ? 1 : 0.85};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: ${isSelected 
            ? `0 0 0 4px white, 0 0 0 6px ${color}, 0 8px 20px rgba(0,0,0,0.3)` 
            : `0 4px 12px rgba(0,0,0,0.25)`};
          cursor: pointer;
          transition: all 0.3s;
        " onmouseover="this.style.transform='scale(1.12)'" onmouseout="this.style.transform='scale(1)'">
          <div style="
            width: ${size - 10}px;
            height: ${size - 10}px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            line-height: 1;
          ">
            <span style="font-size:${rank <= 9 ? 14 : 12}px;font-weight:900;color:${color}">${rank}</span>
            <span style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">${(score * 100).toFixed(0)}%</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([site.lat, site.lon], {
        icon,
        zIndexOffset: isSelected ? 1000 : 500 - rank,
      });

      marker.bindTooltip(`
        <div style="padding:12px;min-width:220px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div>
              <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px">Rank #${rank} — Best EV Charging Site</div>
              <div style="font-size:15px;font-weight:900;color:#1e293b;margin-top:3px">${site.ward_name}</div>
            </div>
            <div style="font-size:22px;font-weight:900;color:${color}">${(score * 100).toFixed(0)}%</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
            <div><span style="color:#94a3b8">EV Demand:</span> <b>${(site.demand_score * 100).toFixed(0)}%</b></div>
            <div><span style="color:#94a3b8">Coverage Gap:</span> <b>${(site.gap_score * 100).toFixed(0)}%</b></div>
            <div><span style="color:#94a3b8">Grid Capacity:</span> <b>${(site.transformer_score * 100).toFixed(0)}%</b></div>
            <div><span style="color:#94a3b8">Road Access:</span> <b>${(site.access_score * 100).toFixed(0)}%</b></div>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:10px;color:#94a3b8">
            ⚡ Existing chargers within 500m: <b style="color:#1e293b">${site.existing_chargers_500m}</b>
          </div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -(size / 2 + 4)],
        className: 'planner-tooltip',
        opacity: 1,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSiteSelect(site);
      });

      marker.addTo(markersRef.current!);
    });
  }, [candidates, selectedSite, onSiteSelect]);

  // ── Fly to selected ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedSite) return;
    mapRef.current.flyTo([selectedSite.lat, selectedSite.lon], 14, { animate: true, duration: 1 });
  }, [selectedSite]);

  return <div ref={containerRef} className="w-full h-full" />;
}

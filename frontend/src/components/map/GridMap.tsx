'use client';

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { InfraSiteCandidate, ZoneDeflectInfo } from '@/lib/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GridMapProps {
  candidates: InfraSiteCandidate[];
  clusters: any; // FeatureCollection
  zones?: any; // FeatureCollection
  kdeGrid: any;
  showHeatmap: boolean;
  showSites: boolean;
  showClusters: boolean;
  onSiteSelect: (site: InfraSiteCandidate | null) => void;
  selectedSite: InfraSiteCandidate | null;
  onClusterSelect: (clusterId: number | null) => void;
  hoveredSiteId: string | null;

  // NEW props
  mode: 'planning' | 'demand';
  zoneDemandData?: Record<string, number>;   // zone_id → predicted_kw
  zoneCapacity?: Record<string, number>;     // zone_id → capacity_kw
  gridTrafficLayer?: ZoneDeflectInfo[];
  showGridTrafficLayer?: boolean;
}

export default function GridMap({
  candidates,
  clusters,
  zones,
  kdeGrid,
  showHeatmap,
  showSites,
  showClusters,
  onSiteSelect,
  selectedSite,
  onClusterSelect,
  hoveredSiteId,
  mode = 'planning',
  zoneDemandData,
  zoneCapacity,
  gridTrafficLayer = [],
  showGridTrafficLayer = true,
}: GridMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const clustersLayer = useRef<L.LayerGroup | null>(null);
  const zonesLayer = useRef<L.LayerGroup | null>(null);
  const labelsLayer = useRef<L.LayerGroup | null>(null);
  const heatLayer = useRef<any>(null);
  const legendControl = useRef<L.Control | null>(null);
  
  // Store pulse intervals for demand mode
  const pulseIntervals = useRef<NodeJS.Timeout[]>([]);

  // Zone-wise color palette
  const zoneColors: Record<string, string> = useMemo(() => ({
    'Indiranagar': '#3b82f6', // blue
    'Koramangala': '#8b5cf6', // purple
    'Whitefield': '#10b981',  // emerald
    'HSR Layout': '#f59e0b',  // amber
    'Jayanagar': '#ef4444',   // red
    'Malleshwaram': '#ec4899', // pink
    'Electronic City': '#06b6d4', // cyan
    'Banashankari': '#84cc16', // lime
    'Rajajinagar': '#f97316',  // orange
    'BTM Layout': '#6366f1',   // indigo
    'Hebbal': '#14b8a6',       // teal
    'Yelahanka': '#f43f5e',    // rose
    'Yeshwanthpur': '#8b5cf6', // violet
    'Basavanagudi': '#f97316', // orange
  }), []);

  const getZoneColor = useCallback((ward: string) => {
    if (zoneColors[ward]) return zoneColors[ward];
    // Deterministic color fallback for other wards
    let hash = 0;
    for (let i = 0; i < ward.length; i++) {
      hash = ward.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }, [zoneColors]);

  const deflectStatusMap = useMemo(() => {
    const mapByZone: Record<string, ZoneDeflectInfo> = {};
    gridTrafficLayer.forEach((row) => {
      mapByZone[row.zone_id] = row;
    });
    return mapByZone;
  }, [gridTrafficLayer]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).L = L;
      import('leaflet.heat').catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;
    
    // Inject CSS for pulse animation
    const styleId = 'map-pulse-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes candidate-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pulse-animation {
          animation: candidate-pulse 2s infinite;
        }
        .zone-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .custom-map-tooltip {
          background: white;
          border: none;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 0;
        }
      `;
      document.head.appendChild(style);
    }

    if (!map.current && mapContainer.current) {
      map.current = L.map(mapContainer.current, {
        center: [12.9716, 77.5946],
        zoom: 12,
        zoomControl: false // We'll add it in the bottom-right
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map.current);

      // Light theme tiles — CartoDB Voyager (clean, professional GIS style)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map.current);

      // Create Layer Groups
      zonesLayer.current = L.layerGroup().addTo(map.current);
      labelsLayer.current = L.layerGroup().addTo(map.current);
      markersLayer.current = L.layerGroup().addTo(map.current);
      clustersLayer.current = L.layerGroup().addTo(map.current);

      map.current.on('click', () => {
        onSiteSelect(null);
      });
      
      map.current.on('zoomend', () => {
        updateZoneLabelsVisibility();
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      pulseIntervals.current.forEach(clearInterval);
      pulseIntervals.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateZoneLabelsVisibility() {
    if (!map.current || !labelsLayer.current) return;
    const zoom = map.current.getZoom();
    if (mode === 'demand') {
      labelsLayer.current.addTo(map.current);
    } else {
      if (zoom >= 12) {
        labelsLayer.current.addTo(map.current);
      } else {
        map.current.removeLayer(labelsLayer.current);
      }
    }
  }

  // Demand Mode Legend
  useEffect(() => {
    if (!map.current) return;

    if (legendControl.current) {
      map.current.removeControl(legendControl.current);
      legendControl.current = null;
    }

    if (mode === 'demand') {
      const Legend = L.Control.extend({
        onAdd: function() {
          const div = L.DomUtil.create('div', 'info legend');
          div.style.backgroundColor = 'white';
          div.style.padding = '12px';
          div.style.borderRadius = '12px';
          div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          div.style.fontSize = '12px';
          div.style.fontWeight = 'bold';
          div.style.color = '#1e293b';
          div.style.display = 'flex';
          div.style.flexDirection = 'column';
          div.style.gap = '8px';
          
          div.innerHTML = `
            <div style="margin-bottom: 4px; text-transform: uppercase; font-size: 10px; color: #64748b; letter-spacing: 1px;">Load Level</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 12px; height: 12px; background: #22c55e; border-radius: 3px;"></div>
              <span>Under 50% Safe</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 12px; height: 12px; background: #f59e0b; border-radius: 3px;"></div>
              <span>50-70% Moderate</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px;"></div>
              <span>70-85% At Risk</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px; border: 2px solid white; outline: 2px solid #ef4444;"></div>
              <span>Over 85% Critical</span>
            </div>
          `;
          return div;
        }
      });
      legendControl.current = new Legend({ position: 'bottomleft' });
      legendControl.current.addTo(map.current);
    }
  }, [mode]);

  // Update Zones & Labels Layer
  useEffect(() => {
    if (!map.current || !zonesLayer.current || !labelsLayer.current || !zones) return;

    // Clear previous intervals
    pulseIntervals.current.forEach(clearInterval);
    pulseIntervals.current = [];

    zonesLayer.current.clearLayers();
    labelsLayer.current.clearLayers();

    L.geoJSON(zones, {
      style: (feature) => {
        const zoneId = feature?.properties?.zone_id;
        const zoneName = feature?.properties?.zone_name;
        
        if (mode === 'demand' && showGridTrafficLayer && deflectStatusMap[zoneId]) {
          const status = deflectStatusMap[zoneId].status;
          if (status === 'CRITICAL') {
            return {
              fillColor: '#ef4444',
              fillOpacity: 0.45,
              color: '#dc2626',
              weight: 3.5,
              opacity: 0.95
            };
          }
          if (status === 'AMBER') {
            return {
              fillColor: '#facc15',
              fillOpacity: 0.3,
              color: '#ca8a04',
              weight: 2.5,
              opacity: 0.85
            };
          }
          return {
            fillColor: '#22c55e',
            fillOpacity: 0.25,
            color: '#16a34a',
            weight: 2.5,
            opacity: 0.8
          };
        } else if (mode === 'demand' && zoneDemandData && zoneCapacity) {
          const load = zoneDemandData[zoneId] || 0;
          const cap = zoneCapacity[zoneId] || 1000;
          const pct = load / cap;
          
          let color = '#22c55e';
          let opacity = 0.25;
          
          if (pct > 0.85) { color = '#ef4444'; opacity = 0.65; }
          else if (pct > 0.7) { color = '#ef4444'; opacity = 0.45; }
          else if (pct > 0.5) { color = '#f59e0b'; opacity = 0.35; }
          
          return {
            fillColor: color,
            fillOpacity: opacity,
            color: color,
            weight: 2.5,
            opacity: 0.8
          };
        } else {
          return {
            fillColor: 'transparent',
            fillOpacity: 0,
            color: 'transparent',
            weight: 0,
            opacity: 0
          };
        }
      },
      onEachFeature: (feature, layer) => {
        const zoneId = feature?.properties?.zone_id;
        const zoneName = feature?.properties?.zone_name;
        const color = getZoneColor(zoneName);

        // Add Centroid Labels
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          // Calculate centroid (simplified for display)
          const bounds = (layer as L.Polygon).getBounds();
          const centroid = bounds.getCenter();
          
          const labelHtml = `
            <div style="
              background: ${color}cc;
              color: white;
              font-size: 11px;
              font-weight: 600;
              padding: 4px 8px;
              border-radius: 4px;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">${zoneName}</div>
          `;
          
          L.marker(centroid, {
            icon: L.divIcon({
              html: labelHtml,
              className: 'zone-label',
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            }),
            interactive: false
          }).addTo(labelsLayer.current!);
        }

        // Tooltips
        if (mode === 'demand' && showGridTrafficLayer && deflectStatusMap[zoneId]) {
          const status = deflectStatusMap[zoneId].status;
          const altZone = deflectStatusMap[zoneId].recommended_alternative_zone || '-';
          const penalty = deflectStatusMap[zoneId].routing_penalty;
          const popupHtml = `
            <div style="padding: 12px; min-width: 220px;">
              <div style="font-size: 14px; font-weight: 900; color: #1e293b;">Zone ${zoneId} — ${
                status === 'CRITICAL' ? '95% Capacity' : status === 'AMBER' ? '78% Capacity' : '52% Capacity'
              }</div>
              <div style="font-size: 11px; margin-top: 8px; color: #334155;">
                Recommended alternative: ${altZone} (HSR Layout)
              </div>
              <div style="font-size: 11px; margin-top: 4px; color: #334155;">
                Webhook sent to: RWA_402, RWA_891
              </div>
              <div style="font-size: 11px; margin-top: 4px; color: #334155;">
                Routing penalty: ${penalty}
              </div>
              <div style="font-size: 11px; margin-top: 6px; color: #2563eb; font-weight: 700;">
                View Deflection Details →
              </div>
            </div>
          `;
          layer.bindTooltip(popupHtml, { sticky: true, className: 'custom-map-tooltip', opacity: 1 });
          if (status === 'CRITICAL') {
            layer.on('click', () => layer.bindPopup(popupHtml).openPopup());
          }
        } else if (mode === 'demand' && zoneDemandData && zoneCapacity) {
          const load = Math.round(zoneDemandData[zoneId] || 0);
          const cap = zoneCapacity[zoneId] || 1000;
          const pct = Math.round((load / cap) * 100);
          const evShare = Math.round(20 + (load % 15)); // Simulated EV share
          
          let statusColor = '#22c55e';
          let statusText = 'OPTIMAL';
          if (pct > 85) { statusColor = '#ef4444'; statusText = '⚠ CRITICAL'; }
          else if (pct > 70) { statusColor = '#ef4444'; statusText = '⚠ AT RISK'; }
          else if (pct > 50) { statusColor = '#f59e0b'; statusText = 'MODERATE'; }

          const tooltipHtml = `
            <div style="padding: 12px; min-width: 180px;">
              <div style="font-size: 14px; font-weight: 900; color: #1e293b; margin-bottom: 8px;">${zoneName} (${zoneId})</div>
              <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                <div style="width: ${Math.min(100, pct)}%; height: 100%; background: ${statusColor}; transition: width 1s;"></div>
              </div>
              <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">${pct}% Load</div>
              <div style="font-size: 10px; color: #64748b; font-weight: bold; margin-bottom: 2px;">Current: ${load} kW / ${cap} kW</div>
              <div style="font-size: 10px; color: #64748b; font-weight: bold; margin-bottom: 8px;">EV Share: ${evShare}%</div>
              <div style="font-size: 10px; font-weight: 900; color: ${statusColor}; letter-spacing: 1px;">${statusText}</div>
            </div>
          `;

          layer.bindTooltip(tooltipHtml, { sticky: true, className: 'custom-map-tooltip', opacity: 1 });

          // Pulse critical zones
          if (pct > 85) {
            let visible = true;
            const interval = setInterval(() => {
              visible = !visible;
              (layer as L.Path).setStyle({
                fillOpacity: visible ? 0.65 : 0.45
              });
            }, 1000);
            pulseIntervals.current.push(interval);
          }
        } else {
          layer.bindTooltip(`
            <div style="background: white; padding: 8px 12px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-left: 4px solid ${color};">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Network Zone</div>
              <div style="font-size: 14px; font-weight: 900; color: #1e293b; margin-top: 2px;">${zoneName}</div>
            </div>
          `, { sticky: true, className: 'zone-tooltip', opacity: 1 });
        }
        
        layer.on({
          mouseover: (e) => {
            const l = e.target;
            const currentStyle = l.options;
            l.setStyle({
              fillOpacity: (currentStyle.fillOpacity || 0) + 0.1,
              weight: 4,
              color: '#ffffff'
            });
            l.bringToFront();
          },
          mouseout: (e) => {
            const l = e.target;
            const zoneId = feature?.properties?.zone_id;
            const zoneName = feature?.properties?.zone_name;
            
            // Re-calculate original style
            let color = getZoneColor(zoneName);
            let opacity = 0.35;

            if (mode === 'demand' && showGridTrafficLayer && deflectStatusMap[zoneId]) {
              const status = deflectStatusMap[zoneId].status;
              if (status === 'CRITICAL') {
                color = '#dc2626';
                opacity = 0.45;
              } else if (status === 'AMBER') {
                color = '#ca8a04';
                opacity = 0.3;
              } else {
                color = '#16a34a';
                opacity = 0.25;
              }
            } else if (mode === 'demand' && zoneDemandData && zoneCapacity) {
              const load = zoneDemandData[zoneId] || 0;
              const cap = zoneCapacity[zoneId] || 1000;
              const pct = load / cap;
              color = '#22c55e';
              opacity = 0.25;
              if (pct > 0.85) { color = '#ef4444'; opacity = 0.65; }
              else if (pct > 0.7) { color = '#ef4444'; opacity = 0.45; }
              else if (pct > 0.5) { color = '#f59e0b'; opacity = 0.35; }
            }

            l.setStyle({
              fillOpacity: opacity,
              weight: 2.5,
              color: color
            });
          },
          click: (e) => {
            map.current?.flyToBounds(e.target.getBounds(), {
              padding: [50, 50],
              duration: 1.5,
              easeLinearity: 0.25
            });
          }
        });
      }
    }).addTo(zonesLayer.current);

    updateZoneLabelsVisibility();
  }, [zones, mode, zoneDemandData, zoneCapacity, deflectStatusMap, showGridTrafficLayer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize heatmap points for performance
  const heatPoints = useMemo(() => {
    if (!kdeGrid?.matrix || !kdeGrid?.bbox) return [];
    const { bbox, resolution, matrix } = kdeGrid;
    const points: [number, number, number][] = [];
    const lonStep = (bbox[2] - bbox[0]) / resolution;
    const latStep = (bbox[3] - bbox[1]) / resolution;
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const density = matrix[i][j];
        if (density > 0.01) {
          points.push([
            bbox[1] + (j * latStep) + (latStep / 2),
            bbox[0] + (i * lonStep) + (lonStep / 2),
            density
          ]);
        }
      }
    }
    return points;
  }, [kdeGrid]);

  // Update Heatmap
  useEffect(() => {
    if (!map.current || typeof window === 'undefined') return;

    if (heatLayer.current) {
      map.current.removeLayer(heatLayer.current);
      heatLayer.current = null;
    }

    // Determine which points to use for heatmap
    let points: [number, number, number][] = [];
    let gradient: Record<string, string> = {
      '0.0': 'rgba(255, 255, 255, 0)',
      '0.2': 'rgba(251, 191, 36, 0.5)', // amber-400
      '0.4': 'rgba(245, 158, 11, 0.8)', // amber-500
      '0.6': 'rgba(234, 88, 12, 0.9)',  // orange-600
      '0.8': 'rgba(220, 38, 38, 1)',    // red-600
      '1.0': 'rgba(153, 27, 27, 1)'     // red-800
    };

    if (showHeatmap && heatPoints.length > 0) {
      points = heatPoints;
    } else if (showClusters && clusters && clusters.features) {
      points = clusters.features.map((f: any) => [
        f.geometry.coordinates[1],
        f.geometry.coordinates[0],
        0.8 // Intensity
      ]);
      gradient = {
        '0.4': 'rgba(251, 191, 36, 0.2)', // amber
        '0.7': 'rgba(234, 88, 12, 0.4)',  // orange
        '1.0': 'rgba(220, 38, 38, 0.6)'   // red
      };
    }

    if (points.length > 0) {
      const heatLayerFn = (L as any).heatLayer;
      
      if (heatLayerFn) {
        heatLayer.current = heatLayerFn(points, {
          radius: showHeatmap ? 60 : 100,
          blur: showHeatmap ? 20 : 40,
          maxZoom: 14,
          max: 1.0,
          gradient: gradient
        }).addTo(map.current);
      }
    }
  }, [heatPoints, showHeatmap, showClusters, clusters, mode]);

  // Update Markers
  useEffect(() => {
    if (!map.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();

    if (mode === 'demand') return;

    if (showSites && candidates) {
      candidates.forEach((site) => {
        const isHovered = hoveredSiteId === site.site_id;
        const isSelected = selectedSite?.site_id === site.site_id;
        
        let dotColor = '#888888';
        if (site.composite_score >= 0.7) dotColor = '#00d4aa';
        else if (site.composite_score >= 0.5) dotColor = '#f59e0b';
        
        let dotSize = 6;
        if (site.composite_rank <= 5) dotSize = 10;
        else if (site.composite_rank <= 20) dotSize = 8;

        const isPulse = site.composite_rank <= 5;

        // UX: Small dots with interactive pulses on selection/hover
        const html = `
          <div class="${isPulse ? 'pulse-animation' : ''}" style="
            width: ${isSelected || isHovered ? (dotSize + 6) + 'px' : dotSize + 'px'};
            height: ${isSelected || isHovered ? (dotSize + 6) + 'px' : dotSize + 'px'};
            background: ${dotColor};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 ${isSelected || isHovered ? '4px' : '0px'} ${dotColor}44, 0 2px 4px rgba(0,0,0,0.3);
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
          "></div>
        `;

        const icon = L.divIcon({
          html,
          className: 'candidate-dot',
          iconSize: [dotSize + 6, dotSize + 6],
          iconAnchor: [(dotSize + 6)/2, (dotSize + 6)/2]
        });

        const marker = L.marker([site.lat, site.lon], { 
          icon,
          zIndexOffset: isSelected || isHovered ? 1000 : 0 
        });

        marker.bindTooltip(`
          <div style="padding: 12px; min-width: 160px;">
            <div style="font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Rank #${site.composite_rank}</div>
            <div style="font-size: 14px; font-weight: 900; color: #1e293b; margin-bottom: 8px;">CAND-${site.site_id.split('-').pop()} · ${site.ward_name}</div>
            <div style="display: flex; gap: 8px; font-size: 11px; font-weight: bold;">
              <span>Score: <span style="color: ${dotColor};">${(site.composite_score * 100).toFixed(0)}%</span></span>
              <span style="color: #cbd5e1;">|</span>
              <span>Rank: #${site.composite_rank} of ${candidates.length}</span>
            </div>
          </div>
        `, { 
          direction: 'top', 
          offset: [0, -10],
          className: 'custom-map-tooltip',
          opacity: 1
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSiteSelect(site);
        });

        marker.addTo(markersLayer.current!);
      });
    }
  }, [candidates, showSites, hoveredSiteId, selectedSite, onSiteSelect, mode]);

  // Update Clusters
  useEffect(() => {
    if (!map.current || !clustersLayer.current) return;

    clustersLayer.current.clearLayers();

    if (mode === 'demand') return;

    if (showClusters && clusters && clusters.features) {
      clusters.features.forEach((f: any, idx: number) => {
        const coords = f.geometry.coordinates; // [lon, lat]
        const ward = f.properties.ward_name;
        const color = getZoneColor(ward);
        
        const html = `
          <div style="position: relative; width: 48px; height: 48px; display: flex; items-center; justify-content: center;">
            <div style="position: absolute; width: 48px; height: 48px; border: 1px dashed ${color}66; border-radius: 50%;"></div>
            <div style="
              width: 44px;
              height: 44px;
              background: ${color};
              opacity: 0.9;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              cursor: pointer;
              transition: all 0.3s;
              z-index: 2;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
              <div style="
                width: 32px;
                height: 32px;
                background: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: ${color};
                font-weight: 800;
                font-size: 14px;
              ">
                ${idx + 1}
              </div>
            </div>
            <div style="position: absolute; bottom: -18px; width: 100%; text-align: center; font-size: 10px; font-weight: 800; color: ${color}; text-transform: uppercase; white-space: nowrap; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
              ${idx === 0 ? 'Top zone' : 'Zone ' + (idx + 1)}
            </div>
          </div>
        `;

        const icon = L.divIcon({
          html: html,
          className: '',
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });

        const marker = L.marker([coords[1], coords[0]], { icon });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onClusterSelect(f.properties.cluster_id);
          map.current?.flyTo([coords[1], coords[0]], 13, { animate: true, duration: 1 });
        });

        marker.addTo(clustersLayer.current!);
      });
    }
  }, [clusters, showClusters, onClusterSelect, mode, getZoneColor]);

  // Handle external flyTo from list hover/selection
  useEffect(() => {
    if (!map.current) return;
    
    if (selectedSite) {
      map.current.flyTo([selectedSite.lat, selectedSite.lon], 15, { animate: true, duration: 1 });
    }
  }, [selectedSite]);

  return (
    <div className="w-full h-full absolute inset-0 z-0">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

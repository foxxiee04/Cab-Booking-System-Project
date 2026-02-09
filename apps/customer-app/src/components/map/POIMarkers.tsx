import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { mapApi, POI } from '../../api/map.api';

// ── POI icon configuration ──────────────────────────────────────────────────
const POI_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  restaurant:  { emoji: '🍽️', color: '#E53935', label: 'Nhà hàng' },
  cafe:        { emoji: '☕',  color: '#6D4C41', label: 'Quán cà phê' },
  hospital:    { emoji: '🏥', color: '#1E88E5', label: 'Bệnh viện' },
  gas_station: { emoji: '⛽',  color: '#FB8C00', label: 'Trạm xăng' },
  hotel:       { emoji: '🏨', color: '#8E24AA', label: 'Khách sạn' },
  tourist:     { emoji: '🗺️', color: '#00897B', label: 'Điểm du lịch' },
  bus_station: { emoji: '🚌', color: '#3949AB', label: 'Trạm xe buýt' },
  school:      { emoji: '🏫', color: '#43A047', label: 'Trường học' },
  university:  { emoji: '🎓', color: '#00ACC1', label: 'Đại học' },
  bank:        { emoji: '🏦', color: '#546E7A', label: 'Ngân hàng' },
  pharmacy:    { emoji: '💊', color: '#D81B60', label: 'Nhà thuốc' },
  supermarket: { emoji: '🛒', color: '#F4511E', label: 'Siêu thị' },
  park:        { emoji: '🌳', color: '#2E7D32', label: 'Công viên' },
  other:       { emoji: '📍', color: '#757575', label: 'Khác' },
};

/**
 * Create a styled teardrop-shaped marker icon.
 */
function createPOIIcon(type: string): L.DivIcon {
  const cfg = POI_CONFIG[type] || POI_CONFIG.other;
  return L.divIcon({
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:36px;height:36px;
        border-radius:50% 50% 50% 0;
        background:${cfg.color};
        transform:rotate(-45deg);
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        border:2px solid white;
      ">
        <span style="transform:rotate(45deg);font-size:18px;line-height:1;">${cfg.emoji}</span>
      </div>
    `,
    className: 'poi-custom-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

// Pre-create & cache icons
const iconCache: Record<string, L.DivIcon> = {};
function getIcon(type: string): L.DivIcon {
  if (!iconCache[type]) iconCache[type] = createPOIIcon(type);
  return iconCache[type];
}

// ── Cluster icon factory ────────────────────────────────────────────────────
function createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  let size = 36, bg = '#1976D2';
  if (count > 20)      { size = 48; bg = '#C62828'; }
  else if (count > 10) { size = 42; bg = '#E65100'; }

  return L.divIcon({
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};color:white;font-weight:700;font-size:14px;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);border:3px solid white;
    ">${count}</div>`,
    className: 'poi-cluster-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Constants ───────────────────────────────────────────────────────────────
const MIN_ZOOM_FOR_POIS = 13;
const DEBOUNCE_MS = 800;
const MIN_MOVE_DEG = 0.005; // ~500 m

const DEFAULT_TYPES = [
  'restaurant', 'cafe', 'hospital', 'gas_station', 'hotel',
  'tourist', 'bus_station', 'school', 'university', 'bank',
  'pharmacy', 'supermarket', 'park',
];

interface POIMarkersProps {
  /** Which POI types to show. Default: all */
  types?: string[];
  /** Fixed search radius in metres (auto from viewport if omitted) */
  radius?: number;
}

/**
 * POIMarkers — fetches from backend (Overpass + Redis cache),
 * clusters markers, and reloads on significant map movement.
 */
const POIMarkers: React.FC<POIMarkersProps> = ({
  types = DEFAULT_TYPES,
  radius,
}) => {
  const map = useMap();
  const [pois, setPois] = useState<POI[]>([]);
  const [poiApiAvailable, setPoiApiAvailable] = useState(true);
  const lastFetchRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPOIs = useCallback(async () => {
    if (!poiApiAvailable) return; // Skip if API not available
    
    const center = map.getCenter();
    const zoom = map.getZoom();

    if (zoom < MIN_ZOOM_FOR_POIS) { setPois([]); return; }

    const last = lastFetchRef.current;
    if (last) {
      const dLat = Math.abs(center.lat - last.lat);
      const dLng = Math.abs(center.lng - last.lng);
      if (dLat < MIN_MOVE_DEG && dLng < MIN_MOVE_DEG && zoom === last.zoom) return;
    }

    let searchRadius = radius;
    if (!searchRadius) {
      const bounds = map.getBounds();
      searchRadius = Math.min(map.distance(bounds.getNorthEast(), bounds.getSouthWest()) / 2, 5000);
      searchRadius = Math.max(searchRadius, 500);
    }

    lastFetchRef.current = { lat: center.lat, lng: center.lng, zoom };

    try {
      const response = await mapApi.getPOIs({
        lat: center.lat, lng: center.lng,
        radius: Math.round(searchRadius),
        types,
      });
      setPois(response.data?.data?.pois || []);
    } catch (error: any) {
      // If API endpoint not found (404), disable future POI loading
      if (error.response?.status === 404) {
        console.warn('POI API endpoint not available - disabling POI markers');
        setPoiApiAvailable(false);
        setPois([]);
      } else {
        console.warn('Failed to fetch POIs:', error.message);
      }
    }
  }, [map, types, radius, poiApiAvailable]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPOIs, DEBOUNCE_MS);
  }, [fetchPOIs]);

  useMapEvents({ moveend: debouncedFetch, zoomend: debouncedFetch });

  useEffect(() => {
    fetchPOIs();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={60}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      iconCreateFunction={createClusterIcon}
      animate
      disableClusteringAtZoom={17}
    >
      {pois.map((poi) => {
        const cfg = POI_CONFIG[poi.type] || POI_CONFIG.other;
        return (
          <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={getIcon(poi.type)}>
            <Popup minWidth={180} maxWidth={260}>
              <div style={{ lineHeight: 1.5 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#212121', marginBottom: 4 }}>
                  {cfg.emoji} {poi.name}
                </div>
                <div style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                  backgroundColor: cfg.color + '20', color: cfg.color,
                  fontSize: 12, fontWeight: 500, marginBottom: 4,
                }}>
                  {cfg.label}
                </div>
                {poi.address && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    📍 {poi.address}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
};

export default React.memo(POIMarkers);

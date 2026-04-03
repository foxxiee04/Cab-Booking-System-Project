import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../styles/map.css';
import { Location } from '../../types';
import POIMarkers from './POIMarkers';

// Fix Leaflet default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  center: Location;
  zoom?: number;
  height?: string;
  children?: React.ReactNode;
  onMapClick?: (location: Location) => void;
}

// Component to handle map events
const MapEventHandler: React.FC<{ onMapClick?: (location: Location) => void }> = ({
  onMapClick,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!onMapClick) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);

  return null;
};

// ── Vietnam Sovereignty Islands ────────────────────────────────────────────────
// Marks Hoàng Sa and Trường Sa archipelagos with Vietnamese labels.
// Only visible between zoom 5 and 10 (country / regional level).

const ISLAND_ICON_CACHE = new Map<string, L.DivIcon>();

function makeIslandIcon(name: string): L.DivIcon {
  if (ISLAND_ICON_CACHE.has(name)) return ISLAND_ICON_CACHE.get(name)!;
  const icon = L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="width:9px;height:9px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
      <div style="background:rgba(220,38,38,0.9);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.35);">${name}</div>
    </div>`,
    className: 'vn-island-icon',
    iconSize: [64, 30],
    iconAnchor: [32, 5],
  });
  ISLAND_ICON_CACHE.set(name, icon);
  return icon;
}

const VIETNAM_ISLANDS_DATA = [
  { name: 'Hoàng Sa', fullName: 'Quần đảo Hoàng Sa (Việt Nam)', lat: 16.5, lng: 112.0 },
  { name: 'Trường Sa', fullName: 'Quần đảo Trường Sa (Việt Nam)', lat: 10.0, lng: 114.5 },
];

// ── HCMC Landmark Markers ──────────────────────────────────────────────────
// Static, well-known landmarks in Hồ Chí Minh City.
// Shown only at zoom ≥ 12 (city level). All coordinates verified 2026.
//
// Administrative note (2026): Thủ Đức became a TP. trực thuộc TP.HCM in 2021;
// Bình Chánh, Nhà Bè, Hóc Môn, Củ Chi, Cần Giờ remain huyện.

const HCMC_LANDMARKS = [
  // Q1 / trung tâm
  { id: 'benthanh',    name: 'Chợ Bến Thành',            emoji: '🏛️', lat: 10.7726, lng: 106.6980, note: 'Biểu tượng TP.HCM' },
  { id: 'dinhDocLap', name: 'Dinh Độc Lập',              emoji: '🏛️', lat: 10.7793, lng: 106.6957, note: 'Di tích lịch sử quốc gia' },
  { id: 'bcci',       name: 'Bưu điện Trung Tâm',        emoji: '📮', lat: 10.7800, lng: 106.6990, note: '1886 — kiến trúc Pháp' },
  { id: 'nguyenhue',  name: 'Phố đi bộ Nguyễn Huệ',     emoji: '🚶', lat: 10.7736, lng: 106.7040, note: 'Trung tâm Q.1' },
  // Sân bay & ga tàu
  { id: 'tsn',        name: 'Sân bay Tân Sơn Nhất',      emoji: '✈️', lat: 10.8185, lng: 106.6588, note: 'Quận Tân Bình' },
  { id: 'saigongare', name: 'Ga Sài Gòn',                emoji: '🚉', lat: 10.7814, lng: 106.6801, note: 'Q.3' },
  // Khu đô thị & điểm nổi bật
  { id: 'landmark81', name: 'Landmark 81',               emoji: '🏙️', lat: 10.7949, lng: 106.7219, note: 'Tòa nhà cao nhất VN — Bình Thạnh' },
  { id: 'phumyhung',  name: 'Phú Mỹ Hưng',              emoji: '🌇', lat: 10.7294, lng: 106.7187, note: 'Khu đô thị Q.7' },
  { id: 'thuduc',     name: 'TP. Thủ Đức',               emoji: '🏘️', lat: 10.8495, lng: 106.7718, note: 'Thành phố trực thuộc TP.HCM (2021)' },
  // Chợ đầu mối & trung tâm thương mại
  { id: 'chobinh',    name: 'Chợ Bình Tây',              emoji: '🛍️', lat: 10.7519, lng: 106.6450, note: 'Chợ lớn — Q.6' },
];

const landmarkIconCache = new Map<string, L.DivIcon>();

function makeLandmarkIcon(emoji: string): L.DivIcon {
  if (landmarkIconCache.has(emoji)) return landmarkIconCache.get(emoji)!;
  const ic = L.divIcon({
    html: `<div style="
        display:flex;align-items:center;justify-content:center;
        width:32px;height:32px;border-radius:50%;
        background:rgba(255,255,255,0.92);
        box-shadow:0 2px 6px rgba(0,0,0,0.28);
        border:2px solid #ef4444;
        font-size:17px;line-height:1;">
      ${emoji}
    </div>`,
    className: 'hcmc-landmark-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
  landmarkIconCache.set(emoji, ic);
  return ic;
}

const HCMCLandmarksLayer: React.FC = () => {
  const [zoom, setZoom] = React.useState<number>(13);
  useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) });

  if (zoom < 12) return null;

  return (
    <>
      {HCMC_LANDMARKS.map((lm) => (
        <Marker
          key={lm.id}
          position={[lm.lat, lm.lng]}
          icon={makeLandmarkIcon(lm.emoji)}
          zIndexOffset={50}
        >
          <Popup>
            <strong style={{ fontSize: 13 }}>{lm.emoji} {lm.name}</strong>
            {lm.note && <><br /><span style={{ fontSize: 11, color: '#555' }}>{lm.note}</span></>}
          </Popup>
        </Marker>
      ))}
    </>
  );
};

const VietnamIslandsLayer: React.FC = () => {
  const [zoom, setZoom] = React.useState<number>(13);
  useMapEvents({
    zoomend: (e) => setZoom(e.target.getZoom()),
  });

  if (zoom < 5 || zoom > 10) return null;

  return (
    <>
      {VIETNAM_ISLANDS_DATA.map((island) => (
        <Marker
          key={island.name}
          position={[island.lat, island.lng]}
          icon={makeIslandIcon(island.name)}
          interactive={true}
          zIndexOffset={-100}
        >
          <Popup>
            <strong>{island.fullName}</strong>
            <br />
            <span style={{ fontSize: 12, color: '#dc2626' }}>🇻🇳 Lãnh thổ Việt Nam</span>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

// ── MapCenter (optimized) ───────────────────────────────────────────────────
// Only update map view if center changes by more than 100 meters
export const MapCenter: React.FC<{ center: Location; zoom?: number }> = React.memo(
  ({ center, zoom }) => {
    const map = useMap();
    const prevCenterRef = React.useRef<Location>(center);

    useEffect(() => {
      if (!center) return;

      // Calculate distance from previous center
      const prevCenter = prevCenterRef.current;
      if (prevCenter) {
        const distance = map.distance(
          [prevCenter.lat, prevCenter.lng],
          [center.lat, center.lng]
        );

        // Only update if moved more than 100 meters to avoid jittery behavior
        if (distance < 100 && !zoom) {
          return;
        }
      }

      prevCenterRef.current = center;
      map.setView([center.lat, center.lng], zoom || map.getZoom(), {
        animate: true,
        duration: 0.5,
      });
    }, [center.lat, center.lng, zoom, map]);

    return null;
  },
  (prev, next) => {
    // Custom comparison: only re-render if center changed significantly
    return (
      prev.center.lat === next.center.lat &&
      prev.center.lng === next.center.lng &&
      prev.zoom === next.zoom
    );
  }
);

export const MapView: React.FC<MapViewProps> = React.memo(
  ({ center, zoom = 13, height = '100%', children, onMapClick }) => {
    // Memoize map center to prevent unnecessary re-renders
    const mapCenter = useMemo(
      () => [center.lat, center.lng] as [number, number],
      [center.lat, center.lng]
    );

    return (
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height, width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
        // Disable attribution prefix for cleaner look
        attributionControl={true}
      >
        <MapCenter center={center} zoom={zoom} />
        {/* OpenStreetMap Standard — freshest Vietnam data, incl. latest district mergers */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          updateWhenIdle={false}
          keepBuffer={2}
        />

        <MapEventHandler onMapClick={onMapClick} />

        {/* Vietnam sovereignty islands — Hoàng Sa & Trường Sa (shown at zoom 5–10) */}
        <VietnamIslandsLayer />

        {/* HCMC static landmark markers (shown at zoom ≥ 12) */}
        <HCMCLandmarksLayer />

        {/* POI markers — fetches from backend API */}
        <POIMarkers />

        {children}
      </MapContainer>
    );
  },
  (prev, next) => {
    // Custom comparison for shallow equality
    return (
      prev.center.lat === next.center.lat &&
      prev.center.lng === next.center.lng &&
      prev.zoom === next.zoom &&
      prev.height === next.height &&
      prev.children === next.children
    );
  }
);

export default MapView;

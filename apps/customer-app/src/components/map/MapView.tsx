import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Location } from '../../types';
import POIMarkers from './POIMarkers';
import 'leaflet/dist/leaflet.css';
import '../../styles/map.css';

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

// Component to handle map centering with optimization
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
        {/* CartoDB Voyager — colorful, readable, free, great for Vietnam */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={20}
          updateWhenIdle={false}
          keepBuffer={2}
        />

        <MapEventHandler onMapClick={onMapClick} />

        {/* POI markers with clustering — fetches from backend API */}
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

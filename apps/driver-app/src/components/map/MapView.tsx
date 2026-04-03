import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import POIMarkers from './POIMarkers';
import 'leaflet/dist/leaflet.css';
import '../../styles/map.css';
import { Location } from '../../types';

interface MapViewProps {
  center: Location;
  zoom?: number;
  height?: string;
  children?: React.ReactNode;
}

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Component to center map programmatically
const MapCenter: React.FC<{ center: Location; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
};

const MapView: React.FC<MapViewProps> = ({
  center,
  zoom = 13,
  height = '100%',
  children,
}) => {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height, width: '100%' }}
      zoomControl={true}
    >
      {/* OpenStreetMap Standard — freshest Vietnam data, incl. latest district mergers */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <MapCenter center={center} zoom={zoom} />
      
      {/* POI markers with clustering — fetches from backend API */}
      <POIMarkers />
      
      {children}
    </MapContainer>
  );
};

export default MapView;

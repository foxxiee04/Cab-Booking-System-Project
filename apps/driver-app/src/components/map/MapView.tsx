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
      {/* CartoDB Voyager — colorful, readable, free */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={20}
      />
      <MapCenter center={center} zoom={zoom} />
      
      {/* POI markers with clustering — fetches from backend API */}
      <POIMarkers />
      
      {children}
    </MapContainer>
  );
};

export default MapView;

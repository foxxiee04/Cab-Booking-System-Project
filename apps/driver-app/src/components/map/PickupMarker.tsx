import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Location } from '../../types';

interface PickupMarkerProps {
  location: Location;
}

// Custom green pickup marker
const pickupIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#4CAF50" stroke="white" stroke-width="3"/>
      <circle cx="20" cy="20" r="6" fill="white"/>
    </svg>
  `)}`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const PickupMarker: React.FC<PickupMarkerProps> = ({ location }) => {
  return (
    <Marker position={[location.lat, location.lng]} icon={pickupIcon}>
      <Popup>
        <div>
          <strong>📍 Pickup Location</strong>
          <p style={{ margin: '5px 0 0', fontSize: '12px' }}>
            {location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

export default PickupMarker;

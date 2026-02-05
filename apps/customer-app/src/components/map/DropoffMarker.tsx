import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Location } from '../../types';

// Custom dropoff marker icon (red)
const dropoffIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#F44336">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

interface DropoffMarkerProps {
  location: Location;
  showPopup?: boolean;
}

export const DropoffMarker: React.FC<DropoffMarkerProps> = ({
  location,
  showPopup = true,
}) => {
  return (
    <Marker position={[location.lat, location.lng]} icon={dropoffIcon}>
      {showPopup && (
        <Popup>
          <div style={{ textAlign: 'center' }}>
            <strong>🏁 Dropoff Location</strong>
            <br />
            {location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default DropoffMarker;

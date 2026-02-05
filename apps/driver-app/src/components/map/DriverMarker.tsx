import React, { useEffect, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Location } from '../../types';

interface DriverMarkerProps {
  location: Location;
}

// Custom blue car marker for driver
const driverIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(`
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#2196F3" stroke="white" stroke-width="3"/>
      <path d="M12 18 L20 14 L28 18 L28 24 L12 24 Z" fill="white"/>
      <circle cx="15" cy="26" r="2" fill="white"/>
      <circle cx="25" cy="26" r="2" fill="white"/>
    </svg>
  `)}`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const DriverMarker: React.FC<DriverMarkerProps> = ({ location }) => {
  const markerRef = useRef<L.Marker>(null);

  // Smooth animation when location updates
  useEffect(() => {
    if (markerRef.current) {
      const marker = markerRef.current;
      const currentLatLng = marker.getLatLng();
      const newLatLng = L.latLng(location.lat, location.lng);

      // Animate to new position
      const duration = 1000; // 1 second
      const startTime = Date.now();
      const startLat = currentLatLng.lat;
      const startLng = currentLatLng.lng;
      const latDiff = newLatLng.lat - startLat;
      const lngDiff = newLatLng.lng - startLng;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const currentLat = startLat + latDiff * progress;
        const currentLng = startLng + lngDiff * progress;

        marker.setLatLng([currentLat, currentLng]);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }, [location]);

  return (
    <Marker
      ref={markerRef}
      position={[location.lat, location.lng]}
      icon={driverIcon}
    >
      <Popup>
        <div>
          <strong>🚗 Your Location</strong>
          <p style={{ margin: '5px 0 0', fontSize: '12px' }}>
            {location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

export default DriverMarker;

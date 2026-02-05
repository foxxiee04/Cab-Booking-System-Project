import React, { useEffect, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Location, Driver } from '../../types';

// Custom driver marker icon (blue car)
const driverIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#2196F3">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

interface DriverMarkerProps {
  driver: Driver;
  showPopup?: boolean;
}

export const DriverMarker: React.FC<DriverMarkerProps> = ({
  driver,
  showPopup = true,
}) => {
  const markerRef = useRef<L.Marker>(null);

  // Smooth marker animation when location updates
  useEffect(() => {
    if (markerRef.current && driver.currentLocation) {
      const marker = markerRef.current;
      const newLatLng = L.latLng(driver.currentLocation.lat, driver.currentLocation.lng);
      
      // Smooth transition
      marker.setLatLng(newLatLng);
    }
  }, [driver.currentLocation]);

  if (!driver.currentLocation) {
    return null;
  }

  return (
    <Marker
      ref={markerRef}
      position={[driver.currentLocation.lat, driver.currentLocation.lng]}
      icon={driverIcon}
    >
      {showPopup && (
        <Popup>
          <div style={{ textAlign: 'center', minWidth: '150px' }}>
            <strong>🚗 {driver.firstName} {driver.lastName}</strong>
            <br />
            <span style={{ fontSize: '12px', color: '#666' }}>
              {driver.vehicleMake} {driver.vehicleModel}
            </span>
            <br />
            <span style={{ fontSize: '12px', color: '#666' }}>
              {driver.vehicleColor} • {driver.licensePlate}
            </span>
            <br />
            <span style={{ fontSize: '14px', color: '#FFA000' }}>
              ⭐ {driver.rating.toFixed(1)} ({driver.totalRides} rides)
            </span>
          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default DriverMarker;

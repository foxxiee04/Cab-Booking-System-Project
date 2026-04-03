import React, { useEffect, useRef, useMemo } from 'react';
import { Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Location, Driver } from '../../types';

/**
 * Create animated driver marker with rotation and styling
 */
const createAnimatedDriverIcon = (heading: number = 0, scale: number = 1) => {
  const size = 35 * scale;
  const innerSize = 24 * scale;
  const markerMain = '#5a7fb8';
  const markerDark = '#4f6ea1';
  const markerGlow = 'rgba(90, 127, 184, 0.3)';
  const markerGlowStrong = 'rgba(90, 127, 184, 0.45)';

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: linear-gradient(135deg, ${markerMain} 0%, ${markerDark} 100%);
        border: 3px solid #ffffff;
        box-shadow: 0 2px 8px ${markerGlow}, inset 0 -1px 3px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading}deg);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        animation: driverPulse 2s ease-in-out infinite;
      ">
        <span style="
          display: block;
          font-size: ${innerSize}px;
          line-height: 1;
          transform: rotate(${-heading}deg);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        ">🚕</span>
        <div style="
          position: absolute;
          width: ${size + 4}px;
          height: ${size + 4}px;
          border: 2px solid ${markerGlow};
          border-radius: 50%;
          top: -2px;
          left: -2px;
          animation: driverRipple 2s ease-out infinite;
        "></div>
      </div>
      <style>
        @keyframes driverPulse {
          0%, 100% { box-shadow: 0 2px 8px ${markerGlow}, inset 0 -1px 3px rgba(0, 0, 0, 0.1); }
          50% { box-shadow: 0 2px 12px ${markerGlowStrong}, inset 0 -1px 3px rgba(0, 0, 0, 0.1); }
        }
        @keyframes driverRipple {
          0% { width: ${size + 4}px; height: ${size + 4}px; opacity: 1; }
          100% { width: ${size + 12}px; height: ${size + 12}px; opacity: 0; }
        }
      </style>
    `,
    className: 'driver-marker-animated',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 10],
  });
};

interface DriverMarkerProps {
  driver: Driver;
  showPopup?: boolean;
  isNearby?: boolean;
  isSelected?: boolean;
}

export const DriverMarker: React.FC<DriverMarkerProps> = ({
  driver,
  showPopup = true,
  isNearby = false,
  isSelected = false,
}) => {
  const markerRef = useRef<L.Marker>(null);
  const animationRef = useRef<number | null>(null);
  const lastPositionRef = useRef(driver.currentLocation);
  const lastHeadingRef = useRef(driver.heading || 0);
  const mapEvents = useMapEvents({});

  // Memoize the icon to prevent unnecessary recreations
  const icon = useMemo(() => {
    const heading = driver.heading || 0;
    const scale = isSelected ? 1.2 : isNearby ? 1 : 0.9;
    return createAnimatedDriverIcon(heading, scale);
  }, [driver.heading, isNearby, isSelected]);

  // Smooth animation when location updates
  useEffect(() => {
    if (!markerRef.current || !driver.currentLocation) {
      return;
    }

    const marker = markerRef.current;
    const oldPosition = lastPositionRef.current;
    const newPosition = driver.currentLocation;
    const duration = 1000; // 1 second animation
    const startTime = performance.now();

    // Cancel previous animation if exists
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Smooth marker position animation
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Cubic easing for smooth movement
      const easeProgress =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const interpolatedLat =
        oldPosition!.lat + (newPosition.lat - oldPosition!.lat) * easeProgress;
      const interpolatedLng =
        oldPosition!.lng + (newPosition.lng - oldPosition!.lng) * easeProgress;

      marker.setLatLng(L.latLng(interpolatedLat, interpolatedLng));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        lastPositionRef.current = newPosition;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [driver.currentLocation]);

  // Update heading
  useEffect(() => {
    if (driver.heading) {
      lastHeadingRef.current = driver.heading;
    }
  }, [driver.heading]);

  if (!driver.currentLocation) {
    return null;
  }

  return (
    <Marker
      ref={markerRef}
      position={[driver.currentLocation.lat, driver.currentLocation.lng]}
      icon={icon}
      eventHandlers={{
        click: () => {
          if (mapEvents) {
            // Can dispatch action to select this driver if needed
          }
        },
      }}
    >
      {showPopup && (
        <Popup
          maxWidth={250}
          className="driver-popup"
          closeButton={true}
          closeOnClick={false}
        >
          <div style={{
            padding: '8px 0',
            minWidth: '200px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1f2937',
              marginBottom: '4px',
            }}>
              🚗 {driver.firstName} {driver.lastName}
            </div>

            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '8px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '8px',
            }}>
              {driver.vehicleMake} {driver.vehicleModel}
              <br />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {driver.vehicleColor} • {driver.licensePlate}
              </span>
            </div>

            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#b08968',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}>
              <span>⭐</span>
              <span>{driver.rating.toFixed(1)}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '400' }}>
                ({driver.totalRides} trips)
              </span>
            </div>

            {driver.acceptanceRate && (
              <div style={{
                marginTop: '8px',
                padding: '6px',
                background: 'rgba(92, 163, 138, 0.12)',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#4f9f85',
                fontWeight: '500',
              }}>
                ✓ {driver.acceptanceRate}% acceptance rate
              </div>
            )}
          </div>
        </Popup>
      )}
    </Marker>
  );
};

export default DriverMarker;


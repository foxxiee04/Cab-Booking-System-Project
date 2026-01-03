'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface MapProps {
  currentLocation: Location | null;
  pickup: Location | null;
  destination: Location | null;
}

const driverIcon = L.divIcon({
  html: `<div class="w-10 h-10 bg-blue-600 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
    </svg>
  </div>`,
  className: 'custom-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const pickupIcon = L.divIcon({
  html: `<div class="w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>`,
  className: 'custom-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destinationIcon = L.divIcon({
  html: `<div class="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>`,
  className: 'custom-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function Map({ currentLocation, pickup, destination }: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView([10.762622, 106.660172], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (currentLocation) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
      } else {
        driverMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon: driverIcon })
          .addTo(mapRef.current)
          .bindPopup('Vị trí của bạn');
      }
      
      if (!pickup && !destination) {
        mapRef.current.setView([currentLocation.lat, currentLocation.lng], 15);
      }
    }
  }, [currentLocation]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (pickup) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
      } else {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
          .addTo(mapRef.current)
          .bindPopup(pickup.address || 'Điểm đón');
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }
  }, [pickup]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (destination) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      } else {
        destinationMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: destinationIcon })
          .addTo(mapRef.current)
          .bindPopup(destination.address || 'Điểm đến');
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    // Fit bounds
    if (currentLocation && (pickup || destination)) {
      const points: [number, number][] = [[currentLocation.lat, currentLocation.lng]];
      if (pickup) points.push([pickup.lat, pickup.lng]);
      if (destination) points.push([destination.lat, destination.lng]);
      
      if (points.length > 1) {
        mapRef.current.fitBounds(points, { padding: [50, 50] });
      }
    }
  }, [destination, currentLocation, pickup]);

  return <div ref={containerRef} className="h-full w-full rounded-xl" />;
}

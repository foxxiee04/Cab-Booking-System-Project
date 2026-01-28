/// <reference types="next" />
'use client';

import { useEffect, useRef, useCallback } from 'react';

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

declare global {
  interface Window {
    trackasiagl: any;
  }
}

export default function MapGoogle({ currentLocation, pickup, destination }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    // Load TrackAsia GL JS library
    if (document.getElementById('trackasia-script')) return;

    const script = document.createElement('script');
    script.id = 'trackasia-script';
    script.src = 'https://unpkg.com/trackasia-gl@latest/dist/trackasia-gl.js';
    script.async = true;
    script.onload = () => {
      const link = document.createElement('link');
      link.href = 'https://unpkg.com/trackasia-gl@latest/dist/trackasia-gl.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      if (containerRef.current) {
        initializeMap();
      }
    };
    document.body.appendChild(script);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  const initializeMap = useCallback(() => {
    if (!window.trackasiagl || !containerRef.current) return;

    mapRef.current = new window.trackasiagl.Map({
      container: containerRef.current,
      style: 'https://maps.track-asia.com/styles/v2/streets.json?key=6ce5471f943d628580a17695354821b1d4',
      center: [106.694945, 10.769034],
      zoom: 12,
    });
  }, []);

  const addMarker = useCallback(
    (location: Location, color: 'green' | 'red' | 'blue', title: string) => {
      if (!mapRef.current || !window.trackasiagl) return;

      // Remove existing marker of same type
      markersRef.current = markersRef.current.filter((m) => m.title !== title);

      const el = document.createElement('div');
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.cursor = 'pointer';

      const colorMap = {
        green: '#22c55e',
        red: '#ef4444',
        blue: '#3b82f6',
      };

      el.style.backgroundColor = colorMap[color];
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

      const popup = new window.trackasiagl.Popup({ offset: 25 }).setHTML(
        `<div style="padding: 8px; font-size: 12px;">
          <strong>${title}</strong><br/>
          ${location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
        </div>`
      );

      const marker = new window.trackasiagl.Marker({ element: el })
        .setLngLat([location.lng, location.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push({ marker, title });
    },
    []
  );

  const drawPolyline = useCallback((start: Location, end: Location) => {
    if (!mapRef.current || !window.trackasiagl) return;

    const sourceId = 'route-source';
    const layerId = 'route-layer';

    // Remove existing source/layer if present
    if (mapRef.current.getSource(sourceId)) {
      mapRef.current.removeLayer(layerId);
      mapRef.current.removeSource(sourceId);
    }

    mapRef.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [start.lng, start.lat],
            [end.lng, end.lat],
          ],
        },
      },
    });

    mapRef.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#2563eb',
        'line-width': 4,
        'line-opacity': 0.9,
      },
    });

    polylineRef.current = { sourceId, layerId };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.marker.remove());
    markersRef.current = [];

    if (currentLocation) {
      addMarker(currentLocation, 'blue', 'Vị trí của bạn');
    }

    if (pickup) {
      addMarker(pickup, 'green', pickup.address || 'Điểm đón');
    }

    if (destination) {
      addMarker(destination, 'red', destination.address || 'Điểm đến');
    }

    // Draw polyline
    if (pickup && destination) {
      drawPolyline(pickup, destination);
    }

    // Fit bounds
    if (mapRef.current && markersRef.current.length > 1) {
      const bounds = new window.trackasiagl.LngLatBounds();
      if (currentLocation) bounds.extend([currentLocation.lng, currentLocation.lat]);
      if (pickup) bounds.extend([pickup.lng, pickup.lat]);
      if (destination) bounds.extend([destination.lng, destination.lat]);
      mapRef.current.fitBounds(bounds, { padding: 50 });
    } else if (mapRef.current && currentLocation) {
      mapRef.current.setCenter([currentLocation.lng, currentLocation.lat]);
      mapRef.current.setZoom(15);
    }
  }, [currentLocation, pickup, destination, addMarker, drawPolyline]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center"
    >
      <div className="text-gray-600">Đang tải bản đồ...</div>
    </div>
  );
}

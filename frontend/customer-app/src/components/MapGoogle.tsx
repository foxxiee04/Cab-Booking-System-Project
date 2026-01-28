/// <reference types="next" />
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Navigation, Maximize2 } from 'lucide-react';
import { getDrivingRoute } from '@/lib/routing';

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface MapProps {
  pickup: Location | null;
  destination: Location | null;
  driverLocation?: Location | null;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  showControls?: boolean;
}

declare global {
  interface Window {
    trackasiagl: any;
  }
}

export default function MapGoogle({ 
  pickup, 
  destination, 
  driverLocation, 
  onMapClick,
  className = '',
  showControls = true 
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Load TrackAsia GL JS library
    if (document.getElementById('trackasia-script')) {
      if (window.trackasiagl && containerRef.current && !mapRef.current) {
        initializeMap();
      }
      return;
    }

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
        mapRef.current = null;
      }
    };
  }, []);

  const initializeMap = useCallback(() => {
    if (!window.trackasiagl || !containerRef.current || mapRef.current) return;

    try {
      mapRef.current = new window.trackasiagl.Map({
        container: containerRef.current,
        style: 'https://maps.track-asia.com/styles/v2/streets.json?key=6ce5471f943d628580a17695354821b1d4',
        center: [106.694945, 10.769034], // Ho Chi Minh City
        zoom: 13,
        attributionControl: false,
      });

      // Add navigation controls
      if (showControls) {
        mapRef.current.addControl(
          new window.trackasiagl.NavigationControl({
            showCompass: true,
            showZoom: true,
            visualizePitch: true,
          }),
          'bottom-right'
        );

        // Add geolocate control
        mapRef.current.addControl(
          new window.trackasiagl.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true,
            },
            trackUserLocation: true,
            showUserHeading: true,
          }),
          'bottom-right'
        );
      }

      mapRef.current.on('load', () => {
        setMapLoaded(true);
      });

      // Add click handler for map
      if (onMapClick) {
        mapRef.current.on('click', (e: any) => {
          onMapClick(e.lngLat.lat, e.lngLat.lng);
        });
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }, [onMapClick, showControls]);

  const addMarker = useCallback(
    (location: Location, color: 'green' | 'red' | 'blue', title: string) => {
      if (!mapRef.current || !window.trackasiagl || !mapLoaded) return;

      try {
        // Remove existing marker of same type
        const existingMarkerIndex = markersRef.current.findIndex((m) => m.title === title);
        if (existingMarkerIndex !== -1) {
          markersRef.current[existingMarkerIndex].marker.remove();
          markersRef.current.splice(existingMarkerIndex, 1);
        }

        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.borderRadius = '50%';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = 'bold';
        el.style.fontSize = '18px';
        el.style.transition = 'transform 0.2s';

        const colorMap = {
          green: { bg: '#10b981', border: '#059669', icon: '📍' },
          red: { bg: '#ef4444', border: '#dc2626', icon: '🏁' },
          blue: { bg: '#3b82f6', border: '#2563eb', icon: '🚗' },
        };

        const colorStyle = colorMap[color];
        el.style.backgroundColor = colorStyle.bg;
        el.style.border = `3px solid ${colorStyle.border}`;
        el.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
        el.innerHTML = colorStyle.icon;

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });

        const popup = new window.trackasiagl.Popup({ 
          offset: 25,
          closeButton: true,
          closeOnClick: false,
        }).setHTML(
          `<div style="padding: 12px; min-width: 150px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #111827;">
              ${title}
            </div>
            <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
              ${location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
            </div>
          </div>`
        );

        const marker = new window.trackasiagl.Marker({ element: el })
          .setLngLat([location.lng, location.lat])
          .setPopup(popup)
          .addTo(mapRef.current);

        markersRef.current.push({ marker, title });
      } catch (error) {
        console.error('Error adding marker:', error);
      }
    },
    [mapLoaded]
  );

  const drawPolyline = useCallback(async (start: Location, end: Location) => {
    if (!mapRef.current || !window.trackasiagl || !mapLoaded) return;

    try {
      const sourceId = 'route-source';
      const layerId = 'route-layer';
      const outlineLayerId = 'route-outline-layer';

      // Remove existing source/layer if present
      if (mapRef.current.getSource(sourceId)) {
        if (mapRef.current.getLayer(outlineLayerId)) {
          mapRef.current.removeLayer(outlineLayerId);
        }
        if (mapRef.current.getLayer(layerId)) {
          mapRef.current.removeLayer(layerId);
        }
        mapRef.current.removeSource(sourceId);
      }

      // Get real driving route
      const route = await getDrivingRoute(start, end);
      
      if (!route) {
        console.warn('No route found, skipping polyline');
        return;
      }

      mapRef.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.coordinates,
          },
        },
      });

      // Outline layer for better visibility
      mapRef.current.addLayer({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#1e40af',
          'line-width': 6,
          'line-opacity': 0.5,
        },
      });

      // Main route layer
      mapRef.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

      polylineRef.current = { sourceId, layerId, outlineLayerId };
    } catch (error) {
      console.error('Error drawing polyline:', error);
    }
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.marker.remove());
    markersRef.current = [];

    if (pickup) {
      addMarker(pickup, 'green', pickup.address || 'Điểm đón');
    }

    if (destination) {
      addMarker(destination, 'red', destination.address || 'Điểm đến');
    }

    if (driverLocation) {
      addMarker(driverLocation, 'blue', 'Tài xế');
    }

    // Draw polyline
    if (pickup && destination) {
      drawPolyline(pickup, destination);
    }

    // Fit bounds
    if (mapRef.current && markersRef.current.length > 1) {
      const bounds = new window.trackasiagl.LngLatBounds();
      if (pickup) bounds.extend([pickup.lng, pickup.lat]);
      if (destination) bounds.extend([destination.lng, destination.lat]);
      if (driverLocation) bounds.extend([driverLocation.lng, driverLocation.lat]);
      mapRef.current.fitBounds(bounds, { padding: 50 });
    } else if (mapRef.current && pickup) {
      mapRef.current.setCenter([pickup.lng, pickup.lat]);
      mapRef.current.setZoom(14);
    }
  }, [pickup, destination, driverLocation, addMarker, drawPolyline]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden bg-gray-100 ${className}`}
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
    >
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mb-4"></div>
            <div className="text-gray-600 font-medium">Đang tải bản đồ...</div>
          </div>
        </div>
      )}
    </div>
  );
}

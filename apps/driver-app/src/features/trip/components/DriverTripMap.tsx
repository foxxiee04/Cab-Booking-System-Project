import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { MapContainer as LeafletMapContainer, Marker as LeafletMarker, Polyline as LeafletPolyline, TileLayer as LeafletTileLayer, useMap } from 'react-leaflet';
import { Location } from '../../../types';
import { getRoute } from '../../../utils/map.utils';
import '../../../styles/map.css';

const libraries: ('geometry' | 'places')[] = ['geometry', 'places'];
const defaultCenter = { lat: 10.7769, lng: 106.7009 };

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2937' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#5a7fb8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
];

interface RouteSummary {
  distanceText: string;
  durationText: string;
  polylinePath: google.maps.LatLngLiteral[];
}

const leafletIconCache = new Map<string, L.DivIcon>();

function getLeafletIcon(key: string, html: string, size: [number, number], anchor: [number, number]) {
  const cached = leafletIconCache.get(key);
  if (cached) {
    return cached;
  }

  const icon = L.divIcon({
    html,
    className: key,
    iconSize: size,
    iconAnchor: anchor,
  });

  leafletIconCache.set(key, icon);
  return icon;
}

function createLeafletPin(color: string) {
  return getLeafletIcon(
    `driver-pin-${color}`,
    `<div style="width:30px;height:30px;border-radius:999px;background:${color};border:3px solid #ffffff;color:#ffffff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(15,23,42,0.18);">●</div>`,
    [30, 30],
    [15, 15],
  );
}

function createLeafletDriverIcon() {
  return getLeafletIcon(
    'driver-current-location',
    '<div style="width:30px;height:30px;border-radius:999px;background:#5a7fb8;border:3px solid #ffffff;box-shadow:0 10px 24px rgba(90,127,184,0.28);display:flex;align-items:center;justify-content:center;"><span style="font-size:14px;line-height:1;">🚕</span></div>',
    [30, 30],
    [15, 15],
  );
}

const LeafletViewportController: React.FC<{
  currentLocation?: Location | null;
  destinationLocation?: Location | null;
  viewportLockedRef: React.MutableRefObject<boolean>;
  programmaticViewportRef: React.MutableRefObject<boolean>;
  autoFitKey: string;
}> = ({ currentLocation, destinationLocation, viewportLockedRef, programmaticViewportRef, autoFitKey }) => {
  const map = useMap();
  const lat0 = currentLocation?.lat;
  const lng0 = currentLocation?.lng;
  const lat1 = destinationLocation?.lat;
  const lng1 = destinationLocation?.lng;

  useEffect(() => {
    const lockViewport = () => {
      if (!programmaticViewportRef.current) {
        viewportLockedRef.current = true;
      }
    };

    map.on('dragstart', lockViewport);
    map.on('zoomstart', lockViewport);

    return () => {
      map.off('dragstart', lockViewport);
      map.off('zoomstart', lockViewport);
    };
  }, [map, programmaticViewportRef, viewportLockedRef]);

  useEffect(() => {
    const points: [number, number][] = [];
    if (lat0 != null && lng0 != null) points.push([lat0, lng0]);
    if (lat1 != null && lng1 != null) points.push([lat1, lng1]);
    if (!points.length || viewportLockedRef.current) {
      return;
    }

    programmaticViewportRef.current = true;

    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
      window.setTimeout(() => {
        programmaticViewportRef.current = false;
      }, 0);
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [56, 56],
      animate: true,
    });
    window.setTimeout(() => {
      programmaticViewportRef.current = false;
    }, 0);
  }, [autoFitKey, map, lat0, lng0, lat1, lng1, programmaticViewportRef, viewportLockedRef]);

  return null;
};

export interface DriverTripMapProps {
  googleMapsApiKey?: string;
  currentLocation?: Location | null;
  pickupLocation?: Location | null;
  dropoffLocation?: Location | null;
  mode?: 'request' | 'pickup' | 'trip';
  height?: number | string;
  colorMode?: 'light' | 'dark' | 'system';
}

function resolveColorMode(colorMode: DriverTripMapProps['colorMode']): 'light' | 'dark' {
  if (colorMode === 'light' || colorMode === 'dark') {
    return colorMode;
  }

  return 'light';
}

function getCarSymbol(rotation: number, fillColor: string, scale = 0.95): google.maps.Symbol {
  return {
    path: 'M12 2C8.8 2 6.2 4.5 5.6 7.6L4.7 12H3a1 1 0 0 0-1 1v2.2a.8.8 0 0 0 .8.8h1V18a1 1 0 0 0 1 1h1.8a1 1 0 0 0 1-1v-1h8.8v1a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-2h1.2a.8.8 0 0 0 .8-.8V13a1 1 0 0 0-1-1h-1.7l-.9-4.4C17.8 4.5 15.2 2 12 2zm0 2c2.2 0 4.1 1.6 4.5 3.8l.6 3.2H6.9l.6-3.2C7.9 5.6 9.8 4 12 4zm-5.3 9.7a1.5 1.5 0 1 1 0 3.1 1.5 1.5 0 0 1 0-3.1zm10.6 0a1.5 1.5 0 1 1 0 3.1 1.5 1.5 0 0 1 0-3.1z',
    fillColor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeOpacity: 0.95,
    strokeWeight: 1,
    rotation,
    scale,
    anchor: new google.maps.Point(12, 12),
  };
}

function getMarkerIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 10,
  };
}

interface GoogleDriverTripMapCanvasProps {
  googleMapsApiKey: string;
  initialCenter: google.maps.LatLngLiteral;
  themeMode: 'light' | 'dark';
  mode: 'request' | 'pickup' | 'trip';
  currentLocation?: Location | null;
  destinationLocation?: Location | null;
  routeSummary: RouteSummary | null;
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  onMapLoad: (points: google.maps.LatLngLiteral[]) => void;
  fallback: React.ReactNode;
}

const GoogleDriverTripMapCanvas: React.FC<GoogleDriverTripMapCanvasProps> = ({
  googleMapsApiKey,
  initialCenter,
  themeMode,
  mode,
  currentLocation,
  destinationLocation,
  routeSummary,
  mapRef,
  onMapLoad,
  fallback,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'cab-driver-google-maps',
    googleMapsApiKey,
    libraries,
  });

  if (loadError) {
    return <>{fallback}</>;
  }

  if (!isLoaded) {
    return <Box sx={{ width: '100%', height: '100%', bgcolor: '#e2e8f0' }} />;
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={initialCenter}
      zoom={14}
      onLoad={(map) => {
        mapRef.current = map;
        onMapLoad(
          [
            currentLocation,
            destinationLocation,
          ].filter(Boolean) as google.maps.LatLngLiteral[]
        );
      }}
      onUnmount={() => {
        mapRef.current = null;
      }}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        styles: themeMode === 'dark' ? darkMapStyles : undefined,
      }}
    >
        {destinationLocation && (
          <MarkerF position={destinationLocation} icon={getMarkerIcon(mode === 'trip' ? '#c48686' : '#5ca38a')} title={mode === 'trip' ? 'Điểm đến' : 'Điểm đón'} />
      )}
      {currentLocation && (
          <MarkerF position={currentLocation} icon={getCarSymbol(0, '#5a7fb8')} title="Vị trí của bạn" />
      )}
      {routeSummary && (
        <>
          <PolylineF
            path={routeSummary.polylinePath}
            options={{
              strokeColor: '#ffffff',
              strokeOpacity: 0.92,
              strokeWeight: 10,
              zIndex: 10,
            }}
          />
          <PolylineF
            path={routeSummary.polylinePath}
            options={{
              strokeColor: mode === 'trip' ? '#5ca38a' : '#5a7fb8',
              strokeOpacity: 0.98,
              strokeWeight: 6,
              zIndex: 11,
            }}
          />
        </>
      )}
    </GoogleMap>
  );
};

export const DriverTripMap: React.FC<DriverTripMapProps> = ({
  googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  currentLocation,
  pickupLocation,
  dropoffLocation,
  mode = 'request',
  height = 340,
  colorMode = 'light',
}) => {
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const viewportLockedRef = useRef(false);
  const programmaticViewportRef = useRef(false);
  const lastAutoFitKeyRef = useRef('');
  const themeMode = resolveColorMode(colorMode);
  const hasGoogleMapsApiKey = googleMapsApiKey.trim().length > 0;

  const destination = mode === 'trip' ? dropoffLocation : pickupLocation;

  const center = useMemo(() => {
    if (currentLocation) {
      return currentLocation;
    }
    if (destination) {
      return destination;
    }
    return defaultCenter;
  }, [currentLocation, destination]);
  const initialCenterRef = useRef(center);
  const autoFitKey = useMemo(
    () => [
      mode,
      destination?.lat ?? 'x',
      destination?.lng ?? 'x',
      currentLocation ? 'driver-present' : 'driver-missing',
    ].join('|'),
    [currentLocation, destination?.lat, destination?.lng, mode],
  );

  useEffect(() => {
    viewportLockedRef.current = false;
    lastAutoFitKeyRef.current = '';
  }, [mode, destination?.lat, destination?.lng]);

  useEffect(() => {
    let cancelled = false;

    if (!currentLocation || !destination) {
      setRouteSummary(null);
      return;
    }

    void (async () => {
      const route = await getRoute(currentLocation, destination);
      if (cancelled || !route) {
        if (!cancelled) {
          setRouteSummary(null);
        }
        return;
      }

      setRouteSummary({
        distanceText: route.distance >= 1000 ? `${(route.distance / 1000).toFixed(1)} km` : `${Math.round(route.distance)} m`,
        durationText: `${Math.max(1, Math.round(route.duration / 60))} phút`,
        polylinePath: route.coordinates.map(([lng, lat]) => ({ lat, lng })),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [currentLocation, destination]);

  useEffect(() => {
    const map = mapRef.current;
    const points = [
      currentLocation,
      destination,
    ].filter(Boolean) as google.maps.LatLngLiteral[];

    if (
      !map ||
      points.length === 0 ||
      !window.google ||
      viewportLockedRef.current ||
      lastAutoFitKeyRef.current === autoFitKey
    ) {
      return;
    }

    programmaticViewportRef.current = true;
    lastAutoFitKeyRef.current = autoFitKey;

    if (points.length === 1) {
      map.panTo(points[0]);
      const currentZoom = map.getZoom() ?? 0;
      if (currentZoom < 15) {
        map.setZoom(15);
      }
      google.maps.event.addListenerOnce(map, 'idle', () => {
        programmaticViewportRef.current = false;
      });
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 56);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      programmaticViewportRef.current = false;
    });
  }, [autoFitKey, currentLocation, destination]);

  const leafletTileUrl =
    themeMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const leafletAttribution =
    themeMode === 'dark'
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const leafletMap = (
    <LeafletMapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl
      scrollWheelZoom
    >
      <LeafletTileLayer
        attribution={leafletAttribution}
        url={leafletTileUrl}
        maxZoom={20}
      />
      <LeafletViewportController
        currentLocation={currentLocation}
        destinationLocation={destination}
        viewportLockedRef={viewportLockedRef}
        programmaticViewportRef={programmaticViewportRef}
        autoFitKey={autoFitKey}
      />
      {destination && <LeafletMarker position={[destination.lat, destination.lng]} icon={createLeafletPin(mode === 'trip' ? '#c48686' : '#5ca38a')} />}
      {currentLocation && <LeafletMarker position={[currentLocation.lat, currentLocation.lng]} icon={createLeafletDriverIcon()} />}
      {routeSummary && (
        <>
          <LeafletPolyline
            positions={routeSummary.polylinePath.map((point) => [point.lat, point.lng])}
            pathOptions={{
              color: '#ffffff',
              opacity: 0.92,
              weight: 10,
            }}
          />
          <LeafletPolyline
            positions={routeSummary.polylinePath.map((point) => [point.lat, point.lng])}
            pathOptions={{
              color: mode === 'trip' ? '#5ca38a' : '#5a7fb8',
              opacity: 0.98,
              weight: 6,
            }}
          />
        </>
      )}
    </LeafletMapContainer>
  );

  return (
    <Box sx={{ position: 'relative', width: '100%', height, borderRadius: 5, overflow: 'hidden', bgcolor: '#e9eff6', border: '1px solid rgba(148,163,184,0.18)', boxShadow: '0 14px 36px rgba(15,23,42,0.10)' }}>
      {hasGoogleMapsApiKey ? (
        <GoogleDriverTripMapCanvas
          googleMapsApiKey={googleMapsApiKey}
          initialCenter={initialCenterRef.current}
          themeMode={themeMode}
          mode={mode}
          currentLocation={currentLocation}
          destinationLocation={destination}
          routeSummary={routeSummary}
          mapRef={mapRef}
          onMapLoad={(points) => {
            const map = mapRef.current;
            if (!map || !points.length || !window.google) {
              return;
            }

            map.addListener('dragstart', () => {
              viewportLockedRef.current = true;
            });
            map.addListener('zoom_changed', () => {
              if (!programmaticViewportRef.current) {
                viewportLockedRef.current = true;
              }
            });

            if (lastAutoFitKeyRef.current === autoFitKey) {
              return;
            }

            programmaticViewportRef.current = true;
            lastAutoFitKeyRef.current = autoFitKey;

            if (points.length === 1) {
              map.panTo(points[0]);
              const currentZoom = map.getZoom() ?? 0;
              if (currentZoom < 15) {
                map.setZoom(15);
              }
              google.maps.event.addListenerOnce(map, 'idle', () => {
                programmaticViewportRef.current = false;
              });
              return;
            }

            const bounds = new google.maps.LatLngBounds();
            points.forEach((point) => bounds.extend(point));
            map.fitBounds(bounds, 56);
            google.maps.event.addListenerOnce(map, 'idle', () => {
              programmaticViewportRef.current = false;
            });
          }}
          fallback={leafletMap}
        />
      ) : leafletMap}
    </Box>
  );
};

export default DriverTripMap;

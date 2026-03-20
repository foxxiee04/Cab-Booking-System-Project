import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import {
  AccessTimeRounded,
  DirectionsCarFilledRounded,
  FlagRounded,
  PlaceRounded,
  RouteRounded,
} from '@mui/icons-material';
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
  { elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#d1d5db' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2563eb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
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
    '<div style="width:30px;height:30px;border-radius:999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 10px 24px rgba(37,99,235,0.28);display:flex;align-items:center;justify-content:center;"><span style="font-size:14px;line-height:1;">🚕</span></div>',
    [30, 30],
    [15, 15],
  );
}

const LeafletViewportController: React.FC<{
  currentLocation?: Location | null;
  pickupLocation?: Location | null;
  dropoffLocation?: Location | null;
}> = ({ currentLocation, pickupLocation, dropoffLocation }) => {
  const map = useMap();
  const lat0 = currentLocation?.lat;
  const lng0 = currentLocation?.lng;
  const lat1 = pickupLocation?.lat;
  const lng1 = pickupLocation?.lng;
  const lat2 = dropoffLocation?.lat;
  const lng2 = dropoffLocation?.lng;

  useEffect(() => {
    const points: [number, number][] = [];
    if (lat0 != null && lng0 != null) points.push([lat0, lng0]);
    if (lat1 != null && lng1 != null) points.push([lat1, lng1]);
    if (lat2 != null && lng2 != null) points.push([lat2, lng2]);

    if (!points.length) {
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      padding: [56, 56],
      animate: true,
    });
  }, [map, lat0, lng0, lat1, lng1, lat2, lng2]);

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

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
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
  center: google.maps.LatLngLiteral;
  themeMode: 'light' | 'dark';
  mode: 'request' | 'pickup' | 'trip';
  currentLocation?: Location | null;
  pickupLocation?: Location | null;
  dropoffLocation?: Location | null;
  routeSummary: RouteSummary | null;
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  onMapLoad: (points: google.maps.LatLngLiteral[]) => void;
  fallback: React.ReactNode;
}

const GoogleDriverTripMapCanvas: React.FC<GoogleDriverTripMapCanvasProps> = ({
  googleMapsApiKey,
  center,
  themeMode,
  mode,
  currentLocation,
  pickupLocation,
  dropoffLocation,
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
      center={center}
      zoom={14}
      onLoad={(map) => {
        mapRef.current = map;
        onMapLoad([currentLocation, pickupLocation, dropoffLocation].filter(Boolean) as google.maps.LatLngLiteral[]);
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
      {pickupLocation && (
        <MarkerF position={pickupLocation} icon={getMarkerIcon('#16a34a')} title="Điểm đón" />
      )}
      {dropoffLocation && (
        <MarkerF position={dropoffLocation} icon={getMarkerIcon('#ef4444')} title="Điểm đến" />
      )}
      {currentLocation && (
        <MarkerF position={currentLocation} icon={getCarSymbol(0, '#2563eb')} title="Vị trí của bạn" />
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
              strokeColor: mode === 'trip' ? '#16a34a' : '#2563eb',
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
  height = 280,
  colorMode = 'system',
}) => {
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const themeMode = resolveColorMode(colorMode);
  const hasGoogleMapsApiKey = googleMapsApiKey.trim().length > 0;

  const center = useMemo(() => {
    if (currentLocation) {
      return currentLocation;
    }
    if (pickupLocation) {
      return pickupLocation;
    }
    return defaultCenter;
  }, [currentLocation, pickupLocation]);

  const destination = mode === 'trip' ? dropoffLocation : pickupLocation;

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
        durationText: `${Math.max(1, Math.round(route.duration / 60))} min`,
        polylinePath: route.coordinates.map(([lng, lat]) => ({ lat, lng })),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [currentLocation, destination]);

  useEffect(() => {
    const map = mapRef.current;
    const points = [currentLocation, pickupLocation, dropoffLocation].filter(Boolean) as google.maps.LatLngLiteral[];

    if (!map || points.length === 0 || !window.google) {
      return;
    }

    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 56);
  }, [currentLocation, dropoffLocation, pickupLocation, routeSummary]);

  const leafletMap = (
    <LeafletMapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl
      scrollWheelZoom
    >
      <LeafletTileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={20}
      />
      <LeafletViewportController currentLocation={currentLocation} pickupLocation={pickupLocation} dropoffLocation={dropoffLocation} />
      {pickupLocation && <LeafletMarker position={[pickupLocation.lat, pickupLocation.lng]} icon={createLeafletPin('#16a34a')} />}
      {dropoffLocation && <LeafletMarker position={[dropoffLocation.lat, dropoffLocation.lng]} icon={createLeafletPin('#ef4444')} />}
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
              color: mode === 'trip' ? '#16a34a' : '#2563eb',
              opacity: 0.98,
              weight: 6,
            }}
          />
        </>
      )}
    </LeafletMapContainer>
  );

  return (
    <Box sx={{ position: 'relative', width: '100%', height, borderRadius: 5, overflow: 'hidden', bgcolor: '#dbeafe', border: '1px solid rgba(148,163,184,0.12)' }}>
      {hasGoogleMapsApiKey ? (
        <GoogleDriverTripMapCanvas
          googleMapsApiKey={googleMapsApiKey}
          center={center}
          themeMode={themeMode}
          mode={mode}
          currentLocation={currentLocation}
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          routeSummary={routeSummary}
          mapRef={mapRef}
          onMapLoad={(points) => {
            const map = mapRef.current;
            if (!map || !points.length || !window.google) {
              return;
            }

            if (points.length === 1) {
              map.panTo(points[0]);
              map.setZoom(15);
              return;
            }

            const bounds = new google.maps.LatLngBounds();
            points.forEach((point) => bounds.extend(point));
            map.fitBounds(bounds, 56);
          }}
          fallback={leafletMap}
        />
      ) : leafletMap}

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 34%, rgba(15,23,42,0.05) 100%)',
        }}
      />

      <Paper
        elevation={0}
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 2,
          px: 1.25,
          py: 0.85,
          borderRadius: 999,
          backgroundColor: themeMode === 'dark' ? 'rgba(17,24,39,0.86)' : 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(148,163,184,0.18)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip size="small" label="Điểm đón" sx={{ bgcolor: 'rgba(22,163,74,0.12)', color: '#15803d' }} />
          <Chip size="small" label="Tuyến đường" sx={{ bgcolor: 'rgba(37,99,235,0.12)', color: '#1d4ed8' }} />
          <Chip size="small" label="Điểm đến" sx={{ bgcolor: 'rgba(239,68,68,0.12)', color: '#b91c1c' }} />
        </Stack>
      </Paper>

      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          p: 1.5,
          borderRadius: 4,
          backgroundColor: themeMode === 'dark' ? 'rgba(17, 24, 39, 0.88)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
          <Chip icon={<DirectionsCarFilledRounded />} label={mode === 'trip' ? 'Đang dẫn tới điểm đến' : 'Đang dẫn tới điểm đón'} size="small" color="primary" />
          {routeSummary && <Chip icon={<RouteRounded />} label={routeSummary.distanceText} size="small" variant="outlined" />}
          {routeSummary && <Chip icon={<AccessTimeRounded />} label={routeSummary.durationText} size="small" variant="outlined" />}
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <PlaceRounded sx={{ color: '#16a34a', mt: 0.2 }} fontSize="small" />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {pickupLocation?.address || 'Điểm đón'}
          </Typography>
        </Stack>
        {dropoffLocation && (
          <Stack direction="row" spacing={1.5} sx={{ mt: 0.75 }}>
            <FlagRounded sx={{ color: '#ef4444', mt: 0.2 }} fontSize="small" />
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {dropoffLocation.address || 'Điểm đến'}
            </Typography>
          </Stack>
        )}
      </Paper>
    </Box>
  );
};

export default DriverTripMap;

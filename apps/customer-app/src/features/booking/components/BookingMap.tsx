import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  ListItem,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  TextField,
} from '@mui/material';
import {
  AccessTimeRounded,
  MyLocationRounded,
  NearMeRounded,
  PlaceRounded,
  RouteRounded,
} from '@mui/icons-material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { MapContainer as LeafletMapContainer, Marker as LeafletMarker, Polyline as LeafletPolyline, TileLayer as LeafletTileLayer, useMap } from 'react-leaflet';
import {
  calculateHeading,
  easeInOutCubic,
  estimateAnimationDurationMs,
  interpolateHeading,
  interpolatePosition,
} from '../utils/mapAnimation';
import { BookingMapLocation, DriverLocationUpdate, NearbyDriver, RouteSummary } from '../types';
import { geocodeAddress, getCurrentLocation, getRoute } from '../../../utils/map.utils';
import '../../../styles/map.css';

const libraries: ('places' | 'geometry')[] = [];

const defaultCenter = { lat: 10.7769, lng: 106.7009 };
const MAP_COLORS = {
  accent: '#2563eb',
  neutral: '#334155',
};

const MAJOR_CITY_POINTS = [
  { id: 'benthanh', name: 'Cho Ben Thanh', lat: 10.7726, lng: 106.698 },
  { id: 'tsn', name: 'San bay Tan Son Nhat', lat: 10.8185, lng: 106.6588 },
  { id: 'landmark81', name: 'Landmark 81', lat: 10.7949, lng: 106.7219 },
  { id: 'thuductech', name: 'TP Thu Duc', lat: 10.8495, lng: 106.7718 },
];

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#d1d5db' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2563eb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
];

type SearchField = 'pickup' | 'dropoff';

interface PlacePredictionOption {
  description: string;
  placeId?: string;
  primaryText: string;
  secondaryText: string;
  lat: number;
  lng: number;
}

const DEFAULT_SEARCH_CONTEXT = 'Thành phố Hồ Chí Minh';

// Ensure Leaflet default marker assets resolve correctly in bundled builds.
L.Marker.prototype.options.icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function stripVietnamese(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function getSearchContextLabel(...addresses: Array<string | undefined>) {
  for (const address of addresses) {
    if (!address) {
      continue;
    }

    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    const directMatch = [...parts].reverse().find((part) => {
      const normalized = stripVietnamese(part);
      if (normalized.includes('thu duc')) {
        return false;
      }

      return normalized.includes('ho chi minh') || normalized.includes('ha noi') || normalized.includes('da nang') || normalized.includes('can tho') || normalized.includes('tinh');
    });

    if (directMatch) {
      return directMatch;
    }
  }

  return DEFAULT_SEARCH_CONTEXT;
}

function getPredictionLabel(option: PlacePredictionOption | string) {
  return typeof option === 'string' ? option : option.description;
}

const leafletMarkerIconCache = new Map<string, L.DivIcon>();

function getLeafletMarkerIcon(html: string, className: string, size: [number, number], anchor: [number, number]) {
  const key = `${className}-${html}`;
  const cached = leafletMarkerIconCache.get(key);

  if (cached) {
    return cached;
  }

  const icon = L.divIcon({
    html,
    className,
    iconSize: size,
    iconAnchor: anchor,
  });

  leafletMarkerIconCache.set(key, icon);
  return icon;
}

function createLeafletPin(label: string, color: string) {
  return getLeafletMarkerIcon(
    `<div style="width:28px;height:28px;border-radius:999px;background:${color};border:2px solid #ffffff;color:#ffffff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(15,23,42,0.16);">${label}</div>`,
    'booking-leaflet-pin',
    [28, 28],
    [14, 14],
  );
}

function createLeafletDriverIcon(color: string, heading = 0, emphasize = false) {
  const size = emphasize ? 32 : 26;
  return getLeafletMarkerIcon(
    `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:2px solid #ffffff;box-shadow:${emphasize ? '0 4px 10px rgba(15,23,42,0.2)' : '0 3px 8px rgba(15,23,42,0.14)'};display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);"><span style="display:block;font-size:${emphasize ? 15 : 13}px;line-height:1;transform:rotate(${-heading}deg);">🚕</span></div>`,
    emphasize ? 'booking-leaflet-driver-live' : 'booking-leaflet-driver',
    [size, size],
    [Math.round(size / 2), Math.round(size / 2)],
  );
}

const LeafletViewportController: React.FC<{
  pickup: google.maps.LatLngLiteral | null;
  dropoff: google.maps.LatLngLiteral | null;
}> = ({ pickup, dropoff }) => {
  const map = useMap();
  // Use primitive values as deps so the effect only fires when coordinates
  // actually change — prevents infinite animation loops from inline arrays.
  const pickupLat = pickup?.lat;
  const pickupLng = pickup?.lng;
  const dropoffLat = dropoff?.lat;
  const dropoffLng = dropoff?.lng;

  useEffect(() => {
    if (!pickupLat || !pickupLng) {
      return;
    }

    if (!dropoffLat || !dropoffLng) {
      map.setView([pickupLat, pickupLng], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }

    map.fitBounds(
      L.latLngBounds([[pickupLat, pickupLng], [dropoffLat, dropoffLng]]),
      { padding: [72, 72], animate: true }
    );
  }, [map, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  return null;
};

export interface BookingMapProps {
  googleMapsApiKey?: string;
  pickup?: BookingMapLocation | null;
  dropoff?: BookingMapLocation | null;
  nearbyDrivers?: NearbyDriver[];
  driverLocation?: DriverLocationUpdate | null;
  mode?: 'booking' | 'tracking';
  height?: number | string;
  colorMode?: 'light' | 'dark' | 'system';
  onPickupChange?: (location: BookingMapLocation | null) => void;
  onDropoffChange?: (location: BookingMapLocation | null) => void;
  onRouteComputed?: (summary: RouteSummary | null) => void;
  onError?: (message: string) => void;
}

function getCarSymbol(rotation: number, fillColor: string, scale = 1): google.maps.Symbol {
  return {
    path: 'M12 2C8.8 2 6.2 4.5 5.6 7.6L4.7 12H3a1 1 0 0 0-1 1v2.2a.8.8 0 0 0 .8.8h1V18a1 1 0 0 0 1 1h1.8a1 1 0 0 0 1-1v-1h8.8v1a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-2h1.2a.8.8 0 0 0 .8-.8V13a1 1 0 0 0-1-1h-1.7l-.9-4.4C17.8 4.5 15.2 2 12 2zm0 2c2.2 0 4.1 1.6 4.5 3.8l.6 3.2H6.9l.6-3.2C7.9 5.6 9.8 4 12 4zm-5.3 9.7a1.5 1.5 0 1 1 0 3.1 1.5 1.5 0 0 1 0-3.1zm10.6 0a1.5 1.5 0 1 1 0 3.1 1.5 1.5 0 0 1 0-3.1z',
    fillColor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeOpacity: 0.95,
    strokeWeight: 1.4,
    rotation,
    scale,
    anchor: new google.maps.Point(12, 12),
  };
}

function getMarkerIcon(label: string, color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 11,
    labelOrigin: new google.maps.Point(0, 1),
  };
}

interface GoogleBookingMapCanvasProps {
  googleMapsApiKey: string;
  currentCenter: google.maps.LatLngLiteral;
  themeMode: 'light' | 'dark';
  pickup: BookingMapLocation | null;
  dropoff: BookingMapLocation | null;
  nearbyDrivers: NearbyDriver[];
  animatedDriverPosition: google.maps.LatLngLiteral | null;
  driverHeading: number;
  routeSummary: RouteSummary | null;
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  onMapLoad: (points: google.maps.LatLngLiteral[]) => void;
  fallback: React.ReactNode;
}

const GoogleBookingMapCanvas: React.FC<GoogleBookingMapCanvasProps> = ({
  googleMapsApiKey,
  currentCenter,
  themeMode,
  pickup,
  dropoff,
  nearbyDrivers,
  animatedDriverPosition,
  driverHeading,
  routeSummary,
  mapRef,
  onMapLoad,
  fallback,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'cab-booking-google-maps',
    googleMapsApiKey,
    libraries,
  });

  if (loadError) {
    return <>{fallback}</>;
  }

  if (!isLoaded) {
    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 6 }} />
      </Box>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={currentCenter}
      zoom={14}
      onLoad={(map) => {
        mapRef.current = map;
        onMapLoad([pickup, dropoff].filter(Boolean) as google.maps.LatLngLiteral[]);
      }}
      onUnmount={() => {
        mapRef.current = null;
      }}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false,
        clickableIcons: false,
        styles: themeMode === 'dark' ? darkMapStyles : undefined,
      }}
    >
      {pickup && (
        <MarkerF
          position={pickup}
          icon={getMarkerIcon('A', MAP_COLORS.accent)}
          label={{ text: 'A', color: '#ffffff', fontWeight: '700' }}
          title={pickup.address || 'Pickup'}
        />
      )}

      {dropoff && (
        <MarkerF
          position={dropoff}
          icon={getMarkerIcon('B', MAP_COLORS.neutral)}
          label={{ text: 'B', color: '#ffffff', fontWeight: '700' }}
          title={dropoff.address || 'Dropoff'}
        />
      )}

      {routeSummary && (
        <PolylineF
          path={routeSummary.polylinePath}
          options={{
            strokeColor: MAP_COLORS.accent,
            strokeOpacity: 0.95,
            strokeWeight: 5,
            zIndex: 11,
          }}
        />
      )}

      {nearbyDrivers.map((driver) => (
        <MarkerF
          key={driver.id}
          position={{ lat: driver.lat, lng: driver.lng }}
          icon={getCarSymbol(driver.heading || 0, MAP_COLORS.neutral, 0.75)}
          title={driver.status || 'Tài xế gần bạn'}
        />
      ))}

      {animatedDriverPosition && (
        <MarkerF
          position={animatedDriverPosition}
          icon={getCarSymbol(driverHeading, MAP_COLORS.accent, 1)}
          title="Vị trí tài xế theo thời gian thực"
          zIndex={999}
        />
      )}

      {MAJOR_CITY_POINTS.map((point) => (
        <MarkerF
          key={point.id}
          position={{ lat: point.lat, lng: point.lng }}
          icon={getMarkerIcon('L', '#7c3aed')}
          title={point.name}
          zIndex={5}
        />
      ))}
    </GoogleMap>
  );
};

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function resolveColorMode(colorMode: BookingMapProps['colorMode']): 'light' | 'dark' {
  if (colorMode === 'light' || colorMode === 'dark') {
    return colorMode;
  }

  return 'light';
}

export const BookingMap: React.FC<BookingMapProps> = ({
  googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  pickup = null,
  dropoff = null,
  nearbyDrivers = [],
  driverLocation = null,
  mode = 'booking',
  height = '100vh',
  colorMode = 'light',
  onPickupChange,
  onDropoffChange,
  onRouteComputed,
  onError,
}) => {
  const themeMode = resolveColorMode(colorMode);
  const hasGoogleMapsApiKey = googleMapsApiKey.trim().length > 0;
  const animationFrameRef = useRef<number | null>(null);
  const predictionRequestRef = useRef(0);
  const predictionDebounceRef = useRef<Partial<Record<SearchField, number>>>({});
  const routeRequestRef = useRef(0);
  const mapRef = useRef<google.maps.Map | null>(null);
  const animatedDriverRef = useRef<google.maps.LatLngLiteral | null>(null);
  const driverHeadingRef = useRef(0);

  const [pickupInput, setPickupInput] = useState(pickup?.address || '');
  const [dropoffInput, setDropoffInput] = useState(dropoff?.address || '');
  const [pickupOptions, setPickupOptions] = useState<PlacePredictionOption[]>([]);
  const [dropoffOptions, setDropoffOptions] = useState<PlacePredictionOption[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState<Record<SearchField, boolean>>({ pickup: false, dropoff: false });
  const [animatedDriverPosition, setAnimatedDriverPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const searchContextLabel = useMemo(() => getSearchContextLabel(pickup?.address, dropoff?.address), [dropoff?.address, pickup?.address]);
  const visibleNearbyDrivers = nearbyDrivers;

  useEffect(() => {
    setPickupInput(pickup?.address || '');
  }, [pickup?.address]);

  useEffect(() => {
    setDropoffInput(dropoff?.address || '');
  }, [dropoff?.address]);

  const fetchPredictions = useCallback(async (field: SearchField, value: string) => {
    const query = value.trim();
    const requestId = ++predictionRequestRef.current;

    if (query.length < 2) {
      if (field === 'pickup') {
        setPickupOptions([]);
      } else {
        setDropoffOptions([]);
      }
      setPredictionLoading((prev) => ({ ...prev, [field]: false }));
      return;
    }

    setPredictionLoading((prev) => ({ ...prev, [field]: true }));

    try {
      const results = await geocodeAddress(query, {
        contextLabel: searchContextLabel,
        lat: pickup?.lat,
        lng: pickup?.lng,
      });
      if (predictionRequestRef.current !== requestId) {
        return;
      }

      const seenDescriptions = new Set<string>();
      const normalized = results
        .filter((result) => {
          const description = (result.address || query)
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
          if (seenDescriptions.has(description)) {
            return false;
          }

          seenDescriptions.add(description);
          return true;
        })
        .slice(0, 7)
        .map((result, index) => {
          const [primaryText, ...secondaryParts] = (result.address || query)
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);

          return {
            description: result.address || query,
            placeId: `${field}-${index}-${result.lat}-${result.lng}`,
            primaryText: primaryText || result.address || query,
            secondaryText: secondaryParts.join(', '),
            lat: result.lat,
            lng: result.lng,
          };
        });

      if (field === 'pickup') {
        setPickupOptions(normalized);
      } else {
        setDropoffOptions(normalized);
      }
    } catch {
        if (field === 'pickup') {
          setPickupOptions([]);
        } else {
          setDropoffOptions([]);
        }
    } finally {
      if (predictionRequestRef.current === requestId) {
        setPredictionLoading((prev) => ({ ...prev, [field]: false }));
      }
    }
  }, [searchContextLabel]);

  const queuePredictionFetch = useCallback((field: SearchField, value: string) => {
    if (predictionDebounceRef.current[field]) {
      window.clearTimeout(predictionDebounceRef.current[field]);
    }

    predictionDebounceRef.current[field] = window.setTimeout(() => {
      void fetchPredictions(field, value);
    }, 200);
  }, [fetchPredictions]);

  const fitMapToLocations = useCallback((points: google.maps.LatLngLiteral[]) => {
    const map = mapRef.current;

    if (!map || points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.panTo(points[0]);
      map.setZoom(Math.max(map.getZoom() || 15, 15));
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 72);
  }, []);

  const commitLocation = useCallback(
    (field: SearchField, location: BookingMapLocation | null) => {
      if (field === 'pickup') {
        onPickupChange?.(location);
      } else {
        onDropoffChange?.(location);
      }

      const candidatePoints = [
        field === 'pickup' ? location : pickup,
        field === 'dropoff' ? location : dropoff,
      ].filter(Boolean) as google.maps.LatLngLiteral[];

      fitMapToLocations(candidatePoints);
    },
    [dropoff, fitMapToLocations, onDropoffChange, onPickupChange, pickup],
  );

  const resolvePrediction = useCallback(
    async (field: SearchField, option: PlacePredictionOption | string | null) => {
      if (!option) {
        return;
      }

      let resolvedOption: PlacePredictionOption;

      if (typeof option === 'string') {
        const [result] = await geocodeAddress(option, { contextLabel: searchContextLabel });

        if (!result) {
          onError?.(`Không tìm thấy địa điểm phù hợp cho "${option}".`);
          return;
        }

        const [primaryText, ...secondaryParts] = (result.address || option)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);

        resolvedOption = {
          description: result.address || option,
          placeId: `${field}-manual-${result.lat}-${result.lng}`,
          primaryText: primaryText || result.address || option,
          secondaryText: secondaryParts.join(', '),
          lat: result.lat,
          lng: result.lng,
        };
      } else {
        resolvedOption = option;
      }

      const location = {
        lat: resolvedOption.lat,
        lng: resolvedOption.lng,
        address: resolvedOption.description,
        placeId: resolvedOption.placeId,
      };

      if (field === 'pickup') {
        setPickupInput(location.address || resolvedOption.description);
        setPickupOptions([]);
      } else {
        setDropoffInput(location.address || resolvedOption.description);
        setDropoffOptions([]);
      }

      commitLocation(field, location);
    },
    [commitLocation, onError, searchContextLabel],
  );

  useEffect(() => {
    let cancelled = false;
    const requestId = ++routeRequestRef.current;

    if (!pickup || !dropoff) {
      setRouteSummary(null);
      setRouteLoading(false);
      onRouteComputed?.(null);
      return;
    }

    setRouteLoading(true);

    void (async () => {
      try {
        const route = await getRoute(pickup, dropoff);
        if (cancelled || !route || routeRequestRef.current !== requestId) {
          return;
        }

        const summary: RouteSummary = {
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          distanceText: formatDistance(route.distance),
          durationText: `${Math.max(1, Math.round(route.duration / 60))} min`,
          polylinePath: (route.geometry?.coordinates || []).map(([lng, lat]) => ({ lat, lng })),
        };

        setRouteSummary(summary);
        onRouteComputed?.(summary);
        fitMapToLocations([pickup, dropoff]);
      } catch {
        if (!cancelled && routeRequestRef.current === requestId) {
          setRouteSummary(null);
          onRouteComputed?.(null);
        }
      } finally {
        if (!cancelled && routeRequestRef.current === requestId) {
          setRouteLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dropoff, fitMapToLocations, onRouteComputed, pickup]);

  useEffect(() => {
    if (!driverLocation) {
      return;
    }

    const nextPosition = { lat: driverLocation.lat, lng: driverLocation.lng };

    if (!animatedDriverRef.current) {
      animatedDriverRef.current = nextPosition;
      driverHeadingRef.current = driverLocation.heading || 0;
      setAnimatedDriverPosition(nextPosition);
      setDriverHeading(driverHeadingRef.current);
      return;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const fromPosition = animatedDriverRef.current;
    const toHeading =
      typeof driverLocation.heading === 'number'
        ? driverLocation.heading
        : calculateHeading(fromPosition, nextPosition);
    const fromHeading = driverHeadingRef.current;
    const startedAt = performance.now();
    const duration = estimateAnimationDurationMs(fromPosition, nextPosition);

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = easeInOutCubic(progress);
      const interpolatedPosition = interpolatePosition(fromPosition, nextPosition, eased);
      const interpolatedHeading = interpolateHeading(fromHeading, toHeading, eased);

      animatedDriverRef.current = interpolatedPosition;
      driverHeadingRef.current = interpolatedHeading;
      setAnimatedDriverPosition(interpolatedPosition);
      setDriverHeading(interpolatedHeading);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [driverLocation]);

  useEffect(() => {
    const pickupDebounce = predictionDebounceRef.current.pickup;
    const dropoffDebounce = predictionDebounceRef.current.dropoff;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (pickupDebounce) {
        window.clearTimeout(pickupDebounce);
      }
      if (dropoffDebounce) {
        window.clearTimeout(dropoffDebounce);
      }
    };
  }, []);

  const currentCenter = useMemo(() => {
    if (animatedDriverPosition && mode === 'tracking') {
      return animatedDriverPosition;
    }
    if (pickup) {
      return pickup;
    }
    return defaultCenter;
  }, [animatedDriverPosition, mode, pickup]);

  const handleLocateMe = useCallback(() => {
    void (async () => {
      try {
        const currentLocation = await getCurrentLocation();
        const location = {
          ...currentLocation,
          address: 'Vị trí hiện tại',
        };

        mapRef.current?.panTo(location);
        mapRef.current?.setZoom(16);
        commitLocation('pickup', location);
        setPickupInput(location.address || 'Vị trí hiện tại');
      } catch {
        onError?.('Không lấy được vị trí hiện tại của bạn. Hãy kiểm tra GPS hoặc nhập địa chỉ thủ công.');
      }
    })();
  }, [commitLocation, onError]);

  const searchPanel = (
    <Paper
      elevation={8}
      sx={{
        p: 2,
        borderRadius: 4,
        position: 'relative',
        zIndex: 3,
        backgroundColor: themeMode === 'dark' ? 'rgba(17, 24, 39, 0.96)' : '#ffffff',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {routeLoading && <Chip size="small" label="Đang tính lộ trình" color="warning" variant="outlined" />}
        </Stack>
        <Autocomplete
          freeSolo
          clearOnBlur={false}
          options={pickupOptions}
          loading={predictionLoading.pickup}
          loadingText="Đang tìm địa điểm..."
          noOptionsText={pickupInput.trim().length < 2 ? 'Nhập ít nhất 2 ký tự' : 'Không có gợi ý phù hợp'}
          filterOptions={(options) => options}
          getOptionLabel={getPredictionLabel}
          inputValue={pickupInput}
          onInputChange={(_event, value, reason) => {
            setPickupInput(value);
            if (reason === 'input') {
              queuePredictionFetch('pickup', value);
            }
          }}
          onChange={(_event, option) => resolvePrediction('pickup', option)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Điểm đón"
              size="small"
              fullWidth
              inputProps={{
                ...params.inputProps,
                'data-testid': 'pickup-location-input',
              }}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <NearMeRounded sx={{ color: MAP_COLORS.accent }} />
                  </InputAdornment>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <ListItem {...props} key={option.placeId || option.description} disablePadding>
              <ListItemText primary={option.primaryText} secondary={option.secondaryText} />
            </ListItem>
          )}
        />

        <Autocomplete
          freeSolo
          clearOnBlur={false}
          options={dropoffOptions}
          loading={predictionLoading.dropoff}
          loadingText="Đang tìm địa điểm..."
          noOptionsText={dropoffInput.trim().length < 2 ? 'Nhập ít nhất 2 ký tự' : 'Không có gợi ý phù hợp'}
          filterOptions={(options) => options}
          getOptionLabel={getPredictionLabel}
          inputValue={dropoffInput}
          onInputChange={(_event, value, reason) => {
            setDropoffInput(value);
            if (reason === 'input') {
              queuePredictionFetch('dropoff', value);
            }
          }}
          onChange={(_event, option) => resolvePrediction('dropoff', option)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Điểm đến"
              size="small"
              fullWidth
              inputProps={{
                ...params.inputProps,
                'data-testid': 'dropoff-location-input',
              }}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <PlaceRounded sx={{ color: MAP_COLORS.neutral }} />
                  </InputAdornment>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <ListItem {...props} key={option.placeId || option.description} disablePadding>
              <ListItemText primary={option.primaryText} secondary={option.secondaryText} />
            </ListItem>
          )}
        />
      </Stack>
    </Paper>
  );

  const summaryPanel = mode === 'tracking' ? (
    <Paper
      elevation={10}
      sx={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        p: 2,
        borderRadius: 5,
        backgroundColor: themeMode === 'dark' ? 'rgba(17, 24, 39, 0.88)' : 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(14px)',
        zIndex: 2,
      }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 0 }}>
        {routeSummary && (
          <Chip icon={<RouteRounded />} label={routeSummary.distanceText} variant="outlined" />
        )}
        {routeSummary && (
          <Chip icon={<AccessTimeRounded />} label={routeSummary.durationText} variant="outlined" />
        )}
      </Stack>

    </Paper>
  ) : null;

  const leafletTileUrl =
    themeMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const leafletAttribution =
    themeMode === 'dark'
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const leafletMap = (
    <LeafletMapContainer
      center={[currentCenter.lat, currentCenter.lng]}
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
      <LeafletViewportController pickup={pickup ?? null} dropoff={dropoff ?? null} />
      {pickup && <LeafletMarker position={[pickup.lat, pickup.lng]} icon={createLeafletPin('A', MAP_COLORS.accent)} />}
      {dropoff && <LeafletMarker position={[dropoff.lat, dropoff.lng]} icon={createLeafletPin('B', MAP_COLORS.neutral)} />}
      {routeSummary && (
        <LeafletPolyline
          positions={routeSummary.polylinePath.map((point) => [point.lat, point.lng])}
          pathOptions={{ color: MAP_COLORS.accent, opacity: 0.95, weight: 5 }}
        />
      )}
      {visibleNearbyDrivers.map((driver) => (
        <LeafletMarker
          key={driver.id}
          position={[driver.lat, driver.lng]}
          icon={createLeafletDriverIcon(MAP_COLORS.neutral, driver.heading || 0)}
        />
      ))}
      {animatedDriverPosition && (
        <LeafletMarker
          position={[animatedDriverPosition.lat, animatedDriverPosition.lng]}
          icon={createLeafletDriverIcon(MAP_COLORS.accent, driverHeading, true)}
        />
      )}

      {MAJOR_CITY_POINTS.map((point) => (
        <LeafletMarker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={createLeafletPin('L', '#7c3aed')}
        />
      ))}
    </LeafletMapContainer>
  );

  const renderSearchPanelAsSection = mode === 'booking';

  return (
    <Box
      sx={{
        width: '100%',
        height,
        display: 'grid',
        gridTemplateRows: renderSearchPanelAsSection ? 'auto 1fr' : '1fr',
        gap: renderSearchPanelAsSection ? 1.5 : 0,
      }}
    >
      {renderSearchPanelAsSection && searchPanel}

      <Box sx={{ position: 'relative', minHeight: 0, overflow: 'hidden', borderRadius: 6, bgcolor: '#e2e8f0', border: '1px solid rgba(148,163,184,0.14)' }}>
        {hasGoogleMapsApiKey ? (
          <GoogleBookingMapCanvas
            googleMapsApiKey={googleMapsApiKey}
            currentCenter={currentCenter}
            themeMode={themeMode}
            pickup={pickup}
            dropoff={dropoff}
            nearbyDrivers={visibleNearbyDrivers}
            animatedDriverPosition={animatedDriverPosition}
            driverHeading={driverHeading}
            routeSummary={routeSummary}
            mapRef={mapRef}
            onMapLoad={fitMapToLocations}
            fallback={leafletMap}
          />
        ) : leafletMap}

        <Box sx={{ position: 'absolute', right: 16, bottom: mode === 'tracking' ? 144 : 16, zIndex: 2 }}>
          <IconButton
            onClick={handleLocateMe}
            sx={{
              width: 52,
              height: 52,
              backgroundColor: themeMode === 'dark' ? 'rgba(17, 24, 39, 0.9)' : '#ffffff',
              boxShadow: 4,
              '&:hover': {
                backgroundColor: themeMode === 'dark' ? 'rgba(31, 41, 55, 0.95)' : '#f8fafc',
              },
            }}
          >
            <MyLocationRounded color="primary" />
          </IconButton>
        </Box>

        {summaryPanel}
      </Box>
    </Box>
  );
};

export default BookingMap;
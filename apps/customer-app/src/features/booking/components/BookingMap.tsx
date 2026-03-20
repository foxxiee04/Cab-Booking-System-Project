import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTimeRounded,
  DirectionsCarFilledRounded,
  MyLocationRounded,
  NearMeRounded,
  PlaceRounded,
  RouteRounded,
} from '@mui/icons-material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
      return normalized.includes('thanh pho') || normalized.includes('tinh') || normalized.includes('ho chi minh') || normalized.includes('ha noi');
    });

    if (directMatch) {
      return directMatch;
    }

    if (parts.length >= 2) {
      return parts[parts.length - 2];
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
    `<div style="width:30px;height:30px;border-radius:999px;background:${color};border:3px solid #ffffff;color:#ffffff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(15,23,42,0.18);">${label}</div>`,
    'booking-leaflet-pin',
    [30, 30],
    [15, 15],
  );
}

function createLeafletDriverIcon(color: string, heading = 0, emphasize = false) {
  const size = emphasize ? 30 : 24;
  return getLeafletMarkerIcon(
    `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:3px solid #ffffff;box-shadow:0 10px 24px rgba(15,23,42,0.22);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);"><span style="display:block;font-size:${emphasize ? 14 : 12}px;line-height:1;transform:rotate(${-heading}deg);">🚕</span></div>`,
    emphasize ? 'booking-leaflet-driver-live' : 'booking-leaflet-driver',
    [size, size],
    [Math.round(size / 2), Math.round(size / 2)],
  );
}

const LeafletViewportController: React.FC<{ points: google.maps.LatLngLiteral[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 15), { animate: true });
      return;
    }

    map.fitBounds(
      L.latLngBounds(points.map((point) => [point.lat, point.lng])),
      { padding: [72, 72], animate: true }
    );
  }, [map, points]);

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
    strokeWeight: 1,
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
    scale: 12,
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
          icon={getMarkerIcon('A', '#16a34a')}
          label={{ text: 'A', color: '#ffffff', fontWeight: '700' }}
          title={pickup.address || 'Pickup'}
        />
      )}

      {dropoff && (
        <MarkerF
          position={dropoff}
          icon={getMarkerIcon('B', '#dc2626')}
          label={{ text: 'B', color: '#ffffff', fontWeight: '700' }}
          title={dropoff.address || 'Dropoff'}
        />
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
              strokeColor: '#0f62fe',
              strokeOpacity: 0.98,
              strokeWeight: 6,
              zIndex: 11,
            }}
          />
        </>
      )}

      {nearbyDrivers.map((driver) => (
        <MarkerF
          key={driver.id}
          position={{ lat: driver.lat, lng: driver.lng }}
          icon={getCarSymbol(driver.heading || 0, '#111827', 0.75)}
          title={driver.status || 'Nearby driver'}
        />
      ))}

      {animatedDriverPosition && (
        <MarkerF
          position={animatedDriverPosition}
          icon={getCarSymbol(driverHeading, '#f97316', 1)}
          title="Driver live location"
          zIndex={999}
        />
      )}
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

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
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
  colorMode = 'system',
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
      const results = await geocodeAddress(query, { contextLabel: searchContextLabel });
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
    }, 280);
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
        backgroundColor: themeMode === 'dark' ? 'rgba(17, 24, 39, 0.96)' : 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip size="small" label={`Gợi ý quanh ${searchContextLabel}`} variant="outlined" />
          <Chip size="small" label="Tìm được bến xe, ga, sân bay, địa chỉ cụ thể" sx={{ bgcolor: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }} />
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
              placeholder="Nhập vị trí đón"
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
                    <NearMeRounded sx={{ color: '#16a34a' }} />
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
              placeholder="Bạn muốn đi đâu?"
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
                    <PlaceRounded sx={{ color: '#2563eb' }} />
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
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Chip
          icon={<DirectionsCarFilledRounded />}
          label={`${nearbyDrivers.length} tài xế gần bạn`}
          color="primary"
          variant="filled"
        />
        {routeSummary && (
          <Chip icon={<RouteRounded />} label={routeSummary.distanceText} variant="outlined" />
        )}
        {routeSummary && (
          <Chip icon={<AccessTimeRounded />} label={routeSummary.durationText} variant="outlined" />
        )}
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        {mode === 'tracking' ? 'Theo dõi tài xế theo thời gian thực' : 'Đặt xe trên bản đồ thời gian thực'}
      </Typography>

      <Typography variant="body2" color="text.secondary">
        {routeSummary
          ? `Tuyến đường đã sẵn sàng. ETA dự kiến ${routeSummary.durationText}, quãng đường ${routeSummary.distanceText}.`
          : 'Chọn điểm đón và điểm đến để tính ETA, hiển thị tuyến đường và xem tài xế lân cận.'}
      </Typography>

      {animatedDriverPosition && (
        <List disablePadding sx={{ mt: 1.5 }}>
          <ListItem disableGutters>
            <ListItemText
              primary="Vị trí tài xế đang được nội suy mượt"
              secondary={`${animatedDriverPosition.lat.toFixed(5)}, ${animatedDriverPosition.lng.toFixed(5)}`}
            />
          </ListItem>
        </List>
      )}
    </Paper>
  ) : null;

  const leafletMap = (
    <LeafletMapContainer
      center={[currentCenter.lat, currentCenter.lng]}
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
      <LeafletViewportController points={[pickup, dropoff].filter(Boolean) as google.maps.LatLngLiteral[]} />
      {pickup && <LeafletMarker position={[pickup.lat, pickup.lng]} icon={createLeafletPin('A', '#16a34a')} />}
      {dropoff && <LeafletMarker position={[dropoff.lat, dropoff.lng]} icon={createLeafletPin('B', '#dc2626')} />}
      {routeSummary && (
        <>
          <LeafletPolyline
            positions={routeSummary.polylinePath.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: '#ffffff', opacity: 0.92, weight: 10 }}
          />
          <LeafletPolyline
            positions={routeSummary.polylinePath.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: '#0f62fe', opacity: 0.98, weight: 6 }}
          />
        </>
      )}
      {nearbyDrivers.map((driver) => (
        <LeafletMarker
          key={driver.id}
          position={[driver.lat, driver.lng]}
          icon={createLeafletDriverIcon('#111827', driver.heading || 0)}
        />
      ))}
      {animatedDriverPosition && (
        <LeafletMarker
          position={[animatedDriverPosition.lat, animatedDriverPosition.lng]}
          icon={createLeafletDriverIcon('#f97316', driverHeading, true)}
        />
      )}
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

      <Box sx={{ position: 'relative', minHeight: 0, overflow: 'hidden', borderRadius: 6, bgcolor: '#dbeafe', border: '1px solid rgba(148,163,184,0.12)' }}>
        {hasGoogleMapsApiKey ? (
          <GoogleBookingMapCanvas
            googleMapsApiKey={googleMapsApiKey}
            currentCenter={currentCenter}
            themeMode={themeMode}
            pickup={pickup}
            dropoff={dropoff}
            nearbyDrivers={nearbyDrivers}
            animatedDriverPosition={animatedDriverPosition}
            driverHeading={driverHeading}
            routeSummary={routeSummary}
            mapRef={mapRef}
            onMapLoad={fitMapToLocations}
            fallback={leafletMap}
          />
        ) : leafletMap}

        {mode === 'tracking' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 26%, rgba(15,23,42,0.04) 100%)',
              zIndex: 1,
            }}
          />
        )}

        {!renderSearchPanelAsSection && (
          <Box sx={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 2 }}>
            {searchPanel}
          </Box>
        )}

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
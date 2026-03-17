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
import { geocodeAddress, getRoute } from '../../../utils/map.utils';
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
  const size = emphasize ? 26 : 20;
  return getLeafletMarkerIcon(
    `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:3px solid #ffffff;box-shadow:0 10px 24px rgba(15,23,42,0.22);transform:rotate(${heading}deg);"></div>`,
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const animatedDriverRef = useRef<google.maps.LatLngLiteral | null>(null);
  const driverHeadingRef = useRef(0);

  const [pickupInput, setPickupInput] = useState(pickup?.address || '');
  const [dropoffInput, setDropoffInput] = useState(dropoff?.address || '');
  const [pickupOptions, setPickupOptions] = useState<PlacePredictionOption[]>([]);
  const [dropoffOptions, setDropoffOptions] = useState<PlacePredictionOption[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [animatedDriverPosition, setAnimatedDriverPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'cab-booking-google-maps',
    googleMapsApiKey,
    libraries,
  });

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
      return;
    }

    try {
      const results = await geocodeAddress(query);
      if (predictionRequestRef.current !== requestId) {
        return;
      }

      const normalized = results.slice(0, 7).map((result, index) => {
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
    }
  }, []);

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
        const [result] = await geocodeAddress(option);

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
    [commitLocation, onError],
  );

  useEffect(() => {
    let cancelled = false;

    if (!pickup || !dropoff) {
      setRouteSummary(null);
      onRouteComputed?.(null);
      return;
    }

    if (isLoaded && window.google) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: pickup,
          destination: dropoff,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        },
        (result, status) => {
          if (cancelled) {
            return;
          }

          if (status !== google.maps.DirectionsStatus.OK || !result?.routes?.[0]?.legs?.[0]) {
            setRouteSummary(null);
            onRouteComputed?.(null);
            onError?.('Không thể tính tuyến đường giữa điểm đón và điểm đến.');
            return;
          }

          const primaryRoute = result.routes[0];
          const leg = primaryRoute.legs[0];
          const summary: RouteSummary = {
            distanceMeters: leg.distance?.value || 0,
            durationSeconds: leg.duration?.value || 0,
            distanceText: leg.distance?.text || formatDistance(leg.distance?.value || 0),
            durationText: leg.duration?.text || `${Math.round((leg.duration?.value || 0) / 60)} min`,
            polylinePath: primaryRoute.overview_path.map((point) => ({
              lat: point.lat(),
              lng: point.lng(),
            })),
          };

          setRouteSummary(summary);
          onRouteComputed?.(summary);
          fitMapToLocations([pickup, dropoff]);
        },
      );
    } else {
      void (async () => {
        try {
          const route = await getRoute(pickup, dropoff);
          if (cancelled || !route) {
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
          if (!cancelled) {
            setRouteSummary(null);
            onRouteComputed?.(null);
          }
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [dropoff, fitMapToLocations, isLoaded, onError, onRouteComputed, pickup]);

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
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
    if (!navigator.geolocation) {
      onError?.('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Vị trí hiện tại',
        };
        mapRef.current?.panTo(location);
        mapRef.current?.setZoom(16);

        if (!pickup) {
          commitLocation('pickup', location);
          setPickupInput(location.address || 'Vị trí hiện tại');
        }
      },
      () => {
        onError?.('Không lấy được vị trí hiện tại của bạn.');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [commitLocation, onError, pickup]);

  const searchPanel = (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        p: 2,
        borderRadius: 4,
        backgroundColor: themeMode === 'dark' ? 'rgba(17, 24, 39, 0.88)' : 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Autocomplete
          freeSolo
          clearOnBlur={false}
          options={pickupOptions}
          filterOptions={(options) => options}
          getOptionLabel={getPredictionLabel}
          inputValue={pickupInput}
          onInputChange={(_event, value, reason) => {
            setPickupInput(value);
            if (reason === 'input') {
              void fetchPredictions('pickup', value);
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
          filterOptions={(options) => options}
          getOptionLabel={getPredictionLabel}
          inputValue={dropoffInput}
          onInputChange={(_event, value, reason) => {
            setDropoffInput(value);
            if (reason === 'input') {
              void fetchPredictions('dropoff', value);
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

  const summaryPanel = (
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
  );

  if (!hasGoogleMapsApiKey || loadError) {
    return (
      <Box sx={{ position: 'relative', width: '100%', height, borderRadius: 6, overflow: 'hidden', bgcolor: '#e2e8f0' }}>
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
          {dropoff && <LeafletMarker position={[dropoff.lat, dropoff.lng]} icon={createLeafletPin('B', '#2563eb')} />}
          {routeSummary && (
            <LeafletPolyline
              positions={routeSummary.polylinePath.map((point) => [point.lat, point.lng])}
              pathOptions={{ color: '#0f62fe', opacity: 0.95, weight: 6 }}
            />
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
        {searchPanel}
        <Box sx={{ position: 'absolute', right: 16, bottom: 144, zIndex: 2 }}>
          <IconButton
            onClick={handleLocateMe}
            sx={{
              width: 52,
              height: 52,
              backgroundColor: '#ffffff',
              boxShadow: 4,
              '&:hover': {
                backgroundColor: '#f8fafc',
              },
            }}
          >
            <MyLocationRounded color="primary" />
          </IconButton>
        </Box>
        {summaryPanel}
      </Box>
    );
  }

  if (!isLoaded) {
    return (
      <Box sx={{ position: 'relative', width: '100%', height }}>
        <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 6 }} />
        <Paper sx={{ position: 'absolute', top: 16, left: 16, right: 16, p: 2, borderRadius: 4 }}>
          <Skeleton height={56} sx={{ mb: 1 }} />
          <Skeleton height={56} />
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height, overflow: 'hidden', borderRadius: 6 }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={currentCenter}
        zoom={14}
        onLoad={(map) => {
          mapRef.current = map;
          fitMapToLocations([pickup, dropoff].filter(Boolean) as google.maps.LatLngLiteral[]);
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
            icon={getMarkerIcon('B', '#2563eb')}
            label={{ text: 'B', color: '#ffffff', fontWeight: '700' }}
            title={dropoff.address || 'Dropoff'}
          />
        )}

        {routeSummary && (
          <PolylineF
            path={routeSummary.polylinePath}
            options={{
              strokeColor: '#0f62fe',
              strokeOpacity: 0.95,
              strokeWeight: 6,
            }}
          />
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

      {searchPanel}

      <Box sx={{ position: 'absolute', right: 16, bottom: 144, zIndex: 2 }}>
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
  );
};

export default BookingMap;
import { Location, RouteData } from '../types';
import axiosInstance from '../api/axios.config';

// Simple in-memory cache for geocoding results - improves performance
const geocodeCache = new Map<string, { results: Location[]; timestamp: number }>();
const reverseGeocodeCache = new Map<string, { address: string; timestamp: number }>();
const routeCache = new Map<string, { route: RouteData; timestamp: number }>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

const cleanCache = (cache: Map<string, any>) => {
  if (cache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
  }
};

// Geocode address to coordinates - WITH CACHING
export const geocodeAddress = async (address: string): Promise<Location[]> => {
  const cacheKey = address.toLowerCase().trim();
  const cached = geocodeCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }

  try {
    const response = await axiosInstance.get('/map/geocode', {
      params: { q: address, limit: 7 },
    });

    const results = response.data?.data?.results || [];
    geocodeCache.set(cacheKey, { results, timestamp: Date.now() });
    cleanCache(geocodeCache);
    return results;
  } catch (error) {
    console.error('Geocoding error:', error);
    return cached?.results || [];
  }
};

// Reverse geocode coordinates to address - WITH CACHING
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cached = reverseGeocodeCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.address;
  }

  try {
    const response = await axiosInstance.get('/map/reverse', {
      params: { lat, lng },
    });

    const address = response.data?.data?.display_name || 'Unknown location';
    reverseGeocodeCache.set(cacheKey, { address, timestamp: Date.now() });
    cleanCache(reverseGeocodeCache);
    return address;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return cached?.address || 'Unknown location';
  }
};

// Get route between two locations - WITH CACHING
export const getRoute = async (
  start: Location,
  end: Location
): Promise<RouteData | null> => {
  const cacheKey = `${start.lat.toFixed(6)},${start.lng.toFixed(6)}-${end.lat.toFixed(6)},${end.lng.toFixed(6)}`;
  const cached = routeCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.route;
  }

  try {
    const response = await axiosInstance.get('/map/route', {
      params: {
        fromLat: start.lat,
        fromLng: start.lng,
        toLat: end.lat,
        toLng: end.lng,
      },
    });

    const route = response.data?.data;
    if (!route?.geometry?.coordinates) {
      return null;
    }

    const routeData: RouteData = {
      coordinates: route.geometry.coordinates,
      distance: route.distance,
      duration: route.duration,
    };

    routeCache.set(cacheKey, { route: routeData, timestamp: Date.now() });
    cleanCache(routeCache);
    return routeData;
  } catch (error) {
    console.error('Routing error:', error);
    return cached?.route || null;
  }
};

// Calculate distance between two points (Haversine formula)
export const calculateDistance = (loc1: Location, loc2: Location): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLon = toRad(loc2.lng - loc1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(loc1.lat)) *
      Math.cos(toRad(loc2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

// Format distance
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

// Format duration
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} giờ ${remainingMinutes} phút`;
};

// Demo fallback locations keyed by driver phone number.
// Used when the browser denies GPS permission (e.g. DevTools Sensors not set).
// IUH (Đại học Công Nghiệp) = 10.8192, 106.6685
// Bến Thành cluster — khớp seed (`0911234561` …) để E2E pickup "Ben Thanh" bắt tài xế.
// Drivers placed at distinct distances to demonstrate 3-round dispatch:
//   Round 1 (2km radius)  → catches Driver A at ~1.5km
//   Round 2 (3km radius)  → catches Driver B at ~2.7km
//   Round 3 (5km radius)  → catches Driver C at ~4.2km
// Drivers cụm Chợ Bến Thành — khớp `scripts/seed-database.ts` (E2E: pickup Ben Thanh).
const DEMO_DRIVER_FALLBACK_LOCATIONS: Record<string, Location> = {
  '0911234561': { lat: 10.77295, lng: 106.69905 },
  '0911234562': { lat: 10.77195, lng: 106.69855 },
  '0911234568': { lat: 10.77215, lng: 106.69675 },
  '0911234583': { lat: 10.8327, lng: 106.6876 }, // Pham Van Bao  — ~1.2km N of IUH (Round 1, 2km)
  '0911234585': { lat: 10.8463, lng: 106.6876 }, // Le Thi Mai    — ~2.7km N of IUH (Round 2, 3km)
  '0911234573': { lat: 10.8551, lng: 106.6685 }, // Le Minh N     — ~4.2km N of IUH (Round 3, 5km)
};

export const getDemoFallbackLocation = (phoneNumber?: string | null): Location | null =>
  (phoneNumber && DEMO_DRIVER_FALLBACK_LOCATIONS[phoneNumber]) || null;

// Maps geo watchId → fallback interval id (activated when GPS is denied and fallback kicks in)
const fallbackIntervalMap = new Map<number, number>();

// Get current location from browser
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

// Watch position for continuous updates.
// If `fallbackLocation` is provided and GPS permission is denied (code 1),
// the fallback coordinates are emitted immediately and refreshed every 5 s.
export const watchPosition = (
  callback: (location: Location) => void,
  errorCallback?: (error: GeolocationPositionError) => void,
  fallbackLocation?: Location
): number => {
  if (!navigator.geolocation) {
    if (fallbackLocation) {
      // No geolocation API at all — use interval-based fallback
      callback(fallbackLocation);
      const intervalId = window.setInterval(() => callback(fallbackLocation), 5000);
      return -intervalId; // negative sentinel: handled by clearWatch
    }
    throw new Error('Geolocation not supported');
  }

  const geoWatchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    (error) => {
      if (error.code === 1 /* PERMISSION_DENIED */ && fallbackLocation) {
        // Switch to fallback interval once (guard against repeated error events)
        if (!fallbackIntervalMap.has(geoWatchId)) {
          console.info('[Demo] GPS permission denied — using hardcoded demo location:', fallbackLocation);
          callback(fallbackLocation);
          const intervalId = window.setInterval(() => callback(fallbackLocation), 5000);
          fallbackIntervalMap.set(geoWatchId, intervalId);
        }
        // Do not surface the error to the UI when fallback takes over
      } else {
        errorCallback?.(error);
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    }
  );

  return geoWatchId;
};

// Clear position watch (handles both geo watchIds and interval-based fallback sentinels)
export const clearWatch = (watchId: number): void => {
  if (watchId < 0) {
    // Negative sentinel = interval-based fallback (no geolocation API)
    window.clearInterval(-watchId);
    return;
  }

  // Clear any active fallback interval for this geo watch
  const intervalId = fallbackIntervalMap.get(watchId);
  if (intervalId !== undefined) {
    window.clearInterval(intervalId);
    fallbackIntervalMap.delete(watchId);
  }

  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
};

// Validate location
export const isValidLocation = (location: Location): boolean => {
  return (
    location &&
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
};

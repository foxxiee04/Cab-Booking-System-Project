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
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

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

// Watch position for continuous updates
export const watchPosition = (
  callback: (location: Location) => void,
  errorCallback?: (error: GeolocationPositionError) => void
): number => {
  if (!navigator.geolocation) {
    throw new Error('Geolocation not supported');
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    errorCallback,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    }
  );
};

// Clear position watch
export const clearWatch = (watchId: number): void => {
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

import { Location, RouteData } from '../types';
import axiosInstance from '../api/axios.config';

// Simple in-memory cache for geocoding results
// This reduces external API calls and improves performance
const geocodeCache = new Map<string, { results: Location[]; timestamp: number }>();
const reverseGeocodeCache = new Map<string, { address: string; timestamp: number }>();
const routeCache = new Map<string, { route: RouteData; timestamp: number }>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const MAX_CACHE_SIZE = 100; // Limit cache size to prevent memory issues

// Clear old cache entries
const cleanCache = (cache: Map<string, any>) => {
  if (cache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }
    // If still too large, remove oldest entries
    if (cache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => cache.delete(key));
    }
  }
};

/**
 * Geocode address to coordinates (Forward Geocoding)
 * NOW WITH CACHING to reduce external API calls
 */
export const geocodeAddress = async (
  address: string,
  options?: { signal?: AbortSignal }
): Promise<Location[]> => {
  const cacheKey = address.toLowerCase().trim();

  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }

  try {
    const response = await axiosInstance.get('/map/geocode', {
      params: { q: address, limit: 7 },
      signal: options?.signal,
    });

    const results = response.data?.data?.results || [];

    // Store in cache
    geocodeCache.set(cacheKey, { results, timestamp: Date.now() });
    cleanCache(geocodeCache);

    return results;
  } catch (error) {
    console.error('Geocoding error:', error);
    // Return cached result if available, even if expired
    return cached?.results || [];
  }
};

/**
 * Reverse geocode coordinates to address
 * NOW WITH CACHING to reduce external API calls
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  // Check cache first
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.address;
  }

  try {
    const response = await axiosInstance.get('/map/reverse', {
      params: { lat, lng },
    });

    const address = response.data?.data?.display_name || 'Unknown location';

    // Store in cache
    reverseGeocodeCache.set(cacheKey, { address, timestamp: Date.now() });
    cleanCache(reverseGeocodeCache);

    return address;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return cached result if available, even if expired
    return cached?.address || 'Unknown location';
  }
};

/**
 * Get route between two locations
 * NOW WITH CACHING to reduce external API calls
 */
export const getRoute = async (
  from: Location,
  to: Location,
  options?: { signal?: AbortSignal }
): Promise<RouteData | null> => {
  const cacheKey = `${from.lat.toFixed(6)},${from.lng.toFixed(6)}-${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;

  // Check cache first
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.route;
  }

  try {
    const response = await axiosInstance.get('/map/route', {
      params: {
        fromLat: from.lat,
        fromLng: from.lng,
        toLat: to.lat,
        toLng: to.lng,
      },
      signal: options?.signal,
    });

    const route = response.data?.data || null;

    // Store in cache
    if (route) {
      routeCache.set(cacheKey, { route, timestamp: Date.now() });
      cleanCache(routeCache);
    }

    return route;
  } catch (error) {
    console.error('Routing error:', error);
    // Return cached result if available, even if expired
    return cached?.route || null;
  }
};

/**
 * Calculate distance between two points (Haversine formula)
 */
export const calculateDistance = (from: Location, to: Location): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimals
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Format duration for display
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Get current location from browser
 */
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
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

/**
 * Check if location is valid
 */
export const isValidLocation = (location: Location): boolean => {
  return (
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
};

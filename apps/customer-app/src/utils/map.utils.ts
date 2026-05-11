import { Location, RouteData } from '../types';
import axiosInstance from '../api/axios.config';

// Simple in-memory cache for geocoding results
// This reduces external API calls and improves performance
const geocodeCache = new Map<string, { results: Location[]; timestamp: number }>();
const reverseGeocodeCache = new Map<string, { address: string; timestamp: number }>();
const routeCache = new Map<string, { route: RouteData; timestamp: number }>();

const LAST_LOCATION_STORAGE_KEY = 'customer:lastKnownLocation';
const GEO_HIGH_ACCURACY_TIMEOUT_MS = Number(process.env.REACT_APP_GEO_HIGH_ACCURACY_TIMEOUT_MS || 8000);
const GEO_LOW_ACCURACY_TIMEOUT_MS = Number(process.env.REACT_APP_GEO_LOW_ACCURACY_TIMEOUT_MS || 15000);
let hasLoggedGeoTimeout = false;

export const sanitizeDisplayAddress = (value: string): string => {
  if (!value) {
    return value;
  }

  const normalizeText = (input: string) =>
    input
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\b(thành phố|thanh pho|tp\.?|tỉnh|tinh)\s*ho\s*chi\s*minh\b/gi, 'TP. HCM'));

  const hasHcm = parts.some((part) => {
    const key = normalizeText(part);
    return key.includes('ho chi minh') || key.includes('tp hcm');
  });

  const normalizedParts = parts
    .map((part) => part.replace(/\b(thành phố|thanh pho|tp\.?)\s*thu\s*duc\b/gi, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);

  const filteredParts = normalizedParts.filter((part) => {
    const key = normalizeText(part);
    if (!key) {
      return false;
    }

    if ((hasHcm && key === 'thu duc') || key === 'thanh pho thu duc') {
      return false;
    }

    return true;
  });

  const deduped: string[] = [];
  for (const part of filteredParts) {
    const key = normalizeText(part);
    if (!deduped.some((existing) => normalizeText(existing) === key)) {
      deduped.push(part);
    }
  }

  return deduped
    .join(', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

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
  options?: { signal?: AbortSignal; contextLabel?: string; lat?: number; lng?: number }
): Promise<Location[]> => {
  const latlngKey =
    options?.lat !== undefined && options?.lng !== undefined
      ? `${options.lat.toFixed(3)},${options.lng.toFixed(3)}`
      : '';
  const cacheKey = `${address.toLowerCase().trim()}::${options?.contextLabel?.toLowerCase().trim() || ''}::${latlngKey}`;

  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }

  try {
    const response = await axiosInstance.get('/map/geocode', {
      params: {
        q: address,
        limit: 7,
        ...(options?.contextLabel ? { context: options.contextLabel } : {}),
        ...(options?.lat !== undefined && options?.lng !== undefined
          ? { lat: options.lat, lng: options.lng }
          : {}),
      },
      signal: options?.signal,
    });

    const results = (response.data?.data?.results || []).map((item: Location) => ({
      ...item,
      address: sanitizeDisplayAddress(item.address || ''),
    }));

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
 * Reverse geocode coordinates to address with enhanced accuracy for Vietnam
 * Attempts to extract proper ward/district/city names
 * NOW WITH CACHING to reduce external API calls
 */
export const reverseGeocode = async (lat: number, lng: number, snapToRoad = false): Promise<string> => {
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  // Check cache first
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return sanitizeDisplayAddress(cached.address);
  }

  try {
    const response = await axiosInstance.get('/location/resolve-location', {
      params: { lat, lng, snapToRoad },
    });

    const address = sanitizeDisplayAddress(response.data?.data?.display_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    // Store in cache
    reverseGeocodeCache.set(cacheKey, { address, timestamp: Date.now() });
    cleanCache(reverseGeocodeCache);

    return address;
  } catch (error) {
    console.warn('Resolve-location failed, fallback to legacy reverse endpoint');
    try {
      const fallbackResponse = await axiosInstance.get('/map/reverse', {
        params: { lat, lng },
      });
      const fallbackAddress = sanitizeDisplayAddress(
        fallbackResponse.data?.data?.address || fallbackResponse.data?.data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      );
      reverseGeocodeCache.set(cacheKey, { address: fallbackAddress, timestamp: Date.now() });
      cleanCache(reverseGeocodeCache);
      return fallbackAddress;
    } catch (fallbackError) {
      console.error('Reverse geocoding fallback error:', fallbackError);
    }
    // Return cached result if available, even if expired
    return sanitizeDisplayAddress(cached?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
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
    return `${minutes} phút`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${remainingMinutes} phút`;
};

/**
 * Parse Vietnamese address to extract ward, district, city
 * OSM/Nominatim often returns incomplete or incorrect ward names
 */
export const parseVietnameseAddress = (address: string): {
  ward?: string;
  district?: string;
  city?: string;
  fullAddress: string;
} => {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  
  // Common Vietnamese administrative district/city indicators
  const wardPatterns = /phường|xã|thị trấn|thị xã/i;
  const districtPatterns = /quận|huyện|thành phố|tp\.|tp/i;
  const cityPatterns = /thành phố|tp\.|tp|tỉnh/i;

  let ward: string | undefined;
  let district: string | undefined;
  let city: string | undefined;

  for (const part of parts) {
    if (wardPatterns.test(part) && !ward) {
      ward = part;
    } else if (districtPatterns.test(part) && !district) {
      district = part;
    } else if (cityPatterns.test(part) && !city) {
      city = part;
    }
  }

  return {
    ward,
    district,
    city,
    fullAddress: address,
  };
};

/**
 * Get current location from browser with multi-strategy fallback
 * Tries high-accuracy geolocation with timeout, then falls back to lower accuracy
 */
export const getCurrentLocation = (options?: { preferFresh?: boolean }): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    const resolvePosition = (position: GeolocationPosition) => {
      // Validate location is within Vietnam bounds (roughly)
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      
      // Vietnam bounds: roughly 8-24N, 102-109E
      const isWithinVietnamBounds = lat >= 8 && lat <= 24.5 && lng >= 101 && lng <= 110;

      if (!isWithinVietnamBounds) {
        console.warn(
          `Location outside Vietnam bounds: ${lat.toFixed(4)}, ${lng.toFixed(4)} (accuracy: ${accuracy}m)`
        );
      }

      try {
        window.localStorage.setItem(
          LAST_LOCATION_STORAGE_KEY,
          JSON.stringify({ lat, lng, timestamp: Date.now() })
        );
      } catch {
        // Ignore localStorage write failures.
      }

      resolve({
        lat,
        lng,
      });
    };

    const resolveFromLastKnownLocation = () => {
      try {
        const raw = window.localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
        if (!raw) {
          return false;
        }

        const parsed = JSON.parse(raw) as { lat?: number; lng?: number; timestamp?: number };
        if (typeof parsed?.lat !== 'number' || typeof parsed?.lng !== 'number') {
          return false;
        }

        // Accept cached location within 15 minutes.
        if (parsed.timestamp && Date.now() - parsed.timestamp > 15 * 60 * 1000) {
          return false;
        }

        resolve({ lat: parsed.lat, lng: parsed.lng });
        return true;
      } catch {
        return false;
      }
    };

    const handleError = (error: GeolocationPositionError, isHighAccuracy: boolean) => {
      // Keep console output concise in development and avoid duplicate timeout spam.
      if (error.code === error.TIMEOUT) {
        if (!hasLoggedGeoTimeout) {
          hasLoggedGeoTimeout = true;
          console.warn('Geolocation timeout. Falling back to cached/manual location.');
        }
      } else {
        console.warn(
          `Geolocation error (highAccuracy=${isHighAccuracy}, code=${error.code}): ${error.message}`
        );
      }

      if (resolveFromLastKnownLocation()) {
        return;
      }

      // If high accuracy failed, try lower accuracy
      if (isHighAccuracy && (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE)) {
        console.log('High accuracy geolocation unavailable, trying lower accuracy...');
        const useFreshLocation = Boolean(options?.preferFresh);
        navigator.geolocation.getCurrentPosition(
          resolvePosition,
          (fallbackError) => {
            if (resolveFromLastKnownLocation()) {
              return;
            }
            console.warn('Low accuracy geolocation also failed:', fallbackError.message);
            reject(fallbackError);
          },
          {
            enableHighAccuracy: false,
            timeout: GEO_LOW_ACCURACY_TIMEOUT_MS,
            maximumAge: useFreshLocation ? 0 : 300000, // Allow older location only when not explicitly refreshing
          }
        );
        return;
      }

      reject(error);
    };

    const runGeolocation = () => {
      const useFreshLocation = Boolean(options?.preferFresh);
      navigator.geolocation.getCurrentPosition(
        resolvePosition,
        (error) => handleError(error, true),
        {
          enableHighAccuracy: true,
          timeout: GEO_HIGH_ACCURACY_TIMEOUT_MS,
          maximumAge: useFreshLocation ? 0 : 120000,
        }
      );
    };

    // Permission pre-check avoids long timeout loop when access is denied.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          if (result.state === 'denied') {
            // Do NOT fall back to cached location when GPS is explicitly denied by the user.
            // The cache fallback is only appropriate for transient errors (timeout / unavailable).
            reject({ code: 1, message: 'Bạn đã từ chối quyền truy cập vị trí' } as GeolocationPositionError);
            return;
          }
          runGeolocation();
        })
        .catch(() => runGeolocation());
      return;
    }

    runGeolocation();
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

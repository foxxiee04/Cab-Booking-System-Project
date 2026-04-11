import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { locationRepository } from './location.repository';
import { formatAddressFromOSM, isHcmContextFromAddress, normalizeAddressText, normalizeProvinceName, normalizeStreetName, normalizeText, normalizeWardName } from './address-normalizer';
import { OSMReverseResponse, ResolveLocationInput, ResolvedLocation } from './types';

const NOMINATIM_HEADERS = {
  'User-Agent': process.env.NOMINATIM_USER_AGENT || 'CabBookingSystem/2.0 (location-service)',
  Referer: process.env.NOMINATIM_REFERER || 'http://localhost:3000',
  Accept: 'application/json',
};

const NOMINATIM_PARAMS = {
  format: 'jsonv2',
  addressdetails: 1,
  'accept-language': config.map.nominatimLanguage,
  countrycodes: config.map.nominatimCountry,
};

const NOMINATIM_FALLBACK_URL = process.env.NOMINATIM_FALLBACK_URL || '';
const LOCATION_TIMEOUT_MS = Number(process.env.LOCATION_TIMEOUT_MS || 1500);
const NOMINATIM_LIMIT_PER_MIN = Number(process.env.NOMINATIM_LIMIT_PER_MIN || 1200);

function buildDisplayAddress(street: string, ward: string, province: string): string {
  return [street, ward, province].filter(Boolean).join(', ');
}

async function snapToNearestRoad(lat: number, lng: number): Promise<{ lat: number; lng: number }> {
  try {
    const response = await axios.get(`${config.map.osrmUrl}/nearest/v1/driving/${lng},${lat}`, {
      timeout: LOCATION_TIMEOUT_MS,
      params: {
        number: 1,
      },
    });

    const waypoint = response.data?.waypoints?.[0];
    const location = waypoint?.location as [number, number] | undefined;
    if (!location || location.length !== 2) {
      return { lat, lng };
    }

    return { lat: location[1], lng: location[0] };
  } catch (error) {
    logger.warn('Snap to road failed, fallback to raw coordinates', { error: (error as Error).message });
    return { lat, lng };
  }
}

async function reverseFromNominatim(baseUrl: string, lat: number, lng: number): Promise<OSMReverseResponse> {
  const response = await axios.get<OSMReverseResponse>(`${baseUrl}/reverse`, {
    timeout: LOCATION_TIMEOUT_MS,
    headers: NOMINATIM_HEADERS,
    params: {
      lat,
      lon: lng,
      ...NOMINATIM_PARAMS,
      ...(config.map.nominatimEmail ? { email: config.map.nominatimEmail } : {}),
    },
  });

  return response.data;
}

async function toResolvedLocation(
  lat: number,
  lng: number,
  nominatimData: OSMReverseResponse,
): Promise<ResolvedLocation> {
  const address = nominatimData.address || {};

  const wardRaw = address.suburb || address.quarter || address.village || address.neighbourhood || '';
  const wardSourceType: 'suburb' | 'quarter' | 'village' | 'neighbourhood' | 'unknown' =
    address.suburb
      ? 'suburb'
      : address.quarter
        ? 'quarter'
        : address.village
          ? 'village'
          : address.neighbourhood
            ? 'neighbourhood'
            : 'unknown';

  const cityRaw = address.city || address.town || address.municipality || '';
  const stateRaw = address.state || '';
  const provinceRaw = cityRaw || stateRaw;

  const street = normalizeStreetName(address.road, address.house_number);
  const ward = normalizeWardName(wardRaw, wardSourceType);
  const province = isHcmContextFromAddress(address) ? 'TP. HCM' : normalizeProvinceName(provinceRaw);

  const canonicalAddress = formatAddressFromOSM(address, nominatimData.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  const canonicalParts = canonicalAddress.split(',').map((part) => part.trim()).filter(Boolean);
  const canonicalWard = canonicalParts.find((part) => {
    const key = normalizeText(part);
    return key.startsWith('phuong ') || key.startsWith('xa ');
  }) || ward;
  const provinceId = province ? await locationRepository.matchProvinceId(province) : null;
  const wardId = canonicalWard ? await locationRepository.matchWardId(canonicalWard, provinceId) : null;

  const displayAddress = canonicalAddress
    || buildDisplayAddress(street, ward, province)
    || nominatimData.display_name
    || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  return {
    lat,
    lng,
    street,
    ward: canonicalWard || ward,
    province,
    ward_id: wardId,
    province_id: provinceId,
    display_address: displayAddress,
    osm_place_id: String(nominatimData.place_id || ''),
    source: 'OSM',
  };
}

export class LocationService {
  private sanitizeResolvedLocation(location: ResolvedLocation): ResolvedLocation {
    return {
      ...location,
      display_address: normalizeAddressText(location.display_address || ''),
      street: normalizeAddressText(location.street || ''),
      ward: normalizeAddressText(location.ward || ''),
      province: normalizeAddressText(location.province || ''),
    };
  }

  public async resolveLocation(input: ResolveLocationInput): Promise<ResolvedLocation> {
    const shouldSnapToRoad = input.snapToRoad !== false;
    const cacheKey = locationRepository.buildGridKey(input.lat, input.lng, shouldSnapToRoad);
    const cached = await locationRepository.getCachedLocation(cacheKey);
    if (cached) {
      return this.sanitizeResolvedLocation(cached);
    }

    const snapped = shouldSnapToRoad
      ? await snapToNearestRoad(input.lat, input.lng)
      : { lat: input.lat, lng: input.lng };

    const canCallNominatim = await locationRepository.consumeNominatimQuota(NOMINATIM_LIMIT_PER_MIN);

    if (!canCallNominatim) {
      const stale = await locationRepository.getCachedLocation(cacheKey);
      if (stale) {
        return this.sanitizeResolvedLocation(stale);
      }
      throw new Error('NOMINATIM_RATE_LIMITED');
    }

    try {
      const primary = await reverseFromNominatim(config.map.nominatimUrl, snapped.lat, snapped.lng);
      const resolved = this.sanitizeResolvedLocation(await toResolvedLocation(snapped.lat, snapped.lng, primary));
      await locationRepository.setCachedLocation(cacheKey, resolved);
      return resolved;
    } catch (primaryError) {
      logger.warn('Primary nominatim reverse failed', { error: (primaryError as Error).message });

      if (!NOMINATIM_FALLBACK_URL) {
        throw primaryError;
      }

      const fallback = await reverseFromNominatim(NOMINATIM_FALLBACK_URL, snapped.lat, snapped.lng);
      const resolved = this.sanitizeResolvedLocation(await toResolvedLocation(snapped.lat, snapped.lng, fallback));
      await locationRepository.setCachedLocation(cacheKey, resolved);
      return resolved;
    }
  }
}

export const locationService = new LocationService();

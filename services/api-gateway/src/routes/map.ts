import { Router } from 'express';
import axios from 'axios';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// ── Redis client for POI caching ──
const redis = new Redis(config.redisUrl);
redis.on('error', (err) => logger.warn('POI Redis error', { error: err.message }));

const NOMINATIM_PARAMS = {
  format: 'jsonv2',
  addressdetails: 1,
  'accept-language': config.map.nominatimLanguage,
  countrycodes: config.map.nominatimCountry,
};

router.get('/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '7'), 10), 1), 10);

  if (!q) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'q is required' },
    });
  }

  try {
    const response = await axios.get(`${config.map.nominatimUrl}/search`, {
      timeout: config.map.timeoutMs,
      params: {
        q,
        limit,
        ...NOMINATIM_PARAMS,
        ...(config.map.nominatimEmail ? { email: config.map.nominatimEmail } : {}),
      },
    });

    const results = (response.data || []).map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
    }));

    return res.json({ success: true, data: { results } });
  } catch (error) {
    logger.warn('Map geocode failed', { error: (error as Error).message });
    return res.status(502).json({
      success: false,
      error: { code: 'MAP_PROVIDER_ERROR', message: 'Geocoding failed' },
    });
  }
});

router.get('/reverse', async (req, res) => {
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required' },
    });
  }

  try {
    const response = await axios.get(`${config.map.nominatimUrl}/reverse`, {
      timeout: config.map.timeoutMs,
      params: {
        lat,
        lon: lng,
        ...NOMINATIM_PARAMS,
        ...(config.map.nominatimEmail ? { email: config.map.nominatimEmail } : {}),
      },
    });

    const address = response.data?.display_name || 'Unknown location';
    return res.json({ success: true, data: { address } });
  } catch (error) {
    logger.warn('Map reverse failed', { error: (error as Error).message });
    return res.status(502).json({
      success: false,
      error: { code: 'MAP_PROVIDER_ERROR', message: 'Reverse geocoding failed' },
    });
  }
});

router.get('/route', async (req, res) => {
  const fromLat = parseFloat(String(req.query.fromLat));
  const fromLng = parseFloat(String(req.query.fromLng));
  const toLat = parseFloat(String(req.query.toLat));
  const toLng = parseFloat(String(req.query.toLng));

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    !Number.isFinite(toLat) ||
    !Number.isFinite(toLng)
  ) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'fromLat, fromLng, toLat, toLng are required' },
    });
  }

  try {
    const response = await axios.get(
      `${config.map.osrmUrl}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}`,
      {
        timeout: config.map.timeoutMs,
        params: { overview: 'full', geometries: 'geojson' },
      }
    );

    const route = response.data?.routes?.[0];
    if (!route) {
      return res.status(502).json({
        success: false,
        error: { code: 'MAP_PROVIDER_ERROR', message: 'Route not found' },
      });
    }

    return res.json({
      success: true,
      data: {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
      },
    });
  } catch (error) {
    logger.warn('Map route failed', { error: (error as Error).message });
    return res.status(502).json({
      success: false,
      error: { code: 'MAP_PROVIDER_ERROR', message: 'Route calculation failed' },
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POI Endpoint — Overpass API with Redis caching
// ═══════════════════════════════════════════════════════════════

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Map frontend type names → Overpass tags
const POI_TYPE_MAP: Record<string, string[]> = {
  restaurant:  ['amenity=restaurant'],
  cafe:        ['amenity=cafe'],
  hospital:    ['amenity=hospital', 'amenity=clinic'],
  gas_station: ['amenity=fuel'],
  hotel:       ['tourism=hotel', 'tourism=resort', 'tourism=guest_house'],
  tourist:     ['tourism=attraction', 'tourism=museum', 'tourism=viewpoint', 'historic=monument'],
  bus_station: ['amenity=bus_station', 'highway=bus_stop'],
  school:      ['amenity=school'],
  university:  ['amenity=university'],
  bank:        ['amenity=bank', 'amenity=atm'],
  pharmacy:    ['amenity=pharmacy'],
  supermarket: ['shop=supermarket', 'shop=convenience'],
  park:        ['leisure=park', 'leisure=garden'],
};

const ALL_POI_TYPES = Object.keys(POI_TYPE_MAP);

// Max results per type to avoid clutter
const MAX_PER_TYPE = 8;

// Cache TTL in seconds (15 minutes)
const POI_CACHE_TTL = 900;

/**
 * Build Overpass QL query for the given types around (lat, lng) within radius.
 * Only returns named POIs.
 */
function buildOverpassQuery(
  lat: number,
  lng: number,
  radiusMeters: number,
  types: string[]
): string {
  const tagFilters: string[] = [];

  for (const type of types) {
    const tags = POI_TYPE_MAP[type];
    if (!tags) continue;
    for (const tag of tags) {
      const [key, value] = tag.split('=');
      tagFilters.push(
        `  node["${key}"="${value}"]["name"](around:${radiusMeters},${lat},${lng});`
      );
      tagFilters.push(
        `  way["${key}"="${value}"]["name"](around:${radiusMeters},${lat},${lng});`
      );
    }
  }

  return `
[out:json][timeout:15];
(
${tagFilters.join('\n')}
);
out center tags ${MAX_PER_TYPE * types.length};
`.trim();
}

/**
 * Generate a stable cache key.
 * We round lat/lng to ~100 m grid to increase cache hits when the user pans slightly.
 */
function poiCacheKey(lat: number, lng: number, radius: number, types: string[]): string {
  const rlat = (Math.round(lat * 1000) / 1000).toFixed(3);
  const rlng = (Math.round(lng * 1000) / 1000).toFixed(3);
  const rrad = Math.round(radius / 100) * 100;            // round to nearest 100 m
  const tkey = types.slice().sort().join(',');
  return `poi:${rlat}:${rlng}:${rrad}:${tkey}`;
}

interface POIResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  address?: string;
}

/**
 * Map Overpass element → our POI shape, tagging each with the matched type.
 */
function mapOverpassElement(el: any, requestedTypes: string[]): POIResult | null {
  const name = el.tags?.name;
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  // Determine which requested type this element matches
  let matchedType = 'other';
  for (const type of requestedTypes) {
    const tags = POI_TYPE_MAP[type];
    if (!tags) continue;
    for (const tag of tags) {
      const [key, value] = tag.split('=');
      if (el.tags?.[key] === value) {
        matchedType = type;
        break;
      }
    }
    if (matchedType !== 'other') break;
  }

  // Build optional address string
  const parts: string[] = [];
  if (el.tags?.['addr:street']) parts.push(el.tags['addr:street']);
  if (el.tags?.['addr:housenumber']) parts.unshift(el.tags['addr:housenumber']);
  if (el.tags?.['addr:city']) parts.push(el.tags['addr:city']);
  const address = parts.length > 0 ? parts.join(', ') : undefined;

  return {
    id: `${el.type}-${el.id}`,
    name,
    lat,
    lng,
    type: matchedType,
    address,
  };
}

/**
 * GET /api/map/pois
 *
 * Query params:
 *   lat      – latitude  (required)
 *   lng      – longitude (required)
 *   radius   – metres, default 2000, max 5000
 *   types    – comma-separated list, default all
 *
 * Response: { success, data: { pois: POIResult[] } }
 */
router.get('/pois', async (req, res) => {
  const lat = parseFloat(String(req.query.lat));
  const lng = parseFloat(String(req.query.lng));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required' },
    });
  }

  let radius = Math.min(
    Math.max(parseInt(String(req.query.radius || '2000'), 10), 200),
    5000
  );

  const rawTypes = String(req.query.types || '').trim();
  const types: string[] = rawTypes
    ? rawTypes.split(',').filter((t) => POI_TYPE_MAP[t])
    : ALL_POI_TYPES;

  if (types.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No valid POI types provided' },
    });
  }

  const cacheKey = poiCacheKey(lat, lng, radius, types);

  // ── Check cache first ──
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('POI cache HIT', { cacheKey });
      return res.json({ success: true, data: { pois: JSON.parse(cached) } });
    }
  } catch (err) {
    logger.warn('POI cache read error', { error: (err as Error).message });
  }

  // ── Query Overpass ──
  try {
    const query = buildOverpassQuery(lat, lng, radius, types);
    logger.debug('Overpass query', { lat, lng, radius, types: types.join(',') });

    const response = await axios.post(
      OVERPASS_URL,
      `data=${encodeURIComponent(query)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
      }
    );

    const elements: any[] = response.data?.elements || [];

    // Map → POI results, group by type and limit per type
    const perType: Record<string, POIResult[]> = {};
    for (const el of elements) {
      const poi = mapOverpassElement(el, types);
      if (!poi) continue;
      if (!perType[poi.type]) perType[poi.type] = [];
      if (perType[poi.type].length < MAX_PER_TYPE) {
        perType[poi.type].push(poi);
      }
    }

    const pois: POIResult[] = Object.values(perType).flat();

    // ── Store in cache ──
    try {
      await redis.setex(cacheKey, POI_CACHE_TTL, JSON.stringify(pois));
      logger.debug('POI cache SET', { cacheKey, count: pois.length });
    } catch (err) {
      logger.warn('POI cache write error', { error: (err as Error).message });
    }

    return res.json({ success: true, data: { pois } });
  } catch (error: any) {
    // Overpass may be rate-limited or down
    const status = error.response?.status;
    if (status === 429) {
      logger.warn('Overpass rate-limited');
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT', message: 'Map POI service is busy, try again later' },
      });
    }
    logger.error('Overpass query failed', {
      error: error.message,
      status,
    });
    return res.status(502).json({
      success: false,
      error: { code: 'MAP_PROVIDER_ERROR', message: 'Failed to fetch POIs' },
    });
  }
});

export default router;

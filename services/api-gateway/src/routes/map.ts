import { Router } from 'express';
import axios from 'axios';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.on('error', (err) => logger.warn('POI Redis error', { error: err.message }));
  }

  return redis;
}

export async function closeMapRedis(): Promise<void> {
  if (!redis) {
    return;
  }

  const client = redis;
  redis = null;
  await client.quit();
}

const NOMINATIM_PARAMS = {
  format: 'jsonv2',
  addressdetails: 1,
  'accept-language': config.map.nominatimLanguage,
  countrycodes: config.map.nominatimCountry,
};

const NOMINATIM_HEADERS = {
  'User-Agent': 'CabBookingSystem/1.0 (local-development)',
  Referer: 'http://localhost:3000',
  Accept: 'application/json',
};

interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  name?: string;
  category?: string;
  type?: string;
}

const HCMC_VIEWBOX = {
  left: 106.35,
  top: 11.25,
  right: 107.05,
  bottom: 10.35,
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function isHcmContext(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.includes('ho chi minh') || normalized.includes('tp hcm') || normalized.includes('hcm');
}

/**
 * Build a clean Vietnamese address from Nominatim's structured address object.
 * Format: [POI name | road], ward, [district – skipped under HCMC], city/province
 * Under HCMC the sub-city "Thành phố Thủ Đức" is intentionally omitted so the result
 * reads naturally: "Cửu Long, Phường Tân Sơn Hòa, TP. HCM".
 */
function formatVietnameseAddress(
  addressObj: Record<string, string>,
  fallback: string,
  poiName?: string,
): string {
  if (!addressObj) return fallback;

  // Fine-grained road part
  const road = addressObj.road || addressObj.pedestrian || addressObj.footway || '';
  const houseNumber = addressObj.house_number || '';
  const roadPart = road ? (houseNumber ? `${houseNumber} ${road}` : road) : '';

  // Ward-level: suburb → quarter → neighbourhood
  // Guard: Nominatim sometimes puts "Thành phố Thủ Đức" in suburb for Thu Duc locations.
  // Filter those out — they are absorbed into "TP. HCM" at the city level.
  const rawWard =
    addressObj.suburb ||
    addressObj.quarter ||
    addressObj.neighbourhood ||
    addressObj.village ||
    '';
  const ward = normalizeText(rawWard).includes('thu duc') ? '' : rawWard;

  // Determine city / province
  const cityField = addressObj.city || addressObj.town || addressObj.municipality || '';
  const stateField = addressObj.state || addressObj.province || '';
  // Nominatim can return HCMC at different admin levels depending on location.
  // Sub-cities like "Thành phố Thủ Đức" live under county "Thành phố Hồ Chí Minh".
  const countyField = addressObj.county || addressObj.county_code || '';
  const stateDistrictField = addressObj.state_district || '';
  const isHcmCity    = normalizeText(cityField).includes('ho chi minh');
  const isHcmState   = normalizeText(stateField).includes('ho chi minh');
  const isHcmCounty  = normalizeText(countyField).includes('ho chi minh');
  const isHcmStateDist = normalizeText(stateDistrictField).includes('ho chi minh');
  // "Thành phố Thủ Đức" is a sub-city of HCMC — treat it as HCMC context
  // Check all relevant fields: city, town, municipality AND state_district
  const isThuDucSubCity = normalizeText(cityField).includes('thu duc');
  const isThuDucStateDist = normalizeText(stateDistrictField).includes('thu duc');

  let city = '';
  let district = '';

  if (isHcmCity || isHcmState || isHcmCounty || isHcmStateDist || isThuDucSubCity || isThuDucStateDist) {
    // Always collapse everything to "TP. HCM" — skip sub-city (Thủ Đức) and district
    city = 'TP. HCM';
  } else {
    // Outside HCMC: include district level
    let rawDistrict = addressObj.city_district || addressObj.district || addressObj.county || '';
    // Guard: filter out misplaced "Thành phố Thủ Đức" in district field — it belongs to HCMC
    if (rawDistrict && normalizeText(rawDistrict).includes('thu duc')) {
      rawDistrict = '';
    }
    if (rawDistrict) {
      district = rawDistrict
        .replace(/^Thành phố\s+/i, 'TP. ')  // "Thành phố ..." → "TP. ..."
        .replace(/^Quận\s+/i, 'Q.')          // "Quận 1" → "Q.1"
        .replace(/^Huyện\s+/i, 'H.')         // "Huyện Bình Chánh" → "H.Bình Chánh"
        .trim();
    }
    if (cityField) {
      city = cityField.replace(/^Thành phố\s+/i, 'TP. ').replace(/^Tỉnh\s+/i, '').trim();
    } else if (stateField) {
      city = stateField.replace(/^Thành phố\s+/i, 'TP. ').replace(/^Tỉnh\s+/i, '').trim();
    }
  }

  // Prefer POI name as the leading part; fall back to road
  const firstPart = poiName && poiName !== road ? poiName : roadPart;

  const parts = [firstPart, ward, district, city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : fallback;
}

/**
 * Haversine distance in km between two coordinate pairs.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreGeocodeResult(
  result: GeocodeResult,
  query: string,
  context?: string,
  userLat?: number,
  userLng?: number,
): number {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(result.name || result.address);
  const normalizedAddress = normalizeText(result.address);
  const normalizedContext = normalizeText(context || '');
  const queryMentionsThuDuc = normalizedQuery.includes('thu duc');
  const addressMentionsThuDuc = normalizedAddress.includes('thu duc');
  let score = 0;

  // Name match quality (higher = more relevant)
  if (normalizedName.startsWith(normalizedQuery)) {
    score += 6;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 4;
  } else if (normalizedAddress.includes(normalizedQuery)) {
    score += 2;
  }

  // Boost named POIs and transit
  if (result.category === 'amenity' || result.category === 'railway' || result.category === 'aeroway' || result.category === 'tourism') {
    score += 2;
  }
  if (result.type === 'bus_station' || result.type === 'station' || result.type === 'stop' || result.type === 'terminal') {
    score += 2;
  }
  // Penalise bare road segments — they're not useful as destinations
  if (result.category === 'highway' && !result.name) {
    score -= 4;
  }

  if (!queryMentionsThuDuc && addressMentionsThuDuc) {
    score -= 2;
  }

  if (normalizedContext) {
    if (normalizedAddress.includes(normalizedContext)) {
      score += 2;
    } else {
      score -= 1;
    }
  }

  // Proximity bonus: results within 2 km of user get +3, up to 10 km get scaled bonus
  if (userLat !== undefined && userLng !== undefined) {
    const distKm = haversineKm(userLat, userLng, result.lat, result.lng);
    if (distKm <= 2) {
      score += 3;
    } else if (distKm <= 10) {
      score += Math.round(2 * (1 - (distKm - 2) / 8));
    }
  }

  return score;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
}

async function searchNominatim(
  query: string,
  limit: number,
  options?: { context?: string; userLat?: number; userLng?: number }
): Promise<GeocodeResult[]> {
  const context = options?.context || '';
  const shouldBoundToHcm = isHcmContext(context) || isHcmContext(query);

  // When user coordinates are available, build a small viewbox centred on those coords
  // (±0.15 deg ≈ ±17 km) so Nominatim naturally surfaces nearby results first.
  let proximityViewbox: string | undefined;
  let proximityBounded = 0;
  if (options?.userLat !== undefined && options?.userLng !== undefined && !shouldBoundToHcm) {
    const d = 0.15;
    proximityViewbox = `${options.userLng - d},${options.userLat + d},${options.userLng + d},${options.userLat - d}`;
    proximityBounded = 0; // soft-bound: prefer, not restrict
  }

  const response = await axios.get(`${config.map.nominatimUrl}/search`, {
    timeout: config.map.timeoutMs,
    headers: NOMINATIM_HEADERS,
    params: {
      q: query,
      limit: limit + 3, // fetch a few extra for better re-ranking
      dedupe: 1,
      ...NOMINATIM_PARAMS,
      ...(shouldBoundToHcm
        ? {
            viewbox: `${HCMC_VIEWBOX.left},${HCMC_VIEWBOX.top},${HCMC_VIEWBOX.right},${HCMC_VIEWBOX.bottom}`,
            bounded: 1,
          }
        : proximityViewbox
          ? { viewbox: proximityViewbox, bounded: proximityBounded }
          : {}),
      ...(config.map.nominatimEmail ? { email: config.map.nominatimEmail } : {}),
    },
  });

  return (response.data || []).map((item: NominatimItem) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    address: item.address
      ? formatVietnameseAddress(item.address, item.display_name, item.name)
      : (item.name ? `${item.name}, ${item.display_name}` : item.display_name),
    name: item.name,
    category: item.category,
    type: item.type,
  }));
}

function mergeGeocodeResults(primary: GeocodeResult[], secondary: GeocodeResult[], limit: number): GeocodeResult[] {
  const merged = [...primary, ...secondary];
  const seen = new Set<string>();

  return merged.filter((result) => {
    const key = `${result.lat.toFixed(4)}:${result.lng.toFixed(4)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, limit);
}

router.get('/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const context = String(req.query.context || '').trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '7'), 10), 1), 10);
  const userLat = req.query.lat ? parseFloat(String(req.query.lat)) : undefined;
  const userLng = req.query.lng ? parseFloat(String(req.query.lng)) : undefined;
  const hasUserCoords = userLat !== undefined && Number.isFinite(userLat) && userLng !== undefined && Number.isFinite(userLng);

  if (!q) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'q is required' },
    });
  }

  try {
    const searchOpts = { context, ...(hasUserCoords ? { userLat, userLng } : {}) };
    const primaryResults = await searchNominatim(q, limit, searchOpts);
    let results = primaryResults;

    if (context && !q.includes(',') && primaryResults.length <= 1) {
      const contextualResults = await searchNominatim(`${q}, ${context}`, limit, searchOpts);
      if (contextualResults.length > primaryResults.length) {
        results = mergeGeocodeResults(contextualResults, primaryResults, limit);
      } else {
        results = mergeGeocodeResults(primaryResults, contextualResults, limit);
      }
    }

    results = [...results]
      .sort((left, right) =>
        scoreGeocodeResult(right, q, context, hasUserCoords ? userLat : undefined, hasUserCoords ? userLng : undefined) -
        scoreGeocodeResult(left, q, context, hasUserCoords ? userLat : undefined, hasUserCoords ? userLng : undefined)
      )
      .slice(0, limit)
      .map(({ lat, lng, address }) => ({ lat, lng, address }));

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
      headers: NOMINATIM_HEADERS,
      params: {
        lat,
        lon: lng,
        ...NOMINATIM_PARAMS,
        ...(config.map.nominatimEmail ? { email: config.map.nominatimEmail } : {}),
      },
    });

    const data = response.data;
    const address = data?.address
      ? formatVietnameseAddress(data.address, data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      : data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
  const redisClient = getRedisClient();

  // ── Check cache first ──
  try {
    const cached = await redisClient.get(cacheKey);
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
      await redisClient.setex(cacheKey, POI_CACHE_TTL, JSON.stringify(pois));
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

import { Request, Response, Router } from 'express';
import { logger } from '../utils/logger';
import { locationService } from './location.service';
import { locationRepository } from './location.repository';

const router = Router();

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return fallback;
}

function parseLatLng(source: any): { lat: number; lng: number } | null {
  const lat = Number(source?.lat);
  const lng = Number(source?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

async function handleResolveLocation(req: Request, res: Response) {
  const input = parseLatLng(req.method === 'GET' ? req.query : req.body);
  const snapToRoad = parseBoolean(req.method === 'GET' ? req.query.snapToRoad : req.body?.snapToRoad, true);

  if (!input) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'lat and lng are required and must be valid numbers',
      },
    });
  }

  const start = Date.now();

  try {
    const resolved = await locationService.resolveLocation({
      lat: input.lat,
      lng: input.lng,
      snapToRoad,
    });

    return res.json({
      success: true,
      data: resolved,
      meta: {
        latency_ms: Date.now() - start,
      },
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'NOMINATIM_RATE_LIMITED') {
      return res.status(429).json({
        success: false,
        error: {
          code: 'NOMINATIM_RATE_LIMITED',
          message: 'Location provider quota reached. Retry shortly.',
        },
      });
    }

    logger.warn('resolve-location failed', {
      error: message,
      lat: input.lat,
      lng: input.lng,
    });

    return res.status(502).json({
      success: false,
      error: {
        code: 'MAP_PROVIDER_ERROR',
        message: 'Failed to resolve location from OSM providers',
      },
    });
  }
}

router.get('/resolve-location', handleResolveLocation);
router.post('/resolve-location', handleResolveLocation);

export async function closeLocationRedis(): Promise<void> {
  await locationRepository.close();
}

export default router;

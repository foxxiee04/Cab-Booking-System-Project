import { Router } from 'express';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

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

export default router;

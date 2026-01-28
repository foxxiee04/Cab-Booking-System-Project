import { Router } from 'express';
import { PricingService } from '../services/pricing.service';
import { logger } from '../utils/logger';

export function createPricingRouter(pricingService: PricingService): Router {
  const router = Router();

  // Estimate fare
  router.post('/estimate', async (req, res) => {
    try {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.body;

      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_COORDINATES', message: 'Missing coordinates' },
        });
      }

      const estimate = await pricingService.estimateFare({
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        vehicleType: vehicleType || 'ECONOMY',
      });

      res.json({ success: true, data: estimate });
    } catch (error: any) {
      logger.error('Estimate fare error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'ESTIMATE_FAILED', message: error.message },
      });
    }
  });

  // Get current surge
  router.get('/surge', async (req, res) => {
    try {
      const multiplier = await pricingService.getCurrentSurgeMultiplier();
      res.json({ success: true, data: { multiplier } });
    } catch (error: any) {
      logger.error('Get surge error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SURGE_FETCH_FAILED', message: error.message },
      });
    }
  });

  // Set surge (admin only - should be protected)
  router.post('/surge', async (req, res) => {
    try {
      const { multiplier } = req.body;
      await pricingService.setSurgeMultiplier(multiplier);
      res.json({ success: true, data: { multiplier } });
    } catch (error: any) {
      logger.error('Set surge error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'SURGE_UPDATE_FAILED', message: error.message },
      });
    }
  });

  // Calculate dynamic surge
  router.post('/surge/calculate', async (req, res) => {
    try {
      const { activeRides, availableDrivers, timeOfDay, dayOfWeek } = req.body;
      
      const result = await pricingService.calculateDynamicSurge({
        activeRides: activeRides || 0,
        availableDrivers: availableDrivers || 10,
        timeOfDay: timeOfDay ?? new Date().getHours(),
        dayOfWeek: dayOfWeek ?? new Date().getDay(),
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Calculate surge error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'SURGE_CALC_FAILED', message: error.message },
      });
    }
  });

  return router;
}

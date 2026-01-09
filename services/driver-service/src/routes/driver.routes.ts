import { Router, Request, Response } from 'express';
import { DriverService } from '../services/driver.service';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const createDriverRouter = (driverService: DriverService): Router => {
  const router = Router();

  // Register as driver
  router.post('/register', async (req: AuthRequest, res: Response) => {
    try {
      const { vehicle, license } = req.body;

      if (!vehicle || !license) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Vehicle and license info required' },
        });
      }

      const driver = await driverService.registerDriver({
        userId: req.user!.userId,
        vehicle,
        license: {
          ...license,
          expiryDate: new Date(license.expiryDate),
        },
      });

      res.status(201).json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Register driver error:', err);
      const message = err instanceof Error ? err.message : 'Registration failed';
      res.status(400).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message },
      });
    }
  });

  // Get current driver profile
  router.get('/me', async (req: AuthRequest, res: Response) => {
    try {
      const driver = await driverService.getDriverByUserId(req.user!.userId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver profile not found' },
        });
      }

      res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Get driver error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get driver' },
      });
    }
  });

  // Go online
  router.post('/me/online', async (req: AuthRequest, res: Response) => {
    try {
      const driver = await driverService.goOnline(req.user!.userId);
      res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Go online error:', err);
      const message = err instanceof Error ? err.message : 'Failed to go online';
      res.status(400).json({
        success: false,
        error: { code: 'GO_ONLINE_FAILED', message },
      });
    }
  });

  // Go offline
  router.post('/me/offline', async (req: AuthRequest, res: Response) => {
    try {
      const driver = await driverService.goOffline(req.user!.userId);
      res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Go offline error:', err);
      const message = err instanceof Error ? err.message : 'Failed to go offline';
      res.status(400).json({
        success: false,
        error: { code: 'GO_OFFLINE_FAILED', message },
      });
    }
  });

  // Update location
  router.post('/me/location', async (req: AuthRequest, res: Response) => {
    try {
      const { lat, lng } = req.body;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid lat and lng required' },
        });
      }

      await driverService.updateLocation(req.user!.userId, { lat, lng });
      res.json({ success: true, data: { message: 'Location updated' } });
    } catch (err) {
      logger.error('Update location error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update location';
      res.status(400).json({
        success: false,
        error: { code: 'LOCATION_UPDATE_FAILED', message },
      });
    }
  });

  // Get driver's assigned ride
  router.get('/me/rides/assigned', async (req: AuthRequest, res: Response) => {
    try {
      const driver = await driverService.getDriverByUserId(req.user!.userId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'DRIVER_NOT_FOUND', message: 'Driver profile not found' },
        });
      }

      // For now, return null - ride-service should be queried for assigned rides
      // This is a placeholder that returns the driver's current ride if stored
      res.json({ success: true, data: { ride: null } });
    } catch (err) {
      logger.error('Get assigned ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get assigned ride' },
      });
    }
  });

  // Find nearby drivers (internal/admin)
  router.get('/nearby', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 5;

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Valid lat and lng required' },
        });
      }

      const drivers = await driverService.findNearbyDrivers({ lat, lng }, radius);
      res.json({ success: true, data: { drivers } });
    } catch (err) {
      logger.error('Find nearby drivers error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to find drivers' },
      });
    }
  });

  // Admin: Get all drivers
  router.get('/', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const { drivers, total } = await driverService.getDrivers(page, limit, status as any);
      res.json({ success: true, data: { drivers }, meta: { page, limit, total } });
    } catch (err) {
      logger.error('Get drivers error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get drivers' },
      });
    }
  });

  // Admin: Verify driver
  router.patch('/:driverId/verify', async (req: Request, res: Response) => {
    try {
      const { verified } = req.body;
      const driver = await driverService.updateDriverVerification(
        req.params.driverId,
        verified === true
      );

      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Driver not found' },
        });
      }

      res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Verify driver error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to verify driver' },
      });
    }
  });

  return router;
};

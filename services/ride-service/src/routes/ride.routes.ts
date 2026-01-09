import { Router, Request, Response } from 'express';
import { RideService } from '../services/ride.service';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const createRideRouter = (rideService: RideService): Router => {
  const router = Router();

  // Create ride (Customer)
  router.post('/', async (req: AuthRequest, res: Response) => {
    try {
      const { pickup, dropoff } = req.body;
      
      if (!pickup || !dropoff || !pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Pickup and dropoff locations required' },
        });
      }

      // Check if customer has active ride
      const activeRide = await rideService.getActiveRideForCustomer(req.user!.userId);
      if (activeRide) {
        return res.status(400).json({
          success: false,
          error: { code: 'ACTIVE_RIDE_EXISTS', message: 'You already have an active ride' },
        });
      }

      const ride = await rideService.createRide({
        customerId: req.user!.userId,
        pickup,
        dropoff,
      });

      res.status(201).json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Create ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_FAILED', message: 'Failed to create ride' },
      });
    }
  });

  // Get ride by ID
  router.get('/:rideId', async (req: AuthRequest, res: Response) => {
    try {
      const ride = await rideService.getRideById(req.params.rideId);
      if (!ride) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ride not found' },
        });
      }

      // Verify access
      if (req.user!.role !== 'ADMIN' && 
          ride.customerId !== req.user!.userId && 
          ride.driverId !== req.user!.userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Get ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get ride' },
      });
    }
  });

  // Get customer's rides
  router.get('/customer/history', async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const { rides, total } = await rideService.getCustomerRides(req.user!.userId, page, limit);
      res.json({ success: true, data: { rides }, meta: { page, limit, total } });
    } catch (err) {
      logger.error('Get customer rides error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get rides' },
      });
    }
  });

  // Get customer's active ride
  router.get('/customer/active', async (req: AuthRequest, res: Response) => {
    try {
      const ride = await rideService.getActiveRideForCustomer(req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Get active ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get active ride' },
      });
    }
  });

  // Get driver's active ride
  router.get('/driver/active', async (req: AuthRequest, res: Response) => {
    try {
      // Note: This expects driverId (profile ID) in query or we need to fetch it from driver-service
      // For now, return null if driverId not provided
      const driverId = req.query.driverId as string;
      
      if (!driverId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'driverId query parameter required' },
        });
      }
      
      const ride = await rideService.getActiveRideForDriver(driverId);
      
      if (!ride) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No active ride' },
        });
      }
      
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Get driver active ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get active ride' },
      });
    }
  });

  // Get driver's rides
  router.get('/driver/history', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can access driver rides' },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const { rides, total } = await rideService.getDriverRides(req.user!.userId, page, limit);
      res.json({ success: true, data: { rides }, meta: { page, limit, total } });
    } catch (err) {
      logger.error('Get driver rides error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get rides' },
      });
    }
  });

  // Accept ride (Driver)
  router.post('/:rideId/accept', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can accept rides' },
        });
      }

      const ride = await rideService.acceptRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Accept ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to accept ride';
      res.status(400).json({
        success: false,
        error: { code: 'ACCEPT_FAILED', message },
      });
    }
  });

  // Reject ride (Driver)
  router.post('/:rideId/reject', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can reject rides' },
        });
      }

      const ride = await rideService.rejectRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Reject ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to reject ride';
      res.status(400).json({
        success: false,
        error: { code: 'REJECT_FAILED', message },
      });
    }
  });

  // Start ride (Driver)
  router.post('/:rideId/start', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can start rides' },
        });
      }

      const ride = await rideService.startRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Start ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to start ride';
      res.status(400).json({
        success: false,
        error: { code: 'START_FAILED', message },
      });
    }
  });

  // Complete ride (Driver)
  router.post('/:rideId/complete', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can complete rides' },
        });
      }

      const ride = await rideService.completeRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Complete ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to complete ride';
      res.status(400).json({
        success: false,
        error: { code: 'COMPLETE_FAILED', message },
      });
    }
  });

  // Cancel ride
  router.post('/:rideId/cancel', async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body;
      const userType = req.user!.role === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';

      const ride = await rideService.cancelRide(
        req.params.rideId,
        req.user!.userId,
        userType as 'CUSTOMER' | 'DRIVER',
        reason
      );
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Cancel ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to cancel ride';
      res.status(400).json({
        success: false,
        error: { code: 'CANCEL_FAILED', message },
      });
    }
  });

  // Internal: Assign driver (called by matching service/worker)
  router.post('/:rideId/assign', async (req: Request, res: Response) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'driverId required' },
        });
      }

      const ride = await rideService.assignDriver(req.params.rideId, driverId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Assign driver error:', err);
      const message = err instanceof Error ? err.message : 'Failed to assign driver';
      res.status(400).json({
        success: false,
        error: { code: 'ASSIGN_FAILED', message },
      });
    }
  });

  return router;
};

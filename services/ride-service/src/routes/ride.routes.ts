import { Router, Request, Response } from 'express';
import { RideService } from '../services/ride.service';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const createRideRouter = (rideService: RideService): Router => {
  const router = Router();

  // Get available rides for driver (browse mode)
  router.get('/available', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can view available rides' },
        });
      }

      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseInt(req.query.radius as string) || 5; // 5km default
      const vehicleType = req.query.vehicleType as string; // optional filter

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'lat and lng query parameters required' },
        });
      }

      const availableRides = await rideService.getAvailableRides(lat, lng, radius, vehicleType);
      res.json({ success: true, data: { rides: availableRides } });
    } catch (err) {
      logger.error('Get available rides error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get available rides' },
      });
    }
  });

  // Create ride (Customer)
  router.post('/', async (req: AuthRequest, res: Response) => {
    try {
      const { pickup, dropoff } = req.body;
      const { vehicleType, paymentMethod } = req.body;
      
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
        vehicleType,
        paymentMethod,
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
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can access this' },
        });
      }

      // Use userId from auth token - this is the driver's userId
      const userId = req.user!.userId;
      
      // First, get driver profile to get driverId
      const axios = require('axios');
      let driverId = userId; // fallback
      
      try {
        // Gọi endpoint nội bộ driver-service
        const internalToken = process.env.INTERNAL_SERVICE_TOKEN || 'secret';
        const driverRes = await axios.get(
          `${process.env.DRIVER_SERVICE_URL || 'http://driver-service:3003'}/internal/drivers/by-user/${userId}`,
          { headers: { 'x-internal-token': internalToken } }
        );
        if (driverRes.data?.data?.driver?.id) {
          driverId = driverRes.data.data.driver.id;
        }
      } catch (err) {
        logger.warn('Could not fetch driver profile, using userId as driverId');
      }
      
      const ride = await rideService.getActiveRideForDriver(driverId);
      
      if (!ride) {
        return res.json({
          success: true,
          data: null,
        });
      }
      
      res.json({ success: true, data: ride });
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

  // Driver accept ride from available rides list
  router.post('/:rideId/driver-accept', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can accept rides' },
        });
      }

      // Pass driverId from body or user context
      const driverId = req.body.driverId || req.user!.userId;
      const ride = await rideService.driverAcceptRide(req.params.rideId, driverId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Driver accept ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to accept ride';
      res.status(400).json({
        success: false,
        error: { code: 'ACCEPT_FAILED', message },
      });
    }
  });
  // Complete ride (Driver)
  // Mark passenger picked up
  router.post('/:rideId/pickup', async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can mark pickup' },
        });
      }

      const ride = await rideService.markPickedUp(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Pickup error:', err);
      const message = err instanceof Error ? err.message : 'Failed to mark pickup';
      res.status(400).json({
        success: false,
        error: { code: 'PICKUP_FAILED', message },
      });
    }
  });
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

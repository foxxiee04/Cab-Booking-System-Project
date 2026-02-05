import { Request, Response } from 'express';
import { RideService } from '../services/ride.service';
import { logger } from '../utils/logger';
import { UserRole } from '../enums/ride-status.enum';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export class RideController {
  constructor(private readonly rideService: RideService) {}

  getAvailableRides = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can view available rides' },
        });
      }

      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseInt(req.query.radius as string) || 5;
      const vehicleType = req.query.vehicleType as string;

      const availableRides = await this.rideService.getAvailableRides(lat, lng, radius, vehicleType);
      res.json({ success: true, data: { rides: availableRides } });
    } catch (err) {
      logger.error('Get available rides error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get available rides' },
      });
    }
  };

  createRide = async (req: AuthRequest, res: Response) => {
    try {
      const { pickup, dropoff, vehicleType, paymentMethod } = req.body;

      // Check if customer has active ride
      const activeRide = await this.rideService.getActiveRideForCustomer(req.user!.userId);
      if (activeRide) {
        return res.status(400).json({
          success: false,
          error: { code: 'ACTIVE_RIDE_EXISTS', message: 'You already have an active ride' },
        });
      }

      const ride = await this.rideService.createRide({
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
  };

  getRideById = async (req: AuthRequest, res: Response) => {
    try {
      const ride = await this.rideService.getRideById(req.params.rideId);
      if (!ride) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ride not found' },
        });
      }

      // Verify access
      if (req.user!.role !== UserRole.ADMIN && 
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
  };

  getCustomerRides = async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const { rides, total } = await this.rideService.getCustomerRides(req.user!.userId, page, limit);
      res.json({ success: true, data: { rides }, meta: { page, limit, total } });
    } catch (err) {
      logger.error('Get customer rides error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get rides' },
      });
    }
  };

  getCustomerActiveRide = async (req: AuthRequest, res: Response) => {
    try {
      const ride = await this.rideService.getActiveRideForCustomer(req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Get active ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get active ride' },
      });
    }
  };

  getDriverActiveRide = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can access this' },
        });
      }

      const userId = req.user!.userId;
      
      // Get driver profile to get driverId
      const axios = require('axios');
      let driverId = userId;
      
      try {
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
      
      const ride = await this.rideService.getActiveRideForDriver(driverId);
      
      if (!ride) {
        return res.json({ success: true, data: null });
      }
      
      res.json({ success: true, data: ride });
    } catch (err) {
      logger.error('Get driver active ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get active ride' },
      });
    }
  };

  getDriverRides = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can access driver rides' },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const { rides, total } = await this.rideService.getDriverRides(req.user!.userId, page, limit);
      res.json({ success: true, data: { rides }, meta: { page, limit, total } });
    } catch (err) {
      logger.error('Get driver rides error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get rides' },
      });
    }
  };

  acceptRide = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can accept rides' },
        });
      }

      const ride = await this.rideService.acceptRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Accept ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to accept ride';
      res.status(400).json({
        success: false,
        error: { code: 'ACCEPT_FAILED', message },
      });
    }
  };

  rejectRide = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can reject rides' },
        });
      }

      const ride = await this.rideService.rejectRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Reject ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to reject ride';
      res.status(400).json({
        success: false,
        error: { code: 'REJECT_FAILED', message },
      });
    }
  };

  startRide = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can start rides' },
        });
      }

      const ride = await this.rideService.startRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Start ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to start ride';
      res.status(400).json({
        success: false,
        error: { code: 'START_FAILED', message },
      });
    }
  };

  driverAcceptRide = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can accept rides' },
        });
      }

      const driverId = req.body.driverId || req.user!.userId;
      const ride = await this.rideService.driverAcceptRide(req.params.rideId, driverId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Driver accept ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to accept ride';
      res.status(400).json({
        success: false,
        error: { code: 'ACCEPT_FAILED', message },
      });
    }
  };

  markPickedUp = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can mark pickup' },
        });
      }

      const ride = await this.rideService.markPickedUp(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Pickup error:', err);
      const message = err instanceof Error ? err.message : 'Failed to mark pickup';
      res.status(400).json({
        success: false,
        error: { code: 'PICKUP_FAILED', message },
      });
    }
  };

  completeRide = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can complete rides' },
        });
      }

      const ride = await this.rideService.completeRide(req.params.rideId, req.user!.userId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Complete ride error:', err);
      const message = err instanceof Error ? err.message : 'Failed to complete ride';
      res.status(400).json({
        success: false,
        error: { code: 'COMPLETE_FAILED', message },
      });
    }
  };

  cancelRide = async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body;
      const userType = req.user!.role === UserRole.DRIVER ? 'DRIVER' : 'CUSTOMER';

      const ride = await this.rideService.cancelRide(
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
  };

  assignDriver = async (req: Request, res: Response) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'driverId required' },
        });
      }

      const ride = await this.rideService.assignDriver(req.params.rideId, driverId);
      res.json({ success: true, data: { ride } });
    } catch (err) {
      logger.error('Assign driver error:', err);
      const message = err instanceof Error ? err.message : 'Failed to assign driver';
      res.status(400).json({
        success: false,
        error: { code: 'ASSIGN_FAILED', message },
      });
    }
  };

  // Driver accepts an offered ride (Task 2.1)
  acceptOffer = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can accept offers' },
        });
      }

      const driverId = req.user!.userId;
      const ride = await this.rideService.driverAcceptOfferedRide(req.params.rideId, driverId);
      
      res.json({ 
        success: true, 
        data: { ride },
        message: 'Offer accepted successfully'
      });
    } catch (err) {
      logger.error('Accept offer error:', err);
      const message = err instanceof Error ? err.message : 'Failed to accept offer';
      res.status(400).json({
        success: false,
        error: { code: 'ACCEPT_OFFER_FAILED', message },
      });
    }
  };

  // Driver rejects an offered ride (Task 2.1)
  rejectOffer = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.DRIVER) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can reject offers' },
        });
      }

      const driverId = req.user!.userId;
      const reason = req.body.reason as string | undefined;
      
      const ride = await this.rideService.driverRejectOffer(req.params.rideId, driverId, reason);
      
      res.json({ 
        success: true, 
        data: { ride },
        message: 'Offer rejected successfully'
      });
    } catch (err) {
      logger.error('Reject offer error:', err);
      const message = err instanceof Error ? err.message : 'Failed to reject offer';
      res.status(400).json({
        success: false,
        error: { code: 'REJECT_OFFER_FAILED', message },
      });
    }
  };
}

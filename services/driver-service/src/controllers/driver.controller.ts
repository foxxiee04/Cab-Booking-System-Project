import { Request, Response } from 'express';
import { DriverService } from '../services/driver.service';
import { logger } from '../utils/logger';
import axios from 'axios';
import { config } from '../config';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  registerDriver = async (req: AuthRequest, res: Response) => {
    try {
      const { vehicle, license } = req.body;

      const driver = await this.driverService.registerDriver({
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
  };

  getMe = async (req: AuthRequest, res: Response) => {
    try {
      let driver = await this.driverService.getDriverByUserId(req.user!.userId);
      
      if (!driver) {
        logger.info(`Auto-creating driver profile for userId: ${req.user!.userId}`);
        driver = await this.driverService.registerDriver({
          userId: req.user!.userId,
          vehicle: {
            type: 'CAR',
            brand: 'Unknown',
            model: 'Unknown',
            plate: 'TEMP',
            color: 'Unknown',
            year: new Date().getFullYear(),
          },
          license: {
            number: 'TEMP',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
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
  };

  goOnline = async (req: AuthRequest, res: Response) => {
    try {
      const driver = await this.driverService.goOnline(req.user!.userId);
      res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Go online error:', err);
      const message = err instanceof Error ? err.message : 'Failed to go online';
      res.status(400).json({
        success: false,
        error: { code: 'GO_ONLINE_FAILED', message },
      });
    }
  };

  goOffline = async (req: AuthRequest, res: Response) => {
    try {
      const driver = await this.driverService.goOffline(req.user!.userId);
      res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Go offline error:', err);
      const message = err instanceof Error ? err.message : 'Failed to go offline';
      res.status(400).json({
        success: false,
        error: { code: 'GO_OFFLINE_FAILED', message },
      });
    }
  };

  updateLocation = async (req: AuthRequest, res: Response) => {
    try {
      const { lat, lng } = req.body;

      const driver = await this.driverService.getDriverByUserId(req.user!.userId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'DRIVER_NOT_FOUND', message: 'Driver profile not found' },
        });
      }

      await this.driverService.updateLocation(driver.id, { lat, lng });
      res.json({ success: true, data: { message: 'Location updated' } });
    } catch (err) {
      logger.error('Update location error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update location';
      res.status(400).json({
        success: false,
        error: { code: 'LOCATION_UPDATE_FAILED', message },
      });
    }
  };

  getAvailableRides = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can view rides' },
        });
      }

      const { lat, lng, radius, vehicleType } = req.query;

      const response = await axios.get(`${process.env.RIDE_SERVICE_URL || config.services.ride}/api/rides/available`, {
        params: { lat, lng, radius, vehicleType },
        headers: { Authorization: req.header('authorization') || '' },
        timeout: 5000,
      });

      res.json({ success: true, data: response.data.data });
    } catch (err: any) {
      logger.error('Get available rides error (proxy):', err.response?.data || err.message);
      const message = err.response?.data?.error?.message || 'Failed to get available rides';
      res.status(err.response?.status || 500).json({
        success: false,
        error: { code: 'AVAILABLE_RIDES_FAILED', message },
      });
    }
  };

  acceptRide = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== 'DRIVER') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only drivers can accept rides' },
        });
      }

      const driver = await this.driverService.getDriverByUserId(req.user!.userId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'DRIVER_NOT_FOUND', message: 'Driver profile not found' },
        });
      }

      const response = await axios.post(
        `${process.env.RIDE_SERVICE_URL || config.services.ride}/api/rides/${req.params.rideId}/driver-accept`,
        { driverId: driver._id?.toString() || driver.id },
        { headers: { Authorization: req.header('authorization') || '' }, timeout: 5000 }
      );

      res.json({ success: true, data: response.data.data });
    } catch (err: any) {
      logger.error('Driver accept ride error (proxy):', err.response?.data || err.message);
      const message = err.response?.data?.error?.message || 'Failed to accept ride';
      res.status(err.response?.status || 500).json({
        success: false,
        error: { code: 'ACCEPT_RIDE_FAILED', message },
      });
    }
  };

  getAssignedRide = async (req: AuthRequest, res: Response) => {
    try {
      const driver = await this.driverService.getDriverByUserId(req.user!.userId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: { code: 'DRIVER_NOT_FOUND', message: 'Driver profile not found' },
        });
      }

      res.json({ success: true, data: { ride: null } });
    } catch (err) {
      logger.error('Get assigned ride error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get assigned ride' },
      });
    }
  };

  findNearbyDrivers = async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 5;

      const drivers: any[] = [];
      res.json({ success: true, data: { drivers } });
    } catch (err) {
      logger.error('Find nearby drivers error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to find drivers' },
      });
    }
  };

  getAllDrivers = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const result = await this.driverService.getDrivers(status ? { status: status as any } : undefined);
      const drivers = Array.isArray(result) ? result : [];
      const total = drivers.length;
      
      res.json({ success: true, data: { drivers }, meta: { page, limit, total } });
    } catch (err) {
      logger.error('Get drivers error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get drivers' },
      });
    }
  };

  verifyDriver = async (req: Request, res: Response) => {
    try {
      const { verified } = req.body;
      const driver = await this.driverService.updateDriver(req.params.driverId, { verified });

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
  };

  getDriverByUserId = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: { code: 'VALIDATION_ERROR', message: 'userId required' } 
        });
      }
      
      const driver = await this.driverService.getDriverByUserId(userId);
      if (!driver) {
        return res.status(404).json({ 
          success: false, 
          error: { code: 'NOT_FOUND', message: 'Driver not found' } 
        });
      }
      
      res.json({ success: true, data: { driver } });
    } catch (err) {
      logger.error('Get driver by userId error:', err);
      res.status(500).json({ 
        success: false, 
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get driver by userId' } 
      });
    }
  };
}

import { Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { RideStatus as PrismaRideStatus } from '../generated/prisma-client';
import { RideService } from '../services/ride.service';
import { logger } from '../utils/logger';
import { UserRole } from '../enums/ride-status.enum';
import { driverGrpcClient } from '../grpc/driver.client';

interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export class RideController {
  constructor(private readonly rideService: RideService) {}

  private async canAccessRide(req: AuthRequest, ride: { customerId: string; driverId: string | null }): Promise<boolean> {
    const hasAdminAccess = req.user!.role === UserRole.ADMIN;
    const hasCustomerAccess = ride.customerId === req.user!.userId;
    const driverActorIds = req.user!.role === UserRole.DRIVER
      ? await this.resolveDriverActorIds(req.user!.userId)
      : [];
    const hasDriverAccess = Boolean(ride.driverId && driverActorIds.includes(ride.driverId));

    return hasAdminAccess || hasCustomerAccess || hasDriverAccess;
  }

  private mapRideMessage(message: any) {
    return {
      id: message.id,
      from: message.senderId,
      role: message.senderRole,
      type: message.type,
      message: message.message,
      timestamp: new Date(message.createdAt).getTime(),
      createdAt: message.createdAt,
    };
  }

  private async resolveDriverActorIds(userId: string): Promise<string[]> {
    const actorIds = [userId];

    try {
      const driver = await driverGrpcClient.getDriverByUserId(userId);
      if (driver?.id) {
        actorIds.unshift(driver.id);
      }
    } catch (err) {
      logger.warn('Could not fetch driver profile, using userId as driverId');
    }

    return [...new Set(actorIds.filter(Boolean))];
  }

  private async resolveDriverActorId(userId: string): Promise<string> {
    const [driverActorId] = await this.resolveDriverActorIds(userId);
    return driverActorId;
  }

  private isDriverOwnershipMismatch(message: string): boolean {
    const normalizedMessage = message.toLowerCase();

    return normalizedMessage.includes('assigned ride')
      || normalizedMessage.includes('assigned driver')
      || normalizedMessage.includes('own offer');
  }

  private async withResolvedDriverActorId<T>(
    userId: string,
    operation: (actorId: string) => Promise<T>,
  ): Promise<T> {
    const actorIds = await this.resolveDriverActorIds(userId);
    let lastError: unknown;

    for (let index = 0; index < actorIds.length; index += 1) {
      const actorId = actorIds[index];

      try {
        return await operation(actorId);
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        const hasFallback = index < actorIds.length - 1;

        if (!hasFallback || !this.isDriverOwnershipMismatch(message)) {
          throw err;
        }

        logger.warn(`Retrying driver ride action with fallback actorId for user ${userId}`);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Driver action failed');
  }

  private parseRideStatuses(rawStatus: unknown): PrismaRideStatus[] | undefined {
    const requestedValues = Array.isArray(rawStatus)
      ? rawStatus.flatMap((value) => String(value).split(','))
      : typeof rawStatus === 'string'
        ? rawStatus.split(',')
        : [];

    const validStatuses = new Set<string>(Object.values(PrismaRideStatus));
    const parsedStatuses = requestedValues
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is PrismaRideStatus => validStatuses.has(value));

    return parsedStatuses.length > 0 ? parsedStatuses : undefined;
  }

  private getCompatibleDriverVehicleTypes(requestedVehicleType?: string): string[] | null {
    switch ((requestedVehicleType || '').toUpperCase()) {
      case 'MOTORBIKE':
        return ['MOTORBIKE'];
      case 'SCOOTER':
        return ['SCOOTER'];
      case 'CAR_4':
        return ['CAR_4'];
      case 'CAR_7':
        return ['CAR_7'];
      // legacy fallback
      case 'ECONOMY':
        return ['MOTORBIKE'];
      case 'COMFORT':
        return ['CAR_4'];
      case 'PREMIUM':
        return ['CAR_7'];
      default:
        return null;
    }
  }

  private isCompatibleDriverVehicleType(driverVehicleType: string | undefined, requestedVehicleType?: string): boolean {
    const compatibleDriverTypes = this.getCompatibleDriverVehicleTypes(requestedVehicleType);
    if (!compatibleDriverTypes || !driverVehicleType) {
      return true;
    }

    return compatibleDriverTypes.includes(driverVehicleType.toUpperCase());
  }

  getAllRides = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const { rides, total } = await this.rideService.getAllRides(
        page,
        limit,
        status as any
      );

      res.json({ success: true, data: { rides, total } });
    } catch (err) {
      logger.error('Get all rides error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get rides' },
      });
    }
  };

  getRideStats = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const stats = await this.rideService.getRideStats();
      res.json({ success: true, data: { stats } });
    } catch (err) {
      logger.error('Get ride stats error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get ride stats' },
      });
    }
  };

  getVehicleBreakdown = async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 730);
      const data = await this.rideService.getVehicleBreakdown(days);
      res.json({ success: true, data });
    } catch (err) {
      logger.error('Get vehicle breakdown error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get vehicle breakdown' },
      });
    }
  };

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
      const parsedRadius = parseFloat(req.query.radius as string);
      const configuredRadius = config.ride.searchRadiusKm;
      const radius = Number.isFinite(parsedRadius)
        ? Math.max(0.5, Math.min(parsedRadius, configuredRadius))
        : configuredRadius;
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
      const { pickup, dropoff, vehicleType, paymentMethod, voucherCode } = req.body;

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
        voucherCode,
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
      if (!(await this.canAccessRide(req, ride))) {
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

  getRideMessages = async (req: AuthRequest, res: Response) => {
    try {
      const ride = await this.rideService.getRideById(req.params.rideId);
      if (!ride) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ride not found' },
        });
      }

      if (!(await this.canAccessRide(req, ride))) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      if (!this.rideService.isChatHistoryAvailableStatus(ride.status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'CHAT_NOT_AVAILABLE', message: 'Chat chỉ khả dụng sau khi chuyến đã được nhận hoặc khi cần xem lại lịch sử' },
        });
      }

      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '100'), 10) || 100, 1), 200);
      const messages = await this.rideService.getRideMessages(req.params.rideId, limit);

      res.json({ success: true, data: { messages: messages.map((message) => this.mapRideMessage(message)) } });
    } catch (err) {
      logger.error('Get ride messages error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get ride messages' },
      });
    }
  };

  sendRideMessage = async (req: AuthRequest, res: Response) => {
    try {
      const ride = await this.rideService.getRideById(req.params.rideId);
      if (!ride) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ride not found' },
        });
      }

      if (!(await this.canAccessRide(req, ride))) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
      }

      const rawMessage = typeof req.body?.message === 'string' ? req.body.message : '';
      const type = typeof req.body?.type === 'string' ? req.body.type : 'TEXT';

      if (!rawMessage.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'message is required' },
        });
      }

      const message = await this.rideService.createRideMessage(
        req.params.rideId,
        req.user!.userId,
        req.user!.role,
        rawMessage,
        type,
      );

      res.status(201).json({ success: true, data: { message: this.mapRideMessage(message) } });
    } catch (err) {
      logger.error('Send ride message error:', err);
      const message = err instanceof Error ? err.message : 'Failed to send message';
      const statusCode = /active|empty|long|not found/i.test(message) ? 400 : 500;
      res.status(statusCode).json({
        success: false,
        error: { code: 'SEND_MESSAGE_FAILED', message },
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

      const driverActorIds = await this.resolveDriverActorIds(req.user!.userId);
      let ride = null;

      for (const driverActorId of driverActorIds) {
        ride = await this.rideService.getActiveRideForDriver(driverActorId);
        if (ride) {
          break;
        }
      }
      
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
      const statuses = this.parseRideStatuses(req.query.status);

      const driverActorIds = await this.resolveDriverActorIds(req.user!.userId);
      const { rides, total } = await this.rideService.getDriverRides(driverActorIds, page, limit, statuses);
      res.json({ success: true, data: { rides, total }, meta: { page, limit, total } });
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

      const ride = await this.withResolvedDriverActorId(req.user!.userId, (driverId) =>
        this.rideService.acceptRide(req.params.rideId, driverId)
      );
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

      const ride = await this.withResolvedDriverActorId(req.user!.userId, (driverId) =>
        this.rideService.rejectRide(req.params.rideId, driverId)
      );
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

      const ride = await this.withResolvedDriverActorId(req.user!.userId, (driverId) =>
        this.rideService.startRide(req.params.rideId, driverId)
      );
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

      const driver = await driverGrpcClient.getDriverByUserId(req.user!.userId);
      if (!driver?.id) {
        return res.status(404).json({
          success: false,
          error: { code: 'DRIVER_NOT_FOUND', message: 'Driver profile not found' },
        });
      }

      const requestedRide = await this.rideService.getRideById(req.params.rideId);
      if (!requestedRide) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Ride not found' },
        });
      }

      if (!this.isCompatibleDriverVehicleType(driver.vehicleType, requestedRide.vehicleType)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VEHICLE_TYPE_MISMATCH',
            message: 'Loại xe của tài xế không phù hợp với chuyến đi này',
          },
        });
      }

      // Wallet balance check for CASH rides
      // Uses wallet-service (wallet_db, keyed by userId) — the authoritative source.
      // payment-service (payment_db) never receives top-up credits so it always
      // shows balance=0 for new drivers, causing a false "activation required" error.
      if (requestedRide.paymentMethod === 'CASH') {
        try {
          const walletResp = await axios.get(
            `${config.services.wallet}/internal/driver/${req.user!.userId}/can-accept`,
            {
              headers: { 'x-internal-token': config.internalServiceToken },
              timeout: 3000,
            },
          );
          const { canAcceptRide, reason } = walletResp.data?.data ?? {};
          if (canAcceptRide === false) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INSUFFICIENT_WALLET_BALANCE',
                message: reason || 'Số dư ví không đủ để nhận cuốc tiền mặt này. Vui lòng nạp thêm tiền vào ví.',
              },
            });
          }
        } catch (walletErr) {
          // Non-blocking: if wallet service is unreachable, allow the ride to proceed
          logger.warn('Wallet check skipped (wallet service unavailable):', walletErr);
        }
      }

      const ride = await this.rideService.driverAcceptRide(req.params.rideId, driver.id);
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

      const ride = await this.withResolvedDriverActorId(req.user!.userId, (driverId) =>
        this.rideService.markPickedUp(req.params.rideId, driverId)
      );
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

      const ride = await this.withResolvedDriverActorId(req.user!.userId, (driverId) =>
        this.rideService.completeRide(req.params.rideId, driverId)
      );
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

      const ride = userType === 'DRIVER'
        ? await this.withResolvedDriverActorId(req.user!.userId, (actorId) =>
            this.rideService.cancelRide(
              req.params.rideId,
              actorId,
              'DRIVER',
              reason
            )
          )
        : await this.rideService.cancelRide(
            req.params.rideId,
            req.user!.userId,
            'CUSTOMER',
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

      const driverId = await this.resolveDriverActorId(req.user!.userId);
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

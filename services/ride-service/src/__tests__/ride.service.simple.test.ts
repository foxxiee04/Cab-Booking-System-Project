// Mock Prisma before imports
const mockPrisma: any = {
  ride: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../generated/prisma-client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  RideStatus: {
    CREATED: 'CREATED',
    FINDING_DRIVER: 'FINDING_DRIVER',
    ASSIGNED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    PICKING_UP: 'PICKING_UP',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
}));

jest.mock('axios');
jest.mock('../events/publisher');
jest.mock('../config', () => ({
  config: {
    services: {
      ai: 'http://ai-service:8000',
      driver: 'http://driver-service:3003',
      payment: 'http://payment-service:3006',
    },
    ride: {
      searchRadiusKm: 5,
      matchingTimeoutMs: 30000,
      maxMatchingRetries: 3,
    },
  },
}));

import { RideService } from '../services/ride.service';
import { EventPublisher } from '../events/publisher';
import axios from 'axios';

describe('RideService - Simple Test Suite', () => {
  let rideService: RideService;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.ride.findFirst.mockReset();
    mockPrisma.ride.findUnique.mockReset();
    mockPrisma.ride.findMany.mockReset();
    mockPrisma.ride.create.mockReset();
    mockPrisma.ride.update.mockReset();
    mockPrisma.ride.delete.mockReset();
    mockPrisma.ride.count.mockReset();

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    rideService = new RideService(mockPrisma, mockEventPublisher);
  });

  describe('CREATE RIDE', () => {
    it('should create ride successfully with AI service', async () => {
      const input = {
        customerId: 'customer-123',
        pickup: {
          address: '123 Nguyen Hue',
          lat: 10.7764,
          lng: 106.7008,
        },
        dropoff: {
          address: '456 Le Loi',
          lat: 10.7809,
          lng: 106.6956,
        },
        vehicleType: 'ECONOMY' as const,
        paymentMethod: 'CASH' as const,
      };

      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          surge_multiplier: 1.2,
          estimated_fare: 50000,
          distance_km: 5.5,
          duration_minutes: 15,
        },
      });

      mockPrisma.ride.findFirst.mockResolvedValue(null);
      mockPrisma.ride.create.mockResolvedValue({
        id: 'ride-123',
        customerId: 'customer-123',
        status: 'CREATED',
        fare: 50000,
      });

      const result = await rideService.createRide(input);

      expect(result.id).toBe('ride-123');
      expect(mockPrisma.ride.create).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'ride.created',
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should use fallback calculation if AI service fails', async () => {
      const input = {
        customerId: 'customer-123',
        pickup: {
          address: '123 Nguyen Hue',
          lat: 10.7764,
          lng: 106.7008,
        },
        dropoff: {
          address: '456 Le Loi',
          lat: 10.7809,
          lng: 106.6956,
        },
      };

      (axios.post as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      mockPrisma.ride.findFirst.mockResolvedValue(null);
      mockPrisma.ride.create.mockResolvedValue({
        id: 'ride-123',
        customerId: 'customer-123',
        status: 'CREATED',
      });

      const result = await rideService.createRide(input);

      expect(result.id).toBe('ride-123');
      expect(mockPrisma.ride.create).toHaveBeenCalled();
    });

    it('should throw error if customer has active ride', async () => {
      const input = {
        customerId: 'customer-123',
        pickup: {
          address: '123 Nguyen Hue',
          lat: 10.7764,
          lng: 106.7008,
        },
        dropoff: {
          address: '456 Le Loi',
          lat: 10.7809,
          lng: 106.6956,
        },
      };

      mockPrisma.ride.findFirst.mockResolvedValue({
        id: 'active-ride',
        status: 'IN_PROGRESS',
      });

      await expect(rideService.createRide(input)).rejects.toThrow('Customer already has an active ride');
    });
  });

  describe('ASSIGN DRIVER', () => {
    it('should assign driver to ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        status: 'FINDING_DRIVER',
        suggestedDriverIds: ['driver-123'],
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'ASSIGNED',
      });

      const result = await rideService.assignDriver('ride-123', 'driver-123');

      expect(result.driverId).toBe('driver-123');
      expect(result.status).toBe('ASSIGNED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'ride.assigned',
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should throw error if ride not found', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue(null);

      await expect(rideService.assignDriver('ride-123', 'driver-123')).rejects.toThrow('Ride not found');
    });
  });

  describe('DRIVER ACCEPT RIDE', () => {
    it('should allow driver to accept ride', async () => {
      // First call in driverAcceptRide
      mockPrisma.ride.findUnique.mockResolvedValueOnce({
        id: 'ride-123',
        status: 'FINDING_DRIVER',
        suggestedDriverIds: ['driver-123'],
      });
      // Second call in assignDriver
      mockPrisma.ride.findUnique.mockResolvedValueOnce({
        id: 'ride-123',
        status: 'FINDING_DRIVER',
        suggestedDriverIds: ['driver-123'],
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'ASSIGNED',
      });

      const result = await rideService.driverAcceptRide('ride-123', 'driver-123');

      expect(result.driverId).toBe('driver-123');
    });

    it('should throw error if ride not available', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        status: 'COMPLETED',
      });

      await expect(rideService.driverAcceptRide('ride-123', 'driver-123')).rejects.toThrow(
        'Ride is not available for acceptance'
      );
    });
  });

  describe('ACCEPT RIDE', () => {
    it('should accept ride by driver', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'ASSIGNED',
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: 'ACCEPTED',
      });

      const result = await rideService.acceptRide('ride-123', 'driver-123');

      expect(result.status).toBe('ACCEPTED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'ride.accepted',
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should throw error if driver not assigned', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-456',
        status: 'ASSIGNED',
      });

      await expect(rideService.acceptRide('ride-123', 'driver-123')).rejects.toThrow(
        'Driver not assigned to this ride'
      );
    });
  });

  describe('REJECT RIDE', () => {
    it('should reject ride and find another driver', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'ASSIGNED',
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        driverId: null,
        status: 'FINDING_DRIVER',
      });

      const result = await rideService.rejectRide('ride-123', 'driver-123');

      expect(result.status).toBe('FINDING_DRIVER');
      expect(result.driverId).toBeNull();
    });
  });

  describe('MARK PICKED UP', () => {
    it('should mark ride as picking up', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'ACCEPTED',
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: 'PICKING_UP',
      });

      const result = await rideService.markPickedUp('ride-123', 'driver-123');

      expect(result.status).toBe('PICKING_UP');
    });
  });

  describe('START RIDE', () => {
    it('should start ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'PICKING_UP',
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: 'IN_PROGRESS',
      });

      const result = await rideService.startRide('ride-123', 'driver-123');

      expect(result.status).toBe('IN_PROGRESS');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'ride.started',
        expect.any(Object),
        expect.any(String)
      );
    });
  });

  describe('COMPLETE RIDE', () => {
    it('should complete ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'IN_PROGRESS',
        customerId: 'customer-123',
        fare: 50000,
        distance: 5.5,
        duration: 900,
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: 'COMPLETED',
      });

      const result = await rideService.completeRide('ride-123', 'driver-123');

      expect(result.status).toBe('COMPLETED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'ride.completed',
        expect.objectContaining({
          rideId: 'ride-123',
          fare: 50000,
        }),
        expect.any(String)
      );
    });
  });

  describe('CANCEL RIDE', () => {
    it('should cancel ride by customer', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        customerId: 'customer-123',
        status: 'FINDING_DRIVER',
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: 'CANCELLED',
      });

      const result = await rideService.cancelRide('ride-123', 'customer-123', 'CUSTOMER', 'Changed plans');

      expect(result.status).toBe('CANCELLED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'ride.cancelled',
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should throw error if customer tries to cancel another ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        customerId: 'customer-456',
        status: 'FINDING_DRIVER',
      });

      await expect(
        rideService.cancelRide('ride-123', 'customer-123', 'CUSTOMER')
      ).rejects.toThrow('Customer can only cancel their own ride');
    });
  });

  describe('GET RIDE', () => {
    it('should get ride by id', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        customerId: 'customer-123',
        status: 'COMPLETED',
      });

      const result = await rideService.getRideById('ride-123');

      expect(result?.id).toBe('ride-123');
    });

    it('should return null if ride not found', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue(null);

      const result = await rideService.getRideById('ride-123');

      expect(result).toBeNull();
    });
  });

  describe('GET CUSTOMER RIDES', () => {
    it('should get customer rides with pagination', async () => {
      mockPrisma.ride.findMany.mockResolvedValue([
        { id: 'ride-1', customerId: 'customer-123' },
        { id: 'ride-2', customerId: 'customer-123' },
      ]);
      mockPrisma.ride.count.mockResolvedValue(2);

      const result = await rideService.getCustomerRides('customer-123', 1, 10);

      expect(result.rides).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('GET DRIVER RIDES', () => {
    it('should get driver rides with pagination', async () => {
      mockPrisma.ride.findMany.mockResolvedValue([
        { id: 'ride-1', driverId: 'driver-123' },
      ]);
      mockPrisma.ride.count.mockResolvedValue(1);

      const result = await rideService.getDriverRides('driver-123', 1, 10);

      expect(result.rides).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('GET ACTIVE RIDES', () => {
    it('should get active ride for customer', async () => {
      mockPrisma.ride.findFirst.mockResolvedValue({
        id: 'ride-123',
        customerId: 'customer-123',
        status: 'IN_PROGRESS',
      });

      const result = await rideService.getActiveRideForCustomer('customer-123');

      expect(result?.id).toBe('ride-123');
    });

    it('should get active ride for driver', async () => {
      mockPrisma.ride.findFirst.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-123',
        status: 'IN_PROGRESS',
      });

      const result = await rideService.getActiveRideForDriver('driver-123');

      expect(result?.id).toBe('ride-123');
    });
  });
});

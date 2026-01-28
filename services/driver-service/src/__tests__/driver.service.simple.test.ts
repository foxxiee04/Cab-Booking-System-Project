// Mock Prisma before imports
const mockPrisma: any = {
  driver: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  DriverStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    SUSPENDED: 'SUSPENDED',
  },
  AvailabilityStatus: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    BUSY: 'BUSY',
  },
  VehicleType: {
    CAR: 'CAR',
    MOTORCYCLE: 'MOTORCYCLE',
    SUV: 'SUV',
  },
}));

jest.mock('ioredis');
jest.mock('../events/publisher');

import { DriverService } from '../services/driver.service';
import { EventPublisher } from '../events/publisher';
import Redis from 'ioredis';

describe('DriverService - Simple Test Suite', () => {
  let driverService: DriverService;
  let mockRedis: jest.Mocked<Redis>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      geoadd: jest.fn().mockResolvedValue(1),
      georadius: jest.fn().mockResolvedValue([]),
      zrem: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    mockPrisma.driver.findUnique.mockReset();
    mockPrisma.driver.findFirst.mockReset();
    mockPrisma.driver.findMany.mockReset();
    mockPrisma.driver.create.mockReset();
    mockPrisma.driver.update.mockReset();
    mockPrisma.driver.delete.mockReset();

    driverService = new DriverService(mockRedis, mockEventPublisher);
  });

  describe('REGISTER DRIVER', () => {
    it('should register new driver successfully', async () => {
      const input = {
        userId: 'user-123',
        vehicle: {
          type: 'CAR' as const,
          brand: 'Toyota',
          model: 'Camry',
          plate: '29A-12345',
          color: 'Black',
          year: 2023,
        },
        license: {
          number: 'DL-123456',
          expiryDate: new Date('2025-12-31'),
        },
      };

      mockPrisma.driver.findUnique.mockResolvedValue(null);
      mockPrisma.driver.create.mockResolvedValue({
        id: 'driver-123',
        userId: 'user-123',
        status: 'PENDING',
      });

      const result = await driverService.registerDriver(input);

      expect(result.id).toBe('driver-123');
      expect(mockPrisma.driver.create).toHaveBeenCalled();
    });

    it('should throw error if driver already registered', async () => {
      const input = {
        userId: 'user-123',
        vehicle: {
          type: 'CAR' as const,
          brand: 'Toyota',
          model: 'Camry',
          plate: '29A-12345',
          color: 'Black',
          year: 2023,
        },
        license: {
          number: 'DL-123456',
          expiryDate: new Date('2025-12-31'),
        },
      };

      mockPrisma.driver.findUnique.mockResolvedValue({ id: 'existing-driver' });

      await expect(driverService.registerDriver(input)).rejects.toThrow('Driver already registered');
    });
  });

  describe('GO ONLINE/OFFLINE', () => {
    it('should set driver online', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        userId: 'user-123',
      });
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: 'ONLINE',
      });

      const result = await driverService.goOnline('user-123');

      expect(result.availabilityStatus).toBe('ONLINE');
    });

    it('should set driver offline', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: 'OFFLINE',
      });

      const result = await driverService.goOffline('user-123');

      expect(result.availabilityStatus).toBe('OFFLINE');
      expect(mockRedis.zrem).toHaveBeenCalled();
    });
  });

  describe('LOCATION TRACKING', () => {
    it('should update driver location', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: 'ONLINE',
      });
      mockPrisma.driver.update.mockResolvedValue({});

      await driverService.updateLocation('driver-123', { lat: 10.8231, lng: 106.6297 });

      expect(mockRedis.geoadd).toHaveBeenCalled();
      expect(mockPrisma.driver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastLocationLat: 10.8231,
            lastLocationLng: 106.6297,
          }),
        })
      );
    });

    it('should throw error if driver not online', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: 'OFFLINE',
      });

      await expect(
        driverService.updateLocation('driver-123', { lat: 10.8231, lng: 106.6297 })
      ).rejects.toThrow('Driver is not online');
    });

    it('should get nearby drivers', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', '1.5'],
        ['driver-2', '3.2'],
      ]);

      const result = await driverService.getNearbyDrivers({ lat: 10.8231, lng: 106.6297 }, 5);

      expect(result).toHaveLength(2);
      expect(result[0].driverId).toBe('driver-1');
      expect(result[0].distance).toBe(1.5);
    });
  });

  describe('AVAILABILITY STATUS', () => {
    it('should set driver busy', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: 'BUSY',
        currentRideId: 'ride-123',
      });

      const result = await driverService.setBusy('driver-123', 'ride-123');

      expect(result.availabilityStatus).toBe('BUSY');
      expect(result.currentRideId).toBe('ride-123');
    });

    it('should set driver available', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: 'ONLINE',
        currentRideId: null,
      });

      const result = await driverService.setAvailable('driver-123');

      expect(result.availabilityStatus).toBe('ONLINE');
      expect(result.currentRideId).toBeNull();
    });
  });

  describe('DRIVER APPROVAL', () => {
    it('should approve driver', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        userId: 'user-123',
        status: 'APPROVED',
      });

      const result = await driverService.approveDriver('driver-123');

      expect(result.status).toBe('APPROVED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'driver.approved',
        expect.any(Object)
      );
    });

    it('should reject driver', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        userId: 'user-123',
        status: 'REJECTED',
      });

      const result = await driverService.rejectDriver('driver-123', 'Invalid license');

      expect(result.status).toBe('REJECTED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'driver.rejected',
        expect.objectContaining({ reason: 'Invalid license' })
      );
    });
  });

  describe('RATING SYSTEM', () => {
    it('should update driver rating', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        ratingAverage: 4.5,
        ratingCount: 10,
      });
      mockPrisma.driver.update.mockResolvedValue({});

      await driverService.updateRating('driver-123', 5);

      expect(mockPrisma.driver.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ratingCount: 11,
          }),
        })
      );
    });

    it('should throw error if driver not found', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      await expect(driverService.updateRating('driver-123', 5)).rejects.toThrow('Driver not found');
    });
  });

  describe('GET DRIVERS', () => {
    it('should get all drivers', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', status: 'APPROVED' },
        { id: 'driver-2', status: 'PENDING' },
      ]);

      const result = await driverService.getDrivers();

      expect(result).toHaveLength(2);
    });

    it('should get drivers by status', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', status: 'APPROVED' },
      ]);

      const result = await driverService.getDrivers({ status: 'APPROVED' as any });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('APPROVED');
    });
  });

  describe('GET DRIVER', () => {
    it('should get driver by user id', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        userId: 'user-123',
      });

      const result = await driverService.getDriverByUserId('user-123');

      expect(result.id).toBe('driver-123');
    });

    it('should get driver by driver id', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        userId: 'user-123',
      });

      const result = await driverService.getDriverById('driver-123');

      expect(result.id).toBe('driver-123');
    });
  });
});

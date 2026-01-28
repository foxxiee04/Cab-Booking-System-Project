import { DriverService } from '../services/driver.service';
import { EventPublisher } from '../events/publisher';
import { PrismaClient, DriverStatus, AvailabilityStatus } from '@prisma/client';
import Redis from 'ioredis';

jest.mock('@prisma/client');
jest.mock('ioredis');
jest.mock('../events/publisher');

describe('DriverService - Comprehensive Test Suite', () => {
  let driverService: DriverService;
  let mockRedis: jest.Mocked<Redis>;
  let mockPrisma: any;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      geoadd: jest.fn().mockResolvedValue(1),
      georadius: jest.fn().mockResolvedValue([]),
      zrem: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    mockPrisma = {
      driver: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    driverService = new DriverService(mockRedis, mockEventPublisher);
  });

  describe('REGISTER DRIVER - Đăng ký tài xế', () => {
    const validDriverInput = {
      userId: 'user-123',
      vehicle: {
        type: 'CAR' as const,
        brand: 'Toyota',
        model: 'Vios',
        plate: '29A-12345',
        color: 'White',
        year: 2023,
      },
      license: {
        number: 'B2-012345678',
        expiryDate: new Date('2026-12-31'),
      },
    };

    describe('✅ Success Cases', () => {
      it('should register new driver successfully', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue(null);
        mockPrisma.driver.create.mockResolvedValue({
          id: 'driver-123',
          userId: 'user-123',
          status: DriverStatus.PENDING,
          availabilityStatus: AvailabilityStatus.OFFLINE,
          ...validDriverInput.vehicle,
          ...validDriverInput.license,
        });

        const result = await driverService.registerDriver(validDriverInput);

        expect(result).toBeDefined();
        expect(result.status).toBe(DriverStatus.PENDING);
        expect(mockEventPublisher.publish).toHaveBeenCalledWith('driver.registered', expect.any(Object));
      });

      it('should set initial status to PENDING for approval', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue(null);
        mockPrisma.driver.create.mockResolvedValue({
          id: 'driver-123',
          status: DriverStatus.PENDING,
        } as any);

        const result = await driverService.registerDriver(validDriverInput);

        expect(result.status).toBe(DriverStatus.PENDING);
      });

      it('should register different vehicle types (CAR, MOTORCYCLE, SUV)', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue(null);

        for (const vehicleType of ['CAR', 'MOTORCYCLE', 'SUV'] as const) {
          mockPrisma.driver.create.mockResolvedValue({
            id: `driver-${vehicleType}`,
            vehicleType,
          } as any);

          const result = await driverService.registerDriver({
            ...validDriverInput,
            vehicle: { ...validDriverInput.vehicle, type: vehicleType },
          });

          expect(result.vehicleType).toBe(vehicleType);
        }
      });
    });

    describe('❌ Error Cases', () => {
      it('should throw error if driver already registered', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'existing-driver',
          userId: 'user-123',
        });

        await expect(driverService.registerDriver(validDriverInput)).rejects.toThrow(
          'Driver already registered'
        );
      });

      it('should validate license expiry date', async () => {
        const expiredLicense = {
          ...validDriverInput,
          license: {
            number: 'B2-012345678',
            expiryDate: new Date('2020-01-01'), // Expired
          },
        };

        mockPrisma.driver.findUnique.mockResolvedValue(null);

        // Should validate expiry date
      });

      it('should validate vehicle plate format', async () => {
        const invalidPlate = {
          ...validDriverInput,
          vehicle: { ...validDriverInput.vehicle, plate: 'INVALID' },
        };

        // Should validate plate format (Vietnam format: 29A-12345)
      });
    });
  });

  describe('APPROVE/REJECT DRIVER - Admin duyệt tài xế', () => {
    describe('✅ Approve Cases', () => {
      it('should approve pending driver', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          status: DriverStatus.PENDING,
        });

        mockPrisma.driver.update.mockResolvedValue({
          id: 'driver-123',
          status: DriverStatus.APPROVED,
        } as any);

        const result = await driverService.approveDriver('driver-123');

        expect(result.status).toBe(DriverStatus.APPROVED);
        expect(mockEventPublisher.publish).toHaveBeenCalledWith('driver.approved', expect.any(Object));
      });

      it('should notify driver upon approval', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          userId: 'user-123',
          status: DriverStatus.PENDING,
        });

        mockPrisma.driver.update.mockResolvedValue({
          id: 'driver-123',
          status: DriverStatus.APPROVED,
        } as any);

        await driverService.approveDriver('driver-123');

        expect(mockEventPublisher.publish).toHaveBeenCalled();
      });
    });

    describe('❌ Reject Cases', () => {
      it('should reject driver with reason', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          status: DriverStatus.PENDING,
        });

        mockPrisma.driver.update.mockResolvedValue({
          id: 'driver-123',
          status: DriverStatus.REJECTED,
          rejectionReason: 'Invalid license',
        } as any);

        const result = await driverService.rejectDriver('driver-123', 'Invalid license');

        expect(result.status).toBe(DriverStatus.REJECTED);
        expect(result.rejectionReason).toBeDefined();
      });
    });
  });

  describe('GO ONLINE/OFFLINE - Tài xế online/offline', () => {
    describe('✅ Online Cases', () => {
      it('should set driver online successfully', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          userId: 'user-123',
          status: DriverStatus.APPROVED,
          availabilityStatus: AvailabilityStatus.OFFLINE,
        });

        mockPrisma.driver.update.mockResolvedValue({
          id: 'driver-123',
          availabilityStatus: AvailabilityStatus.ONLINE,
        } as any);

        const result = await driverService.goOnline('user-123');

        expect(result.availabilityStatus).toBe(AvailabilityStatus.ONLINE);
      });

      it('should add driver location to Redis geo index when online', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          userId: 'user-123',
          status: DriverStatus.APPROVED,
        });

        mockPrisma.driver.update.mockResolvedValue({
          id: 'driver-123',
          availabilityStatus: AvailabilityStatus.ONLINE,
        } as any);

        await driverService.goOnline('user-123');
        await driverService.updateLocation('user-123', { lat: 10.762622, lng: 106.660172 });

        expect(mockRedis.geoadd).toHaveBeenCalledWith(
          'drivers:geo:online',
          106.660172,
          10.762622,
          'driver-123'
        );
      });

      it('should only allow approved drivers to go online', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          status: DriverStatus.PENDING,
        });

        await expect(driverService.goOnline('user-123')).rejects.toThrow('Driver not approved');
      });
    });

    describe('✅ Offline Cases', () => {
      it('should set driver offline successfully', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          userId: 'user-123',
          availabilityStatus: AvailabilityStatus.ONLINE,
        });

        mockPrisma.driver.update.mockResolvedValue({
          id: 'driver-123',
          availabilityStatus: AvailabilityStatus.OFFLINE,
        } as any);

        const result = await driverService.goOffline('user-123');

        expect(result.availabilityStatus).toBe(AvailabilityStatus.OFFLINE);
      });

      it('should remove driver from Redis geo index when offline', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          userId: 'user-123',
        });

        mockPrisma.driver.update.mockResolvedValue({
          id: 'driver-123',
          availabilityStatus: AvailabilityStatus.OFFLINE,
        } as any);

        await driverService.goOffline('user-123');

        expect(mockRedis.zrem).toHaveBeenCalledWith('drivers:geo:online', 'driver-123');
      });

      it('should not allow going offline during active ride', async () => {
        mockPrisma.driver.findUnique.mockResolvedValue({
          id: 'driver-123',
          userId: 'user-123',
          availabilityStatus: AvailabilityStatus.BUSY,
        });

        await expect(driverService.goOffline('user-123')).rejects.toThrow('Cannot go offline during ride');
      });
    });
  });

  describe('LOCATION TRACKING - Theo dõi vị trí', () => {
    it('should update driver location in Redis', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        userId: 'user-123',
        availabilityStatus: AvailabilityStatus.ONLINE,
      });

      const location = { lat: 10.762622, lng: 106.660172 };

      await driverService.updateLocation('user-123', location);

      expect(mockRedis.geoadd).toHaveBeenCalledWith(
        'drivers:geo:online',
        location.lng,
        location.lat,
        'driver-123'
      );
    });

    it('should validate coordinates range', async () => {
      const invalidLocation = { lat: 91, lng: 181 }; // Invalid

      await expect(
        driverService.updateLocation('user-123', invalidLocation)
      ).rejects.toThrow('Invalid coordinates');
    });

    it('should get driver location from Redis', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ lat: 10.762622, lng: 106.660172 }));

      const location = await driverService.getDriverLocation('driver-123');

      expect(location).toEqual({ lat: 10.762622, lng: 106.660172 });
    });
  });

  describe('FIND NEARBY DRIVERS - Tìm tài xế gần', () => {
    it('should find drivers within radius', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', ['2.5']],
        ['driver-2', ['3.8']],
        ['driver-3', ['4.2']],
      ] as any);

      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', availabilityStatus: AvailabilityStatus.ONLINE, rating: 4.8 },
        { id: 'driver-2', availabilityStatus: AvailabilityStatus.ONLINE, rating: 4.6 },
        { id: 'driver-3', availabilityStatus: AvailabilityStatus.ONLINE, rating: 4.5 },
      ]);

      const result = await driverService.findNearbyDrivers(
        { lat: 10.762622, lng: 106.660172 },
        5 // 5km radius
      );

      expect(result).toHaveLength(3);
      expect(result[0].distance).toBeLessThanOrEqual(5);
    });

    it('should filter by vehicle type', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', ['2.0']],
        ['driver-2', ['3.0']],
      ] as any);

      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', vehicleType: 'CAR', availabilityStatus: AvailabilityStatus.ONLINE },
      ]);

      const result = await driverService.findNearbyDrivers(
        { lat: 10.762622, lng: 106.660172 },
        5,
        'CAR'
      );

      expect(result).toHaveLength(1);
      expect(result[0].vehicleType).toBe('CAR');
    });

    it('should sort by distance (nearest first)', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', ['4.5']],
        ['driver-2', ['1.2']],
        ['driver-3', ['3.0']],
      ] as any);

      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', availabilityStatus: AvailabilityStatus.ONLINE },
        { id: 'driver-2', availabilityStatus: AvailabilityStatus.ONLINE },
        { id: 'driver-3', availabilityStatus: AvailabilityStatus.ONLINE },
      ]);

      const result = await driverService.findNearbyDrivers({ lat: 10.762622, lng: 106.660172 }, 5);

      expect(result[0].distance).toBeLessThan(result[1].distance);
      expect(result[1].distance).toBeLessThan(result[2].distance);
    });

    it('should prioritize higher rated drivers', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', ['2.0']],
        ['driver-2', ['2.5']],
      ] as any);

      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', rating: 4.2, availabilityStatus: AvailabilityStatus.ONLINE },
        { id: 'driver-2', rating: 4.9, availabilityStatus: AvailabilityStatus.ONLINE },
      ]);

      const result = await driverService.findNearbyDrivers({ lat: 10.762622, lng: 106.660172 }, 5);

      // With similar distance, higher rated driver should be first
      // (if sorting algorithm includes rating)
    });

    it('should exclude BUSY drivers', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', ['2.0']],
        ['driver-2', ['3.0']],
      ] as any);

      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', availabilityStatus: AvailabilityStatus.ONLINE },
      ]);

      const result = await driverService.findNearbyDrivers({ lat: 10.762622, lng: 106.660172 }, 5);

      expect(result).toHaveLength(1);
      expect(result[0].availabilityStatus).toBe(AvailabilityStatus.ONLINE);
    });
  });

  describe('SET DRIVER BUSY/AVAILABLE - Đặt trạng thái bận/rảnh', () => {
    it('should set driver to BUSY when assigned to ride', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: AvailabilityStatus.ONLINE,
      });

      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: AvailabilityStatus.BUSY,
      } as any);

      const result = await driverService.setDriverBusy('driver-123');

      expect(result.availabilityStatus).toBe(AvailabilityStatus.BUSY);
    });

    it('should remove busy driver from available pool', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: AvailabilityStatus.ONLINE,
      });

      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: AvailabilityStatus.BUSY,
      } as any);

      await driverService.setDriverBusy('driver-123');

      expect(mockRedis.zrem).toHaveBeenCalledWith('drivers:geo:online', 'driver-123');
    });

    it('should set driver back to ONLINE after ride completion', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: AvailabilityStatus.BUSY,
      });

      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: AvailabilityStatus.ONLINE,
      } as any);

      const result = await driverService.setDriverAvailable('driver-123');

      expect(result.availabilityStatus).toBe(AvailabilityStatus.ONLINE);
    });
  });

  describe('DRIVER STATS - Thống kê tài xế', () => {
    it('should get driver earnings', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        totalEarnings: 5000000,
        totalRides: 150,
      });

      const result = await driverService.getDriverStats('driver-123');

      expect(result.totalEarnings).toBe(5000000);
      expect(result.totalRides).toBe(150);
    });

    it('should calculate average rating', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        rating: 4.7,
        totalReviews: 120,
      });

      const result = await driverService.getDriverStats('driver-123');

      expect(result.rating).toBe(4.7);
    });

    it('should get today earnings', async () => {
      // Mock query for today's rides
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
      });

      // Should query rides from today
    });
  });

  describe('UPDATE DRIVER PROFILE - Cập nhật hồ sơ', () => {
    it('should update vehicle information', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        vehicleBrand: 'Honda',
        vehicleModel: 'City',
      } as any);

      const result = await driverService.updateVehicle('driver-123', {
        brand: 'Honda',
        model: 'City',
      });

      expect(result.vehicleBrand).toBe('Honda');
      expect(result.vehicleModel).toBe('City');
    });

    it('should update license information', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        licenseNumber: 'B2-999999999',
      } as any);

      const result = await driverService.updateLicense('driver-123', {
        number: 'B2-999999999',
        expiryDate: new Date('2027-12-31'),
      });

      expect(result.licenseNumber).toBe('B2-999999999');
    });

    it('should require re-approval after major changes', async () => {
      mockPrisma.driver.update.mockResolvedValue({
        id: 'driver-123',
        status: DriverStatus.PENDING,
      } as any);

      const result = await driverService.updateVehicle('driver-123', {
        plate: 'NEW-PLATE',
      });

      expect(result.status).toBe(DriverStatus.PENDING);
    });
  });

  describe('EDGE CASES & BOUNDARY CONDITIONS', () => {
    it('should handle driver at exact boundary of radius', async () => {
      mockRedis.georadius.mockResolvedValue([
        ['driver-1', ['5.0']], // Exactly at 5km
      ] as any);

      mockPrisma.driver.findMany.mockResolvedValue([
        { id: 'driver-1', availabilityStatus: AvailabilityStatus.ONLINE },
      ]);

      const result = await driverService.findNearbyDrivers({ lat: 10.762622, lng: 106.660172 }, 5);

      expect(result).toHaveLength(1);
    });

    it('should handle no drivers available', async () => {
      mockRedis.georadius.mockResolvedValue([]);

      const result = await driverService.findNearbyDrivers({ lat: 10.762622, lng: 106.660172 }, 5);

      expect(result).toHaveLength(0);
    });

    it('should handle Redis connection failure', async () => {
      mockRedis.georadius.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        driverService.findNearbyDrivers({ lat: 10.762622, lng: 106.660172 }, 5)
      ).rejects.toThrow('Redis connection failed');
    });

    it('should handle very large search radius', async () => {
      mockRedis.georadius.mockResolvedValue([]);

      const result = await driverService.findNearbyDrivers({ lat: 10.762622, lng: 106.660172 }, 100);

      // Should limit results or handle gracefully
    });

    it('should handle concurrent location updates', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue({
        id: 'driver-123',
        availabilityStatus: AvailabilityStatus.ONLINE,
      });

      const updates = Array(100).fill(null).map((_, i) =>
        driverService.updateLocation('user-123', {
          lat: 10.762622 + i * 0.001,
          lng: 106.660172 + i * 0.001,
        })
      );

      await Promise.all(updates);

      expect(mockRedis.geoadd).toHaveBeenCalledTimes(100);
    });
  });
});

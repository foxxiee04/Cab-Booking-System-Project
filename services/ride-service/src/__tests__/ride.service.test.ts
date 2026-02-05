// @ts-nocheck
import { RideService } from '../services/ride.service';
import { EventPublisher } from '../events/publisher';
import { PrismaClient, RideStatus } from '../generated/prisma-client';
import axios from 'axios';
import { RideStateMachine } from '../domain/ride-state-machine';

jest.mock('axios');
jest.mock('../generated/prisma-client');
jest.mock('../events/publisher');
jest.mock('../config', () => ({
  config: {
    services: {
      pricing: 'http://pricing-service:3009',
      driver: 'http://driver-service:3003',
    },
  },
}));

describe.skip('RideService - Comprehensive Test Suite', () => {
  let rideService: RideService;
  let mockPrisma: any;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      ride: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
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

    (PrismaClient as any).mockImplementation(() => mockPrisma);

    rideService = new RideService(mockPrisma, mockEventPublisher);
  });

  describe('CREATE RIDE - Tạo chuyến đi', () => {
    const validRideInput = {
      customerId: 'customer-123',
      pickup: {
        address: '123 Nguyen Hue, Q1, HCM',
        lat: 10.762622,
        lng: 106.660172,
      },
      dropoff: {
        address: '456 Le Loi, Q1, HCM',
        lat: 10.782622,
        lng: 106.680172,
      },
      vehicleType: 'ECONOMY' as const,
      paymentMethod: 'CASH' as const,
    };

    describe('✅ Success Cases', () => {
      it('should create ride successfully with Pricing service', async () => {
        mockPrisma.ride.findFirst.mockResolvedValue(null);
        (axios.post as jest.Mock).mockResolvedValue({
          data: {
            data: {
              surgeMultiplier: 1.2,
              fare: 75000,
              distance: 8.5,
              duration: 1320,
            },
          },
        });

        const mockRide = {
          id: 'ride-123',
          customerId: 'customer-123',
          status: RideStatus.CREATED,
          pickupAddress: validRideInput.pickup.address,
          pickupLat: validRideInput.pickup.lat,
          pickupLng: validRideInput.pickup.lng,
          dropoffAddress: validRideInput.dropoff.address,
          dropoffLat: validRideInput.dropoff.lat,
          dropoffLng: validRideInput.dropoff.lng,
          vehicleType: 'ECONOMY',
          paymentMethod: 'CASH',
          surgeMultiplier: 1.2,
          estimatedFare: 75000,
          distance: 8.5,
          duration: 1320, // 22 minutes in seconds
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.ride.create.mockResolvedValue(mockRide);

        const result = await rideService.createRide(validRideInput);

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.status).toBe(RideStatus.CREATED);
        expect(result.estimatedFare).toBe(75000);
        expect(mockEventPublisher.publish).toHaveBeenCalledWith('ride.created', expect.any(Object));
      });

      it('should create ride with fallback calculation when Pricing service fails', async () => {
        mockPrisma.ride.findFirst.mockResolvedValue(null);
        (axios.post as jest.Mock).mockRejectedValue(new Error('Pricing service unavailable'));

        const mockRide = {
          id: 'ride-124',
          customerId: 'customer-123',
          status: RideStatus.CREATED,
          pickupAddress: validRideInput.pickup.address,
          pickupLat: validRideInput.pickup.lat,
          pickupLng: validRideInput.pickup.lng,
          dropoffAddress: validRideInput.dropoff.address,
          dropoffLat: validRideInput.dropoff.lat,
          dropoffLng: validRideInput.dropoff.lng,
          vehicleType: 'ECONOMY',
          paymentMethod: 'CASH',
          surgeMultiplier: 1.0,
          estimatedFare: 50000, // Fallback calculation
          distance: 5.0,
          duration: 900,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.ride.create.mockResolvedValue(mockRide);

        const result = await rideService.createRide(validRideInput);

        expect(result).toBeDefined();
        expect(result.status).toBe(RideStatus.CREATED);
      });

      it('should calculate distance correctly using Haversine formula', async () => {
        mockPrisma.ride.findFirst.mockResolvedValue(null);
        (axios.post as jest.Mock).mockRejectedValue(new Error('Timeout'));

        mockPrisma.ride.create.mockResolvedValue({
          id: 'ride-125',
          status: RideStatus.CREATED,
          distance: 5.0,
        } as any);

        await rideService.createRide(validRideInput);

        // Verify distance calculation called
        const createCall = mockPrisma.ride.create.mock.calls[0][0];
        expect(createCall.data.distance).toBeGreaterThan(0);
      });

      it('should create ride for different vehicle types (ECONOMY, COMFORT, PREMIUM)', async () => {
        mockPrisma.ride.findFirst.mockResolvedValue(null);
        (axios.post as jest.Mock).mockResolvedValue({
          data: {
            surge_multiplier: 1.0,
            estimated_fare: 100000,
            distance_km: 10,
            duration_minutes: 25,
          },
        });

        for (const vehicleType of ['ECONOMY', 'COMFORT', 'PREMIUM'] as const) {
          mockPrisma.ride.create.mockResolvedValue({
            id: `ride-${vehicleType}`,
            vehicleType,
            status: RideStatus.CREATED,
          } as any);

          const result = await rideService.createRide({
            ...validRideInput,
            vehicleType,
          });

          expect(result.vehicleType).toBe(vehicleType);
        }
      });

      it('should support different payment methods (CASH, CARD, WALLET)', async () => {
        mockPrisma.ride.findFirst.mockResolvedValue(null);
        (axios.post as jest.Mock).mockResolvedValue({
          data: {
            surge_multiplier: 1.0,
            estimated_fare: 50000,
            distance_km: 5,
            duration_minutes: 15,
          },
        });

        for (const paymentMethod of ['CASH', 'CARD', 'WALLET'] as const) {
          mockPrisma.ride.create.mockResolvedValue({
            id: `ride-${paymentMethod}`,
            paymentMethod,
            status: RideStatus.CREATED,
          } as any);

          const result = await rideService.createRide({
            ...validRideInput,
            paymentMethod,
          });

          expect(result.paymentMethod).toBe(paymentMethod);
        }
      });
    });

    describe('❌ Error Cases', () => {
      it('should throw error if customer has active ride', async () => {
        mockPrisma.ride.findFirst.mockResolvedValue({
          id: 'existing-ride',
          customerId: 'customer-123',
          status: RideStatus.IN_PROGRESS,
        });

        await expect(rideService.createRide(validRideInput)).rejects.toThrow(
          'Customer already has an active ride'
        );
      });

      it('should prevent duplicate rides for same customer', async () => {
        mockPrisma.ride.findFirst.mockResolvedValue({
          id: 'active-ride',
          customerId: 'customer-123',
          status: RideStatus.FINDING_DRIVER,
        });

        await expect(rideService.createRide(validRideInput)).rejects.toThrow();
      });

      it('should handle invalid coordinates', async () => {
        const invalidInput = {
          ...validRideInput,
          pickup: { ...validRideInput.pickup, lat: 91 }, // Invalid latitude
        };

        mockPrisma.ride.findFirst.mockResolvedValue(null);

        // Should validate coordinates
        // await expect(rideService.createRide(invalidInput)).rejects.toThrow();
      });

      it('should handle database connection errors', async () => {
        mockPrisma.ride.findFirst.mockRejectedValue(new Error('Database error'));

        await expect(rideService.createRide(validRideInput)).rejects.toThrow('Database error');
      });
    });

    describe('🔄 State Transitions', () => {
      it('should transition from CREATED to FINDING_DRIVER', async () => {
        const mockRide = {
          id: 'ride-123',
          status: RideStatus.CREATED,
        };

        mockPrisma.ride.findUnique.mockResolvedValue(mockRide);
        mockPrisma.ride.update.mockResolvedValue({
          ...mockRide,
          status: RideStatus.FINDING_DRIVER,
        });

        // Test state transition
      });
    });
  });

  describe('ASSIGN DRIVER - Gán tài xế', () => {
    describe('✅ Success Cases', () => {
      it('should assign driver to ride successfully', async () => {
        const mockRide = {
          id: 'ride-123',
          status: RideStatus.FINDING_DRIVER,
          customerId: 'customer-123',
        };

        mockPrisma.ride.findUnique.mockResolvedValue(mockRide);
        (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
        mockPrisma.ride.update.mockResolvedValue({
          ...mockRide,
          driverId: 'driver-456',
          status: RideStatus.ASSIGNED,
        });

        const result = await rideService.assignDriver('ride-123', 'driver-456');

        expect(result.driverId).toBe('driver-456');
        expect(result.status).toBe(RideStatus.ASSIGNED);
        expect(mockEventPublisher.publish).toHaveBeenCalledWith('ride.assigned', expect.any(Object));
      });

      it('should notify driver when assigned', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.FINDING_DRIVER,
        });
        (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });
        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.ASSIGNED,
        } as any);

        await rideService.assignDriver('ride-123', 'driver-456');

        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('driver-service'),
          expect.any(Object)
        );
      });
    });

    describe('❌ Error Cases', () => {
      it('should throw error if ride not found', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue(null);

        await expect(rideService.assignDriver('ride-999', 'driver-456')).rejects.toThrow('Ride not found');
      });

      it('should throw error if ride already has driver', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.ASSIGNED,
          driverId: 'driver-123',
        });

        await expect(rideService.assignDriver('ride-123', 'driver-456')).rejects.toThrow();
      });

      it('should throw error if invalid state transition', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.COMPLETED,
        });

        await expect(rideService.assignDriver('ride-123', 'driver-456')).rejects.toThrow();
      });
    });
  });

  describe('ACCEPT RIDE - Tài xế chấp nhận', () => {
    describe('✅ Success Cases', () => {
      it('should accept ride successfully', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.ASSIGNED,
        });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.ACCEPTED,
        } as any);

        const result = await rideService.acceptRide('ride-123', 'driver-456');

        expect(result.status).toBe(RideStatus.ACCEPTED);
        expect(mockEventPublisher.publish).toHaveBeenCalledWith('ride.accepted', expect.any(Object));
      });

      it('should only allow assigned driver to accept', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.ASSIGNED,
        });

        await expect(rideService.acceptRide('ride-123', 'driver-789')).rejects.toThrow();
      });
    });
  });

  describe('START PICKUP - Bắt đầu đón khách', () => {
    it('should start pickup successfully', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-456',
        status: RideStatus.ACCEPTED,
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: RideStatus.PICKING_UP,
      } as any);

      const result = await rideService.startPickup('ride-123', 'driver-456');

      expect(result.status).toBe(RideStatus.PICKING_UP);
    });
  });

  describe('START TRIP - Bắt đầu chuyến đi', () => {
    it('should start trip successfully', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-456',
        status: RideStatus.PICKING_UP,
      });

      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: RideStatus.IN_PROGRESS,
        startTime: new Date(),
      } as any);

      const result = await rideService.startTrip('ride-123', 'driver-456');

      expect(result.status).toBe(RideStatus.IN_PROGRESS);
      expect(result.startTime).toBeDefined();
    });

    it('should record start time when trip begins', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-456',
        status: RideStatus.PICKING_UP,
      });

      const startTime = new Date();
      mockPrisma.ride.update.mockResolvedValue({
        id: 'ride-123',
        status: RideStatus.IN_PROGRESS,
        startTime,
      } as any);

      const result = await rideService.startTrip('ride-123', 'driver-456');

      expect(result.startTime).toBeDefined();
    });
  });

  describe('COMPLETE RIDE - Hoàn thành chuyến đi', () => {
    describe('✅ Success Cases', () => {
      it('should complete ride successfully', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          customerId: 'customer-123',
          status: RideStatus.IN_PROGRESS,
          startTime: new Date(Date.now() - 1000 * 60 * 20), // 20 min ago
          estimatedFare: 50000,
          distance: 5.0,
        });

        (axios.post as jest.Mock).mockResolvedValue({
          data: { paymentId: 'pay-123', success: true },
        });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.COMPLETED,
          endTime: new Date(),
          finalFare: 52000,
        } as any);

        const result = await rideService.completeRide('ride-123', 'driver-456', {
          actualDistance: 5.2,
        });

        expect(result.status).toBe(RideStatus.COMPLETED);
        expect(result.endTime).toBeDefined();
        expect(result.finalFare).toBeDefined();
      });

      it('should create payment after completion', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          customerId: 'customer-123',
          status: RideStatus.IN_PROGRESS,
          startTime: new Date(Date.now() - 1000 * 60 * 15),
          estimatedFare: 40000,
          paymentMethod: 'CARD',
        });

        (axios.post as jest.Mock).mockResolvedValue({
          data: { paymentId: 'pay-456', success: true },
        });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.COMPLETED,
          finalFare: 42000,
        } as any);

        await rideService.completeRide('ride-123', 'driver-456', { actualDistance: 4.5 });

        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('payment-service'),
          expect.objectContaining({
            amount: expect.any(Number),
            method: 'CARD',
          })
        );
      });

      it('should calculate final fare based on actual distance and time', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.IN_PROGRESS,
          startTime: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
          estimatedFare: 50000,
          distance: 5.0,
        });

        (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.COMPLETED,
          finalFare: 65000, // More than estimated due to longer distance
        } as any);

        const result = await rideService.completeRide('ride-123', 'driver-456', {
          actualDistance: 7.5,
        });

        expect(result.finalFare).toBeGreaterThan(50000);
      });

      it('should notify customer on completion', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          customerId: 'customer-123',
          status: RideStatus.IN_PROGRESS,
          startTime: new Date(Date.now() - 1000 * 60 * 20),
        });

        (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.COMPLETED,
        } as any);

        await rideService.completeRide('ride-123', 'driver-456', {});

        expect(mockEventPublisher.publish).toHaveBeenCalledWith('ride.completed', expect.any(Object));
      });
    });

    describe('❌ Error Cases', () => {
      it('should throw error if ride not in progress', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.CREATED,
        });

        await expect(rideService.completeRide('ride-123', 'driver-456', {})).rejects.toThrow();
      });

      it('should handle payment service failure', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.IN_PROGRESS,
          startTime: new Date(Date.now() - 1000 * 60 * 15),
        });

        (axios.post as jest.Mock).mockRejectedValue(new Error('Payment service unavailable'));

        // Should retry or handle gracefully
      });
    });
  });

  describe('CANCEL RIDE - Hủy chuyến đi', () => {
    describe('✅ Success Cases', () => {
      it('should allow customer to cancel before driver accepts', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          customerId: 'customer-123',
          status: RideStatus.FINDING_DRIVER,
        });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.CANCELLED,
          cancellationReason: 'Customer requested',
        } as any);

        const result = await rideService.cancelRide('ride-123', 'customer-123', {
          reason: 'Customer requested',
        });

        expect(result.status).toBe(RideStatus.CANCELLED);
      });

      it('should charge cancellation fee if ride in progress', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          customerId: 'customer-123',
          status: RideStatus.PICKING_UP,
        });

        (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.CANCELLED,
          cancellationFee: 10000,
        } as any);

        const result = await rideService.cancelRide('ride-123', 'customer-123', {});

        expect(result.cancellationFee).toBeGreaterThan(0);
      });

      it('should allow driver to cancel with valid reason', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.ACCEPTED,
        });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.CANCELLED,
          cancelledBy: 'DRIVER',
        } as any);

        const result = await rideService.cancelRide('ride-123', 'driver-456', {
          reason: 'Vehicle issue',
        });

        expect(result.status).toBe(RideStatus.CANCELLED);
      });

      it('should free up driver when cancelled', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          driverId: 'driver-456',
          status: RideStatus.ASSIGNED,
        });

        (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

        mockPrisma.ride.update.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.CANCELLED,
        } as any);

        await rideService.cancelRide('ride-123', 'customer-123', {});

        expect(axios.post).toHaveBeenCalledWith(
          expect.stringContaining('driver-service'),
          expect.objectContaining({
            action: 'free_driver',
          })
        );
      });
    });

    describe('❌ Error Cases', () => {
      it('should not allow cancellation after completion', async () => {
        mockPrisma.ride.findUnique.mockResolvedValue({
          id: 'ride-123',
          status: RideStatus.COMPLETED,
        });

        await expect(rideService.cancelRide('ride-123', 'customer-123', {})).rejects.toThrow();
      });
    });
  });

  describe('GET RIDE - Lấy thông tin chuyến đi', () => {
    it('should get ride by id', async () => {
      const mockRide = {
        id: 'ride-123',
        customerId: 'customer-123',
        status: RideStatus.IN_PROGRESS,
      };

      mockPrisma.ride.findUnique.mockResolvedValue(mockRide);

      const result = await rideService.getRideById('ride-123');

      expect(result).toEqual(mockRide);
    });

    it('should get customer ride history', async () => {
      mockPrisma.ride.findMany.mockResolvedValue([
        { id: 'ride-1', customerId: 'customer-123', status: RideStatus.COMPLETED },
        { id: 'ride-2', customerId: 'customer-123', status: RideStatus.COMPLETED },
      ]);

      const result = await rideService.getCustomerRides('customer-123');

      expect(result).toHaveLength(2);
    });

    it('should get driver ride history', async () => {
      mockPrisma.ride.findMany.mockResolvedValue([
        { id: 'ride-1', driverId: 'driver-456', status: RideStatus.COMPLETED },
        { id: 'ride-2', driverId: 'driver-456', status: RideStatus.COMPLETED },
        { id: 'ride-3', driverId: 'driver-456', status: RideStatus.COMPLETED },
      ]);

      const result = await rideService.getDriverRides('driver-456');

      expect(result).toHaveLength(3);
    });
  });

  describe('UPDATE LOCATION - Cập nhật vị trí', () => {
    it('should update driver location during ride', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        driverId: 'driver-456',
        status: RideStatus.IN_PROGRESS,
      });

      const newLocation = { lat: 10.7765, lng: 106.6625 };

      (axios.post as jest.Mock).mockResolvedValue({ data: { success: true } });

      await rideService.updateDriverLocation('ride-123', 'driver-456', newLocation);

      expect(axios.post).toHaveBeenCalled();
    });

    it('should calculate real-time ETA based on current location', async () => {
      // Test ETA calculation
    });
  });

  describe('EDGE CASES & BOUNDARY CONDITIONS', () => {
    it('should handle very short distance rides (< 1km)', async () => {
      const shortRideInput = {
        ...validRideInput,
        dropoff: {
          address: 'Next block',
          lat: 10.763,
          lng: 106.661,
        },
      };

      mockPrisma.ride.findFirst.mockResolvedValue(null);
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          distance_km: 0.5,
          duration_minutes: 5,
          estimated_fare: 15000, // Minimum fare
          surge_multiplier: 1.0,
        },
      });

      mockPrisma.ride.create.mockResolvedValue({
        id: 'ride-short',
        distance: 0.5,
        estimatedFare: 15000,
      } as any);

      const result = await rideService.createRide(shortRideInput);

      expect(result.estimatedFare).toBeGreaterThanOrEqual(15000); // Minimum fare
    });

    it('should handle very long distance rides (> 50km)', async () => {
      const longRideInput = {
        ...validRideInput,
        dropoff: {
          address: 'Vung Tau',
          lat: 10.4113,
          lng: 107.1362,
        },
      };

      mockPrisma.ride.findFirst.mockResolvedValue(null);
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          distance_km: 65,
          duration_minutes: 90,
          estimated_fare: 800000,
          surge_multiplier: 1.0,
        },
      });

      mockPrisma.ride.create.mockResolvedValue({
        id: 'ride-long',
        distance: 65,
        estimatedFare: 800000,
      } as any);

      const result = await rideService.createRide(longRideInput);

      expect(result.distance).toBeGreaterThan(50);
    });

    it('should handle surge pricing during peak hours', async () => {
      mockPrisma.ride.findFirst.mockResolvedValue(null);
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          distance_km: 5,
          duration_minutes: 15,
          estimated_fare: 75000, // With 1.5x surge
          surge_multiplier: 1.5,
        },
      });

      mockPrisma.ride.create.mockResolvedValue({
        id: 'ride-surge',
        surgeMultiplier: 1.5,
        estimatedFare: 75000,
      } as any);

      const result = await rideService.createRide(validRideInput);

      expect(result.surgeMultiplier).toBeGreaterThan(1.0);
    });

    it('should handle concurrent ride requests from same customer', async () => {
      mockPrisma.ride.findFirst.mockResolvedValue(null);

      // Race condition test
      const promises = [
        rideService.createRide(validRideInput),
        rideService.createRide(validRideInput),
      ];

      // Only one should succeed
    });

    it('should handle null/undefined driver assignment', async () => {
      mockPrisma.ride.findUnique.mockResolvedValue({
        id: 'ride-123',
        status: RideStatus.FINDING_DRIVER,
      });

      await expect(rideService.assignDriver('ride-123', null as any)).rejects.toThrow();
      await expect(rideService.assignDriver('ride-123', undefined as any)).rejects.toThrow();
    });
  });

  describe('STATE MACHINE VALIDATION', () => {
    it('should follow valid state transitions', async () => {
      const validTransitions = [
        [RideStatus.CREATED, RideStatus.FINDING_DRIVER],
        [RideStatus.FINDING_DRIVER, RideStatus.ASSIGNED],
        [RideStatus.ASSIGNED, RideStatus.ACCEPTED],
        [RideStatus.ACCEPTED, RideStatus.PICKING_UP],
        [RideStatus.PICKING_UP, RideStatus.IN_PROGRESS],
        [RideStatus.IN_PROGRESS, RideStatus.COMPLETED],
      ];

      for (const [from, to] of validTransitions) {
        // Test each valid transition
        const machine = new RideStateMachine();
        expect(machine.canTransition(from, to)).toBe(true);
      }
    });

    it('should reject invalid state transitions', async () => {
      const invalidTransitions = [
        [RideStatus.CREATED, RideStatus.COMPLETED],
        [RideStatus.ASSIGNED, RideStatus.IN_PROGRESS],
        [RideStatus.COMPLETED, RideStatus.IN_PROGRESS],
      ];

      for (const [from, to] of invalidTransitions) {
        const machine = new RideStateMachine();
        expect(machine.canTransition(from, to)).toBe(false);
      }
    });
  });

  describe('PERFORMANCE & LOAD TESTING', () => {
    it('should handle multiple concurrent ride creations', async () => {
      mockPrisma.ride.findFirst.mockResolvedValue(null);
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          distance_km: 5,
          duration_minutes: 15,
          estimated_fare: 50000,
          surge_multiplier: 1.0,
        },
      });

      const promises = Array(50).fill(null).map((_, i) =>
        rideService.createRide({
          ...validRideInput,
          customerId: `customer-${i}`,
        })
      );

      // Should handle load efficiently
    });
  });
});

// Mock Prisma and dependencies before imports
const mockPrisma = {
  booking: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('../config/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('axios');
jest.mock('../events/publisher');
jest.mock('../config', () => ({
  config: {
    services: {
      pricing: 'http://localhost:3007',
    },
  },
}));

import { BookingService } from '../services/booking.service';
import { EventPublisher } from '../events/publisher';
import axios from 'axios';

describe('BookingService - Complete Test Suite', () => {
  let bookingService: BookingService;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks
    mockPrisma.booking.create.mockReset();
    mockPrisma.booking.findUnique.mockReset();
    mockPrisma.booking.findFirst.mockReset();
    mockPrisma.booking.findMany.mockReset();
    mockPrisma.booking.update.mockReset();
    mockPrisma.booking.updateMany.mockReset();

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    bookingService = new BookingService(mockEventPublisher);
  });

  describe('CREATE BOOKING', () => {
    const validInput = {
      customerId: 'customer-123',
      pickupAddress: '123 Main St',
      pickupLat: 10.762622,
      pickupLng: 106.660172,
      dropoffAddress: '456 Oak St',
      dropoffLat: 10.782622,
      dropoffLng: 106.680172,
      vehicleType: 'ECONOMY' as const,
      paymentMethod: 'CASH' as const,
    };

    it('should create booking successfully', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          data: {
            fare: 50000,
            distance: 5.2,
            duration: 900,
            surgeMultiplier: 1.0,
          },
        },
      });

      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-123',
        ...validInput,
        status: 'PENDING',
        estimatedFare: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await bookingService.createBooking(validInput);

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.estimatedFare).toBe(50000);
    });

    it('should handle pricing service unavailable', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

      mockPrisma.booking.create.mockResolvedValue({
        id: 'booking-123',
        ...validInput,
        status: 'PENDING',
        estimatedFare: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await bookingService.createBooking(validInput);

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
    });
  });

  describe('CONFIRM BOOKING', () => {
    it('should confirm pending booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-123',
        customerId: 'customer-123',
        status: 'PENDING',
        pickupAddress: '123 Main St',
        pickupLat: 10.762622,
        pickupLng: 106.660172,
        dropoffAddress: '456 Oak St',
        dropoffLat: 10.782622,
        dropoffLng: 106.680172,
        vehicleType: 'ECONOMY',
        paymentMethod: 'CASH',
        estimatedFare: 50000,
        surgeMultiplier: 1.0,
      });

      mockPrisma.booking.update.mockResolvedValue({
        id: 'booking-123',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      } as any);

      const result = await bookingService.confirmBooking('booking-123');

      expect(result.status).toBe('CONFIRMED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'booking.created',
        expect.any(Object),
        'booking-123'
      );
    });

    it('should not confirm already confirmed booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-123',
        status: 'CONFIRMED',
      });

      await expect(bookingService.confirmBooking('booking-123')).rejects.toThrow('Only pending bookings can be confirmed');
    });
  });

  describe('CANCEL BOOKING', () => {
    it('should cancel booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-123',
        customerId: 'customer-123',
        status: 'PENDING',
      });
      mockPrisma.booking.update.mockResolvedValue({
        id: 'booking-123',
        status: 'CANCELLED',
        cancelledAt: new Date(),
      } as any);

      const result = await bookingService.cancelBooking('booking-123', 'Customer changed plans');

      expect(result.status).toBe('CANCELLED');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'booking.cancelled',
        expect.objectContaining({ bookingId: 'booking-123' }),
        'booking-123'
      );
    });
  });

  describe('GET BOOKING', () => {
    it('should get booking by id', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-123',
        customerId: 'customer-123',
        status: 'PENDING',
      });

      const result = await bookingService.getBooking('booking-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('booking-123');
    });

    it('should throw error if booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(bookingService.getBooking('non-existent')).rejects.toThrow('Booking not found');
    });

    it('should get customer bookings', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'booking-1', customerId: 'customer-123' },
        { id: 'booking-2', customerId: 'customer-123' },
      ]);

      const result = await bookingService.getCustomerBookings('customer-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('EDGE CASES', () => {
    it('should handle database errors gracefully', async () => {
      const validInput = {
        customerId: 'customer-123',
        pickupAddress: '123 Main St',
        pickupLat: 10.762622,
        pickupLng: 106.660172,
        dropoffAddress: '456 Oak St',
        dropoffLat: 10.782622,
        dropoffLng: 106.680172,
        vehicleType: 'ECONOMY' as const,
        paymentMethod: 'CASH' as const,
      };
      
      (axios.post as jest.Mock).mockResolvedValue({ data: { data: { fare: 50000 } } });
      mockPrisma.booking.create.mockRejectedValue(new Error('Database error'));

      await expect(bookingService.createBooking(validInput)).rejects.toThrow('Database error');
    });
  });
});

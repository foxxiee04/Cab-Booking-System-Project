import { BookingStatus } from '../models/booking.model';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';
import { config } from '../config';
import { prisma } from '../config/db';
import { pricingGrpcClient } from '../grpc/pricing.client';

export class BookingService {
  private eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  async createBooking(data: {
    customerId: string;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    vehicleType: 'MOTORBIKE' | 'SCOOTER' | 'CAR_4' | 'CAR_7';
    paymentMethod: 'CASH' | 'CARD' | 'WALLET';
    notes?: string;
    customerPhone?: string;
  }) {
    try {
      // Call Pricing Service to get estimate
      logger.info('Requesting fare estimate from Pricing Service');
      
      let estimatedFare, estimatedDistance, estimatedDuration, surgeMultiplier;
      
      try {
        const estimate = await pricingGrpcClient.estimateFare({
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          dropoffLat: data.dropoffLat,
          dropoffLng: data.dropoffLng,
          vehicleType: data.vehicleType,
        });

        estimatedFare = estimate.fare;
        estimatedDistance = estimate.distance;
        estimatedDuration = estimate.duration;
        surgeMultiplier = estimate.surgeMultiplier || 1.0;
      } catch (pricingError) {
        logger.warn('Pricing service unavailable, creating booking without estimate', pricingError);
        surgeMultiplier = 1.0;
      }

      // Create booking
      const booking = await prisma.booking.create({
        data: {
          customerId: data.customerId,
          pickupAddress: data.pickupAddress,
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          dropoffAddress: data.dropoffAddress,
          dropoffLat: data.dropoffLat,
          dropoffLng: data.dropoffLng,
          vehicleType: data.vehicleType,
          paymentMethod: data.paymentMethod,
          estimatedFare: estimatedFare ?? null,
          estimatedDistance: estimatedDistance ?? null,
          estimatedDuration: estimatedDuration ?? null,
          surgeMultiplier,
          notes: data.notes ?? null,
          customerPhone: data.customerPhone ?? null,
          status: BookingStatus.PENDING,
        },
      });

      logger.info('Booking created', { bookingId: booking.id });

      return booking;
    } catch (error) {
      logger.error('Failed to create booking:', error);
      throw error;
    }
  }

  async confirmBooking(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new Error('Only pending bookings can be confirmed');
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    // Emit BookingCreated event for Ride Service to consume
    await this.eventPublisher.publish('booking.created', {
      bookingId: updatedBooking.id,
      customerId: updatedBooking.customerId,
      pickupAddress: updatedBooking.pickupAddress,
      pickupLat: updatedBooking.pickupLat,
      pickupLng: updatedBooking.pickupLng,
      dropoffAddress: updatedBooking.dropoffAddress,
      dropoffLat: updatedBooking.dropoffLat,
      dropoffLng: updatedBooking.dropoffLng,
      vehicleType: updatedBooking.vehicleType,
      paymentMethod: updatedBooking.paymentMethod,
      estimatedFare: updatedBooking.estimatedFare,
      estimatedDistance: updatedBooking.estimatedDistance,
      estimatedDuration: updatedBooking.estimatedDuration,
      surgeMultiplier: updatedBooking.surgeMultiplier,
    }, bookingId);

    logger.info('Booking confirmed and event published', { bookingId });

    return updatedBooking;
  }

  async cancelBooking(bookingId: string, reason?: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await this.eventPublisher.publish('booking.cancelled', {
      bookingId: updatedBooking.id,
      customerId: updatedBooking.customerId,
      reason,
    }, bookingId);

    return updatedBooking;
  }

  async getBooking(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    return booking;
  }

  async getCustomerBookings(customerId: string) {
    return prisma.booking.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

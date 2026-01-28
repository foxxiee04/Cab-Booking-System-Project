import { Router } from 'express';
import { BookingService } from '../services/booking.service';
import { logger } from '../utils/logger';

export function createBookingRouter(bookingService: BookingService): Router {
  const router = Router();

  // Create booking
  router.post('/', async (req, res) => {
    try {
      const booking = await bookingService.createBooking(req.body);
      res.status(201).json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Create booking error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'BOOKING_FAILED', message: error.message },
      });
    }
  });

  // Confirm booking
  router.post('/:bookingId/confirm', async (req, res) => {
    try {
      const booking = await bookingService.confirmBooking(req.params.bookingId);
      res.json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Confirm booking error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'CONFIRM_FAILED', message: error.message },
      });
    }
  });

  // Cancel booking
  router.post('/:bookingId/cancel', async (req, res) => {
    try {
      const booking = await bookingService.cancelBooking(req.params.bookingId, req.body.reason);
      res.json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Cancel booking error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'CANCEL_FAILED', message: error.message },
      });
    }
  });

  // Get booking details
  router.get('/:bookingId', async (req, res) => {
    try {
      const booking = await bookingService.getBooking(req.params.bookingId);
      res.json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Get booking error:', error);
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: error.message },
      });
    }
  });

  // Get customer bookings
  router.get('/customer/:customerId', async (req, res) => {
    try {
      const bookings = await bookingService.getCustomerBookings(req.params.customerId);
      res.json({ success: true, data: { bookings } });
    } catch (error: any) {
      logger.error('Get customer bookings error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  });

  return router;
}

import { Router } from 'express';
import { BookingService } from '../services/booking.service';
import { BookingController } from '../controllers/booking.controller';
import { validateCreateBooking, validateCancelBooking } from '../validators/booking.validator';

export function createBookingRouter(bookingService: BookingService): Router {
  const router = Router();
  const controller = new BookingController(bookingService);

  // Create booking
  router.post('/', validateCreateBooking, controller.createBooking);

  // Confirm booking
  router.post('/:bookingId/confirm', controller.confirmBooking);

  // Cancel booking
  router.post('/:bookingId/cancel', validateCancelBooking, controller.cancelBooking);

  // Get booking details
  router.get('/:bookingId', controller.getBooking);

  // Get customer bookings
  router.get('/customer/:customerId', controller.getCustomerBookings);

  return router;
}

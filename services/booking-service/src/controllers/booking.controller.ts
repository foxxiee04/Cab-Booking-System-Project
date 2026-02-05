import { Request, Response } from 'express';
import { BookingService } from '../services/booking.service';
import { logger } from '../utils/logger';

export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  createBooking = async (req: Request, res: Response) => {
    try {
      const booking = await this.bookingService.createBooking(req.body);
      res.status(201).json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Create booking error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'BOOKING_FAILED', message: error.message },
      });
    }
  };

  confirmBooking = async (req: Request, res: Response) => {
    try {
      const booking = await this.bookingService.confirmBooking(req.params.bookingId);
      res.json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Confirm booking error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'CONFIRM_FAILED', message: error.message },
      });
    }
  };

  cancelBooking = async (req: Request, res: Response) => {
    try {
      const booking = await this.bookingService.cancelBooking(
        req.params.bookingId, 
        req.body.reason
      );
      res.json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Cancel booking error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'CANCEL_FAILED', message: error.message },
      });
    }
  };

  getBooking = async (req: Request, res: Response) => {
    try {
      const booking = await this.bookingService.getBooking(req.params.bookingId);
      res.json({ success: true, data: { booking } });
    } catch (error: any) {
      logger.error('Get booking error:', error);
      res.status(404).json({
        success: false,
        error: { code: 'BOOKING_NOT_FOUND', message: error.message },
      });
    }
  };

  getCustomerBookings = async (req: Request, res: Response) => {
    try {
      const bookings = await this.bookingService.getCustomerBookings(req.params.customerId);
      res.json({ success: true, data: { bookings } });
    } catch (error: any) {
      logger.error('Get customer bookings error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'FETCH_FAILED', message: error.message },
      });
    }
  };
}

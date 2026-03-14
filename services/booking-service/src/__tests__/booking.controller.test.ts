import { Request, Response } from 'express';
import { BookingController } from '../controllers/booking.controller';

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('BookingController', () => {
  const bookingService = {
    createBooking: jest.fn(),
    confirmBooking: jest.fn(),
    cancelBooking: jest.fn(),
    getBooking: jest.fn(),
    getCustomerBookings: jest.fn(),
  } as any;

  let controller: BookingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BookingController(bookingService);
  });

  it('createBooking should return 401 when x-user-id header is missing', async () => {
    const req = mockReq();
    const res = mockRes();

    await controller.createBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(bookingService.createBooking).not.toHaveBeenCalled();
  });

  it('createBooking should transform nested pickup/dropoff location into flat fields', async () => {
    bookingService.createBooking.mockResolvedValue({ id: 'booking-1' });
    const req = mockReq({
      headers: { 'x-user-id': 'customer-1' },
      body: {
        pickupLocation: {
          address: 'Pickup A',
          geoPoint: { lat: 10.1, lng: 106.1 },
        },
        dropoffLocation: {
          address: 'Dropoff B',
          geoPoint: { lat: 10.2, lng: 106.2 },
        },
        vehicleType: 'ECONOMY',
        paymentMethod: 'CASH',
      },
    });
    const res = mockRes();

    await controller.createBooking(req, res);

    expect(bookingService.createBooking).toHaveBeenCalledWith({
      customerId: 'customer-1',
      pickupAddress: 'Pickup A',
      pickupLat: 10.1,
      pickupLng: 106.1,
      dropoffAddress: 'Dropoff B',
      dropoffLat: 10.2,
      dropoffLng: 106.2,
      vehicleType: 'ECONOMY',
      paymentMethod: 'CASH',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('confirmBooking should return booking in success payload', async () => {
    bookingService.confirmBooking.mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' });
    const req = mockReq({ params: { bookingId: 'booking-1' } });
    const res = mockRes();

    await controller.confirmBooking(req, res);

    expect(bookingService.confirmBooking).toHaveBeenCalledWith('booking-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { booking: { id: 'booking-1', status: 'CONFIRMED' } } });
  });

  it('cancelBooking should forward reason to service', async () => {
    bookingService.cancelBooking.mockResolvedValue({ id: 'booking-1', status: 'CANCELLED' });
    const req = mockReq({ params: { bookingId: 'booking-1' }, body: { reason: 'Changed plan' } });
    const res = mockRes();

    await controller.cancelBooking(req, res);

    expect(bookingService.cancelBooking).toHaveBeenCalledWith('booking-1', 'Changed plan');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { booking: { id: 'booking-1', status: 'CANCELLED' } } });
  });

  it('getBooking should return 404 on service error', async () => {
    bookingService.getBooking.mockRejectedValue(new Error('Booking not found'));
    const req = mockReq({ params: { bookingId: 'missing' } });
    const res = mockRes();

    await controller.getBooking(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' },
    });
  });

  it('getCustomerBookings should return 400 on service error', async () => {
    bookingService.getCustomerBookings.mockRejectedValue(new Error('Fetch failed'));
    const req = mockReq({ params: { customerId: 'customer-1' } });
    const res = mockRes();

    await controller.getCustomerBookings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

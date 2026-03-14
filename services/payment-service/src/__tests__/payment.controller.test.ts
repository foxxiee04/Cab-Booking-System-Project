import { Response, NextFunction } from 'express';
import { PaymentController } from '../controllers/payment.controller';

function mockReq(overrides: Record<string, any> = {}) {
  const headers = overrides.headers || {};
  return {
    body: {},
    params: {},
    query: {},
    headers,
    user: { userId: 'customer-1', role: 'CUSTOMER' },
    header: jest.fn((name: string) => headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]),
    ...overrides,
  } as any;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('PaymentController', () => {
  const paymentService = {
    createPaymentIntent: jest.fn(),
    handleMockWebhook: jest.fn(),
    getPaymentByRideId: jest.fn(),
    getCustomerPayments: jest.fn(),
    getDriverEarnings: jest.fn(),
    refundPayment: jest.fn(),
    getAllPayments: jest.fn(),
    getAdminStats: jest.fn(),
  } as any;

  let controller: PaymentController;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PaymentController(paymentService);
    next = jest.fn();
  });

  it('createPaymentIntent should pass idempotency header and return 201 when created', async () => {
    paymentService.createPaymentIntent.mockResolvedValue({ created: true, paymentIntentId: 'pi_123' });
    const req = mockReq({
      headers: { 'Idempotency-Key': 'idem-1' },
      body: { rideId: 'ride-1', amount: 50000, currency: 'VND', paymentMethod: 'CARD' },
    });
    const res = mockRes();

    await controller.createPaymentIntent(req, res, next);

    expect(paymentService.createPaymentIntent).toHaveBeenCalledWith({
      rideId: 'ride-1',
      customerId: 'customer-1',
      amount: 50000,
      currency: 'VND',
      paymentMethod: 'CARD',
      idempotencyKey: 'idem-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('getPaymentByRideId should return 404 when payment is missing', async () => {
    paymentService.getPaymentByRideId.mockResolvedValue(null);
    const req = mockReq({ params: { rideId: 'ride-404' } });
    const res = mockRes();

    await controller.getPaymentByRideId(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Payment not found' },
    });
  });

  it('refundPayment should block non-admin user', async () => {
    const req = mockReq({ user: { userId: 'customer-1', role: 'CUSTOMER' }, params: { rideId: 'ride-1' } });
    const res = mockRes();

    await controller.refundPayment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(paymentService.refundPayment).not.toHaveBeenCalled();
  });

  it('refundPayment should call service with default reason for admin', async () => {
    paymentService.refundPayment.mockResolvedValue(undefined);
    const req = mockReq({ user: { userId: 'admin-1', role: 'ADMIN' }, params: { rideId: 'ride-1' }, body: {} });
    const res = mockRes();

    await controller.refundPayment(req, res, next);

    expect(paymentService.refundPayment).toHaveBeenCalledWith('ride-1', 'Admin refund');
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Refund processed' });
  });

  it('getAllPayments should normalize status filter for admin', async () => {
    paymentService.getAllPayments.mockResolvedValue({ items: [], total: 0 });
    const req = mockReq({
      user: { userId: 'admin-1', role: 'ADMIN' },
      query: { page: '2', limit: '5', status: 'completed' },
    });
    const res = mockRes();

    await controller.getAllPayments(req, res, next);

    expect(paymentService.getAllPayments).toHaveBeenCalledWith(2, 5, 'COMPLETED');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { items: [], total: 0 } });
  });

  it('getAllPayments should block non-admin user', async () => {
    const req = mockReq({ user: { userId: 'customer-1', role: 'CUSTOMER' } });
    const res = mockRes();

    await controller.getAllPayments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('getPaymentMethods should return static enabled methods', async () => {
    const req = mockReq();
    const res = mockRes();

    await controller.getPaymentMethods(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        methods: [
          { id: 'CASH', name: 'Tiền mặt', icon: 'cash', enabled: true },
          { id: 'CARD', name: 'Thẻ tín dụng/ghi nợ', icon: 'card', enabled: true },
          { id: 'WALLET', name: 'Ví điện tử', icon: 'wallet', enabled: true },
        ],
      },
    });
  });
});
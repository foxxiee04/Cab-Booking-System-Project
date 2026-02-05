jest.mock('http-proxy-middleware', () => {
  return {
    createProxyMiddleware: jest.fn(() => {
      // express middleware stub
      return (req: any, res: any, next: any) => next();
    }),
  };
});

describe('proxy router wiring', () => {
  beforeEach(() => {
    jest.resetModules();

    process.env.AUTH_SERVICE_URL = 'http://auth:3001';
    process.env.RIDE_SERVICE_URL = 'http://ride:3002';
    process.env.DRIVER_SERVICE_URL = 'http://driver:3003';
    process.env.PAYMENT_SERVICE_URL = 'http://payment:3004';
    process.env.BOOKING_SERVICE_URL = 'http://booking:3008';
    process.env.PRICING_SERVICE_URL = 'http://pricing:3009';
    process.env.USER_SERVICE_URL = 'http://user:3007';
    process.env.REVIEW_SERVICE_URL = 'http://review:3010';
    process.env.NOTIFICATION_SERVICE_URL = 'http://notification:3005';
  });

  it('creates proxy middlewares with correct targets', () => {
    require('../../routes/proxy');

    const { createProxyMiddleware } = require('http-proxy-middleware');

    // expected proxies: auth, rides, drivers, payments, bookings, pricing, users, reviews, socket.io
    expect(createProxyMiddleware).toHaveBeenCalledTimes(9);

    const calls = createProxyMiddleware.mock.calls.map((c: any[]) => c[0]);
    const targets = calls.map((o: any) => o.target);

    expect(targets).toEqual(
      expect.arrayContaining([
        'http://auth:3001',
        'http://ride:3002',
        'http://driver:3003',
        'http://payment:3004',
        'http://booking:3008',
        'http://pricing:3009',
        'http://user:3007',
        'http://review:3010',
        'http://notification:3005',
      ])
    );
  });
});

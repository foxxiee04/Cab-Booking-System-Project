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
    process.env.NOTIFICATION_SERVICE_URL = 'http://notification:3005';
    process.env.AI_SERVICE_URL = 'http://ai:3006';
  });

  it('creates proxy middlewares with correct targets', () => {
    require('../../routes/proxy');

    const { createProxyMiddleware } = require('http-proxy-middleware');

    // expected proxies: auth, rides, drivers, payments, ai, socket.io
    expect(createProxyMiddleware).toHaveBeenCalledTimes(6);

    const calls = createProxyMiddleware.mock.calls.map((c: any[]) => c[0]);
    const targets = calls.map((o: any) => o.target);

    expect(targets).toEqual(
      expect.arrayContaining([
        'http://auth:3001',
        'http://ride:3002',
        'http://driver:3003',
        'http://payment:3004',
        'http://ai:3006',
        'http://notification:3005',
      ])
    );

    const aiOptions = calls.find((o: any) => o.target === 'http://ai:3006');
    expect(aiOptions).toEqual(
      expect.objectContaining({
        changeOrigin: true,
        pathRewrite: expect.objectContaining({ '^/api/ai': '/api' }),
      })
    );

    const wsOptions = calls.find((o: any) => o.target === 'http://notification:3005');
    expect(wsOptions).toEqual(
      expect.objectContaining({
        changeOrigin: true,
        ws: true,
      })
    );
  });
});

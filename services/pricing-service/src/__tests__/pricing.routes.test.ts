import { createPricingRouter } from '../routes/pricing.routes';

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function getRouteHandler(router: any, method: 'get' | 'post', path: string) {
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  return layer.route.stack[0].handle;
}

describe('Pricing routes', () => {
  const pricingService = {
    estimateFare: jest.fn(),
    getCurrentSurgeMultiplier: jest.fn(),
    setSurgeMultiplier: jest.fn(),
    calculateDynamicSurge: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /estimate should return 400 when coordinates are missing', async () => {
    const router = createPricingRouter(pricingService);
    const handler = getRouteHandler(router, 'post', '/estimate');
    const req: any = { body: { pickupLat: 10.1 } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('POST /estimate should use ECONOMY as default vehicle type', async () => {
    pricingService.estimateFare.mockResolvedValue({ fare: 10000 });
    const router = createPricingRouter(pricingService);
    const handler = getRouteHandler(router, 'post', '/estimate');
    const req: any = { body: { pickupLat: 10.1, pickupLng: 106.1, dropoffLat: 10.2, dropoffLng: 106.2 } };
    const res = mockRes();

    await handler(req, res);

    expect(pricingService.estimateFare).toHaveBeenCalledWith({
      pickupLat: 10.1,
      pickupLng: 106.1,
      dropoffLat: 10.2,
      dropoffLng: 106.2,
      vehicleType: 'ECONOMY',
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { fare: 10000 } });
  });

  it('GET /surge should return 500 on service error', async () => {
    pricingService.getCurrentSurgeMultiplier.mockRejectedValue(new Error('redis down'));
    const router = createPricingRouter(pricingService);
    const handler = getRouteHandler(router, 'get', '/surge');
    const req: any = {};
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('POST /surge should return 400 on invalid multiplier error', async () => {
    pricingService.setSurgeMultiplier.mockRejectedValue(new Error('invalid surge'));
    const router = createPricingRouter(pricingService);
    const handler = getRouteHandler(router, 'post', '/surge');
    const req: any = { body: { multiplier: 10 } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('POST /surge/calculate should fill defaults and return result', async () => {
    pricingService.calculateDynamicSurge.mockResolvedValue({ multiplier: 1.5, demandSupplyRatio: 2 });
    const router = createPricingRouter(pricingService);
    const handler = getRouteHandler(router, 'post', '/surge/calculate');
    const req: any = { body: {} };
    const res = mockRes();

    await handler(req, res);

    expect(pricingService.calculateDynamicSurge).toHaveBeenCalledWith(
      expect.objectContaining({ activeRides: 0, availableDrivers: 10 })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { multiplier: 1.5, demandSupplyRatio: 2 } });
  });
});

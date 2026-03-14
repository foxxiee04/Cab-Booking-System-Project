const mockRedisGet = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisOn = jest.fn();

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockRedisGet,
    setex: mockRedisSetex,
    on: mockRedisOn,
  }));
});

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function getRouteHandler(router: any, method: 'get', path: string) {
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  return layer.route.stack[0].handle;
}

describe('map routes', () => {
  let axios: any;
  let router: any;

  beforeEach(() => {
    jest.resetModules();
    axios = require('axios');
    router = require('../../routes/map').default;
    jest.clearAllMocks();
  });

  it('GET /geocode should return 400 when q is missing', async () => {
    const handler = getRouteHandler(router, 'get', '/geocode');
    const req: any = { query: {} };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('GET /geocode should map provider response to results', async () => {
    axios.get.mockResolvedValue({ data: [{ lat: '10.1', lon: '106.1', display_name: 'Ho Chi Minh City' }] });
    const handler = getRouteHandler(router, 'get', '/geocode');
    const req: any = { query: { q: 'hcm', limit: '3' } };
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { results: [{ lat: 10.1, lng: 106.1, address: 'Ho Chi Minh City' }] },
    });
  });

  it('GET /route should return 400 when coordinates are invalid', async () => {
    const handler = getRouteHandler(router, 'get', '/route');
    const req: any = { query: { fromLat: 'x' } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('GET /pois should return cached POIs when cache hits', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify([{ id: 'poi-1', name: 'Cafe', lat: 10.1, lng: 106.1, type: 'cafe' }]));
    const handler = getRouteHandler(router, 'get', '/pois');
    const req: any = { query: { lat: '10.1', lng: '106.1', types: 'cafe' } };
    const res = mockRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { pois: [{ id: 'poi-1', name: 'Cafe', lat: 10.1, lng: 106.1, type: 'cafe' }] },
    });
  });

  it('GET /pois should return 429 when Overpass is rate limited', async () => {
    mockRedisGet.mockResolvedValue(null);
    axios.post.mockRejectedValue({ response: { status: 429 } });
    const handler = getRouteHandler(router, 'get', '/pois');
    const req: any = { query: { lat: '10.1', lng: '106.1', types: 'cafe' } };
    const res = mockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'RATE_LIMIT', message: 'Map POI service is busy, try again later' },
    });
  });
});
jest.mock('../../middleware/auth', () => ({
  requireRole: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

function mockReq(overrides: any = {}) {
  const headers = overrides.headers || {};
  return {
    query: {},
    headers,
    header: jest.fn((name: string) => headers[name] || headers[name.toLowerCase()] || ''),
    ...overrides,
  };
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function getRouteHandler(router: any, method: 'get', path: string) {
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('admin routes', () => {
  let router: any;

  beforeEach(() => {
    jest.resetModules();
    router = require('../../routes/admin').default;
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('GET /drivers should merge driver data with auth users', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          data: {
            drivers: [{ id: 'driver-1', userId: 'user-1', availabilityStatus: 'ONLINE', vehicleBrand: 'Toyota', vehicleModel: 'Vios', vehicleColor: 'White', vehiclePlate: '51A', licenseNumber: 'GPLX', ratingAverage: 4.9, ratingCount: 20, lastLocationLat: 10.1, lastLocationLng: 106.1 }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          data: {
            users: [{ id: 'user-1', firstName: 'A', lastName: 'B', email: 'a@test.com', phone: '0909' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          data: {
            counts: {
              'driver-1': 3,
              'user-1': 1,
            },
          },
        }),
      });

    const req = mockReq({ query: { limit: '10', offset: '0' }, headers: { authorization: 'Bearer x', 'x-user-id': 'admin-1', 'x-user-role': 'ADMIN' } });
    const res = mockRes();
    const handler = getRouteHandler(router, 'get', '/drivers');

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        drivers: [expect.objectContaining({ id: 'driver-1', isOnline: true, totalRides: 4, user: expect.objectContaining({ id: 'user-1', email: 'a@test.com' }) })],
        total: 1,
      },
    });
  });

  it('GET /stats should aggregate ride, payment, driver and customer stats', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { stats: { total: 10, completed: 7, cancelled: 1, pending: 1, active: 1, today: 2 } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { revenue: { total: 100000 }, payments: { completed: 7, failed: 1, pending: 2 } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { drivers: [{ availabilityStatus: 'ONLINE' }, { availabilityStatus: 'BUSY' }, { availabilityStatus: 'OFFLINE' }] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { users: [{ role: 'CUSTOMER' }, { role: 'CUSTOMER' }, { role: 'ADMIN' }] } }),
      });

    const req = mockReq({ headers: { authorization: 'Bearer x', 'x-user-id': 'admin-1', 'x-user-role': 'ADMIN' } });
    const res = mockRes();
    const handler = getRouteHandler(router, 'get', '/stats');

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        stats: expect.objectContaining({
          rides: expect.objectContaining({ total: 10, completed: 7 }),
          drivers: expect.objectContaining({ total: 3, online: 1, busy: 1, offline: 1 }),
          customers: expect.objectContaining({ total: 2, active: 2 }),
        }),
      },
    });
  });

  it('GET /payments should map axios failure to ADMIN_PAYMENTS_FAILED', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: { message: 'bad gateway' } }),
    });
    const req = mockReq({ headers: { authorization: 'Bearer x', 'x-user-id': 'admin-1', 'x-user-role': 'ADMIN' } });
    const res = mockRes();
    const handler = getRouteHandler(router, 'get', '/payments');

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'ADMIN_PAYMENTS_FAILED', message: 'Failed to load payments' },
    });
  });
});

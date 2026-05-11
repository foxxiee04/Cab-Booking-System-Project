import { Router, Request, Response } from 'express';
import { config } from '../config';
import { requireRole } from '../middleware/auth';

const router = Router();

router.use(requireRole('ADMIN'));

const getPaging = (req: Request) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = parseInt(req.query.offset as string) || 0;
  const page = Math.floor(offset / limit) + 1;
  return { limit, offset, page };
};

const getAuthHeaders = (req: Request) => ({
  Authorization: req.header('authorization') || '',
  'x-user-id': req.headers['x-user-id'] as string || '',
  'x-user-email': req.headers['x-user-email'] as string || '',
  'x-user-role': req.headers['x-user-role'] as string || '',
});

const unwrapPayload = <T = any>(response: any): T => {
  if (response?.data?.data) {
    return response.data.data as T;
  }

  if (response?.data) {
    return response.data as T;
  }

  return response as T;
};

async function callHttpService<T = any>(
  service: keyof typeof config.services,
  req: Request,
  path: string,
  query: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL(path, config.services[service]);

  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null) {
          url.searchParams.append(key, String(entry));
        }
      });
      return;
    }

    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeaders(req),
  });

  const text = await response.text();
  let body: T;

  try {
    body = (text ? JSON.parse(text) : {}) as T;
  } catch {
    body = text as T;
  }

  if (!response.ok) {
    const error = new Error(`HTTP service ${service} responded with status ${response.status}`) as Error & { statusCode?: number; body?: unknown };
    error.statusCode = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function callHttpServiceWithBody<T = any>(
  service: keyof typeof config.services,
  req: Request,
  path: string,
  method: 'POST' | 'PATCH',
  body?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(path, config.services[service]);
  const response = await fetch(url.toString(), {
    method,
    headers: {
      ...getAuthHeaders(req),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload: T;

  try {
    payload = (text ? JSON.parse(text) : {}) as T;
  } catch {
    payload = text as T;
  }

  if (!response.ok) {
    const error = new Error(`HTTP service ${service} responded with status ${response.status}`) as Error & { statusCode?: number; body?: unknown };
    error.statusCode = response.status;
    error.body = payload;
    throw error;
  }

  return payload;
}

async function callInternalHttpService<T = any>(
  service: keyof typeof config.services,
  path: string,
  query: Record<string, unknown> = {},
): Promise<T> {
  const url = new URL(path, config.services[service]);

  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null) {
          url.searchParams.append(key, String(entry));
        }
      });
      return;
    }

    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-internal-token': config.internalServiceToken,
    },
  });

  const text = await response.text();
  let payload: T;

  try {
    payload = (text ? JSON.parse(text) : {}) as T;
  } catch {
    payload = text as T;
  }

  if (!response.ok) {
    const error = new Error(`Internal HTTP service ${service} responded with status ${response.status}`) as Error & { statusCode?: number; body?: unknown };
    error.statusCode = response.status;
    error.body = payload;
    throw error;
  }

  return payload;
}

router.get('/rides', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);
    const status = req.query.status as string | undefined;

    const response = await callHttpService<any>(
      'ride',
      req,
      '/api/rides/admin',
      { page, limit, status },
    );

    const payload = unwrapPayload<any>(response);
    const rides = payload.rides || [];
    const total = payload.total ?? response?.meta?.total ?? rides.length;

    res.json({ success: true, data: { rides, total } });
  } catch (error: any) {
    res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_RIDES_FAILED', message: 'Failed to load rides' },
    });
  }
});

router.get('/drivers', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);
    const status = req.query.status as string | undefined;
    const userLimit = Math.max(limit * 5, 1000);

    const [driverResponse, userResponse] = await Promise.all([
      callHttpService<any>('driver', req, '/api/drivers', { page, limit, status }),
      callHttpService<any>('auth', req, '/api/auth/users', { page: 1, limit: userLimit, role: 'DRIVER' }),
    ]);

    const payload = unwrapPayload<any>(driverResponse);
    let rawDrivers = Array.isArray(payload.drivers) ? payload.drivers : [];
    const usersPayload = unwrapPayload<any>(userResponse);
    let users = Array.isArray(usersPayload.users) ? usersPayload.users : [];
    const driverActorIds: string[] = rawDrivers.reduce((ids: string[], driver: any) => {
      if (driver.id) {
        ids.push(driver.id);
      }
      if (driver.userId) {
        ids.push(driver.userId);
      }
      return ids;
    }, []);
    const driverStatsResponse = driverActorIds.length > 0
      ? await callInternalHttpService<any>('ride', '/internal/drivers/stats', { ids: driverActorIds.join(',') })
      : null;
    const driverRideCounts = driverStatsResponse ? unwrapPayload<any>(driverStatsResponse)?.counts || {} : {};

    const usersById = new Map<string, {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber: string;
      avatar: string | null;
    }>(
      users.map((user: any) => [
        user.id,
        {
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phoneNumber: user.phone || user.phoneNumber || '',
          avatar: typeof user.avatar === 'string' ? user.avatar : null,
        },
      ])
    );

    const drivers = rawDrivers.map((driver: any) => {
      const mergedUser = usersById.get(driver.userId) || null;
      const avatarUrl =
        typeof mergedUser?.avatar === 'string' && mergedUser.avatar.trim() !== ''
          ? mergedUser.avatar
          : undefined;

      return {
      id: driver.id,
      userId: driver.userId,
      status: driver.status,
      vehicleType: driver.vehicleType,
      vehicleMake: driver.vehicleBrand,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehicleYear: driver.vehicleYear,
      vehicleImageUrl: driver.vehicleImageUrl,
      cccdImageUrl: driver.cccdImageUrl,
      avatarUrl,
      licensePlate: driver.vehiclePlate,
      licenseClass: driver.licenseClass,
      licenseNumber: driver.licenseNumber,
      licenseExpiryDate: driver.licenseExpiryDate,
      reviewCount: driver.ratingCount ?? driver.reviewCount ?? 0,
      rating: (driver.ratingCount ?? driver.reviewCount ?? 0) > 0 ? (driver.ratingAverage ?? driver.rating ?? 0) : 0,
      totalRides: (driverRideCounts[driver.id] ?? 0) + (driver.userId ? driverRideCounts[driver.userId] ?? 0 : 0),
      isOnline: ['ONLINE', 'BUSY'].includes(driver.availabilityStatus),
      isAvailable: driver.availabilityStatus === 'ONLINE',
      currentLocation:
        driver.lastLocationLat != null && driver.lastLocationLng != null
          ? { lat: driver.lastLocationLat, lng: driver.lastLocationLng }
          : null,
      user: mergedUser
        ? {
            firstName: mergedUser.firstName,
            lastName: mergedUser.lastName,
            email: mergedUser.email,
            phoneNumber: mergedUser.phoneNumber,
            avatar: mergedUser.avatar,
          }
        : null,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    };
    });

    const total = payload.total ?? driverResponse?.meta?.total ?? drivers.length;

    res.json({ success: true, data: { drivers, total } });
  } catch (error: any) {
    res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_DRIVERS_FAILED', message: 'Failed to load drivers' },
    });
  }
});

router.post('/drivers/:driverId/approve', async (req: Request, res: Response) => {
  try {
    const response = await callHttpServiceWithBody<any>('driver', req, `/api/drivers/${req.params.driverId}/approve`, 'POST');
    res.json({ success: true, data: unwrapPayload<any>(response) });
  } catch (error: any) {
    res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_DRIVER_APPROVE_FAILED', message: 'Không thể duyệt tài xế' },
    });
  }
});

router.post('/drivers/:driverId/reject', async (req: Request, res: Response) => {
  try {
    const response = await callHttpServiceWithBody<any>('driver', req, `/api/drivers/${req.params.driverId}/reject`, 'POST', {
      reason: req.body?.reason,
    });
    res.json({ success: true, data: unwrapPayload<any>(response) });
  } catch (error: any) {
    res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_DRIVER_REJECT_FAILED', message: 'Không thể từ chối tài xế' },
    });
  }
});

router.get('/customers', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);

    const response = await callHttpService<any>('auth', req, '/api/auth/users', { page, limit, role: 'CUSTOMER' });

    const payload = unwrapPayload<any>(response);
    const users = payload.users || [];
    const customerIds = users
      .map((user: any) => typeof user.id === 'string' ? user.id : '')
      .filter(Boolean);
    const customerStatsResponse = customerIds.length > 0
      ? await callInternalHttpService<any>('ride', '/internal/customers/stats', { ids: customerIds.join(',') })
      : null;
    const customerRideCounts = customerStatsResponse ? unwrapPayload<any>(customerStatsResponse)?.counts || {} : {};

    const customers = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phone || user.phoneNumber || '',
        status: user.status || 'ACTIVE',
        totalRides: customerRideCounts[user.id] ?? 0,
        rating: 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

    const total = response?.meta?.total ?? customers.length;

    res.json({ success: true, data: { customers, total } });
  } catch (error: any) {
    res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_CUSTOMERS_FAILED', message: 'Failed to load customers' },
    });
  }
});

router.get('/payments', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);
    const status = req.query.status as string | undefined;

    const response = await callHttpService<any>('payment', req, '/api/payments/admin', { page, limit, status });

    const payload = unwrapPayload<any>(response);
    const payments = payload.payments || [];
    const total = payload.total ?? payments.length;

    res.json({ success: true, data: { payments, total } });
  } catch (error: any) {
    res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_PAYMENTS_FAILED', message: 'Failed to load payments' },
    });
  }
});

router.get('/logs', async (_req: Request, res: Response) => {
  res.json({ success: true, data: { logs: [], total: 0 } });
});

// Stats handler function
const handleStats = async (req: Request, res: Response) => {
  try {
    const [rideRes, paymentRes, driverRes, userRes] = await Promise.all([
      callHttpService<any>('ride', req, '/api/rides/admin/stats'),
      callHttpService<any>('payment', req, '/api/payments/admin/stats'),
      callHttpService<any>('driver', req, '/api/drivers', { page: 1, limit: 1000 }),
      callHttpService<any>('auth', req, '/api/auth/users', { page: 1, limit: 1000 }),
    ]);

    const rideStats = unwrapPayload<any>(rideRes)?.stats || {};
    const paymentStats = unwrapPayload<any>(paymentRes) || {};
    const drivers = unwrapPayload<any>(driverRes)?.drivers || [];
    const users = unwrapPayload<any>(userRes)?.users || [];

    const online = drivers.filter((driver: any) => driver.availabilityStatus === 'ONLINE').length;
    const busy = drivers.filter((driver: any) => driver.availabilityStatus === 'BUSY').length;
    const totalDrivers = drivers.length;

    const customers = users.filter((user: any) => user.role === 'CUSTOMER');

    res.json({
      success: true,
      data: {
        stats: {
          rides: {
            total: rideStats.total || 0,
            today: rideStats.today || 0,
            pending: rideStats.pending || 0,
            active: rideStats.active || 0,
            completed: rideStats.completed || 0,
            cancelled: rideStats.cancelled || 0,
          },
          drivers: {
            total: totalDrivers,
            online,
            offline: Math.max(totalDrivers - online - busy, 0),
            busy,
          },
          customers: {
            total: customers.length,
            active: customers.length,
          },
          revenue: paymentStats.revenue || { total: 0, today: 0, week: 0, month: 0 },
          payments: paymentStats.payments || { pending: 0, completed: 0, failed: 0 },
        },
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_STATS_FAILED', message: 'Failed to load stats' },
    });
  }
};

// Both endpoints use the same handler
router.get('/stats', handleStats);
router.get('/statistics', handleStats);

// ── User status management ──────────────────────────────────────────────────
router.patch('/users/:userId/status', async (req: Request, res: Response) => {
  try {
    const response = await callHttpServiceWithBody<any>('auth', req, `/api/auth/users/${req.params.userId}/status`, 'PATCH', {
      status: req.body?.status,
    });
    res.json({ success: true, data: unwrapPayload<any>(response) });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { code: 'ADMIN_USER_STATUS_FAILED', message: 'Không thể cập nhật trạng thái người dùng' },
    });
  }
});

// ── Driver suspend / unsuspend ──────────────────────────────────────────────
router.patch('/drivers/:driverId/suspend', async (req: Request, res: Response) => {
  try {
    const response = await callHttpServiceWithBody<any>('driver', req, `/api/drivers/${req.params.driverId}/suspend`, 'PATCH', {
      suspend: req.body?.suspend,
    });
    res.json({ success: true, data: unwrapPayload<any>(response) });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { code: 'ADMIN_DRIVER_SUSPEND_FAILED', message: 'Không thể cập nhật trạng thái tài xế' },
    });
  }
});

// ── Revenue analytics ───────────────────────────────────────────────────────
router.get('/analytics/revenue', async (req: Request, res: Response) => {
  try {
    const days = req.query.days as string | undefined;
    const response = await callHttpService<any>('payment', req, '/api/payments/admin/analytics', { days });
    res.json({ success: true, data: unwrapPayload<any>(response) });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { code: 'ADMIN_ANALYTICS_FAILED', message: 'Failed to load analytics' },
    });
  }
});

// ── Vehicle breakdown analytics (rides + revenue per vehicle type) ─────────
router.get('/analytics/vehicles', async (req: Request, res: Response) => {
  try {
    const days = req.query.days as string | undefined;
    const response = await callHttpService<any>('ride', req, '/api/rides/admin/vehicle-breakdown', { days });
    res.json({ success: true, data: unwrapPayload<any>(response) });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { code: 'ADMIN_VEHICLE_BREAKDOWN_FAILED', message: 'Failed to load vehicle breakdown' },
    });
  }
});

// ── Top drivers (by totalRides + rating + earnings) ─────────────────────────
router.get('/analytics/top-drivers', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const response = await callHttpService<any>('driver', req, '/api/drivers', { page: 1, limit: 500 });
    const drivers = unwrapPayload<any>(response)?.drivers || [];
    const userResponse = await callHttpService<any>('auth', req, '/api/auth/users', { page: 1, limit: 1000, role: 'DRIVER' });
    const users = unwrapPayload<any>(userResponse)?.users || [];
    const usersById = new Map(users.map((u: any) => [u.id, u]));
    const driverActorIds = drivers.flatMap((d: any) => [d.id, d.userId].filter(Boolean));

    // Parallel: rides count (ride-service) + earnings sum (payment-service).
    // The Drivers admin page uses earnings to rank top earners.
    const [statsResponse, earningsResponse] = await Promise.all([
      driverActorIds.length > 0
        ? callInternalHttpService<any>('ride', '/internal/drivers/stats', { ids: driverActorIds.join(',') })
        : Promise.resolve(null),
      driverActorIds.length > 0
        ? callInternalHttpService<any>('payment', '/internal/drivers/earnings', { ids: driverActorIds.join(',') }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const rideCounts = statsResponse ? unwrapPayload<any>(statsResponse)?.counts || {} : {};
    const earningsMap = earningsResponse ? unwrapPayload<any>(earningsResponse)?.earnings || {} : {};

    const enriched = drivers.map((d: any) => {
      const u = usersById.get(d.userId) as any;
      const totalRides = (rideCounts[d.id] ?? 0) + (d.userId ? rideCounts[d.userId] ?? 0 : 0);
      const totalEarnings = Number(earningsMap[d.userId] ?? earningsMap[d.id] ?? 0);
      return {
        id: d.id,
        name: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'N/A',
        rating: d.ratingAverage ?? d.rating ?? 0,
        reviewCount: d.ratingCount ?? d.reviewCount ?? 0,
        totalRides,
        totalEarnings,
        vehicleType: d.vehicleType,
        status: d.status,
      };
    });

    const top = enriched
      .sort((a: any, b: any) => b.totalRides - a.totalRides)
      .slice(0, limit);

    res.json({ success: true, data: { drivers: top } });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { code: 'ADMIN_TOP_DRIVERS_FAILED', message: 'Failed to load top drivers' },
    });
  }
});

// ── Top customers (by totalRides) ───────────────────────────────────────────
router.get('/analytics/top-customers', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);
    const response = await callHttpService<any>('auth', req, '/api/auth/users', { page: 1, limit: 500, role: 'CUSTOMER' });
    const users = unwrapPayload<any>(response)?.users || [];
    const customerIds = users.map((u: any) => u.id).filter(Boolean);
    const statsResponse = customerIds.length > 0
      ? await callInternalHttpService<any>('ride', '/internal/customers/stats', { ids: customerIds.join(',') })
      : null;
    const rideCounts = statsResponse ? unwrapPayload<any>(statsResponse)?.counts || {} : {};

    const enriched = users.map((u: any) => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'N/A',
      email: u.email || '',
      totalRides: rideCounts[u.id] ?? 0,
      status: u.status,
    }));

    const top = enriched
      .sort((a: any, b: any) => b.totalRides - a.totalRides)
      .slice(0, limit);

    res.json({ success: true, data: { customers: top } });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: { code: 'ADMIN_TOP_CUSTOMERS_FAILED', message: 'Failed to load top customers' },
    });
  }
});

export default router;

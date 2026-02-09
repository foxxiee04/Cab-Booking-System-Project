import { Router, Request, Response } from 'express';
import axios from 'axios';
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

router.get('/rides', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);
    const status = req.query.status as string | undefined;

    const response = await axios.get(`${config.services.ride}/api/rides/admin`, {
      params: { page, limit, status },
      headers: getAuthHeaders(req),
    });

    const payload = response.data?.data || response.data;
    const rides = payload.rides || [];
    const total = payload.total ?? response.data?.meta?.total ?? rides.length;

    res.json({ success: true, data: { rides, total } });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_RIDES_FAILED', message: 'Failed to load rides' },
    });
  }
});

router.get('/drivers', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);

    const response = await axios.get(`${config.services.driver}/api/drivers`, {
      params: { page, limit },
      headers: getAuthHeaders(req),
    });

    const payload = response.data?.data || response.data;
    const rawDrivers = payload.drivers || [];

    const drivers = rawDrivers.map((driver: any) => ({
      id: driver.id,
      userId: driver.userId,
      vehicleType: driver.vehicleType,
      vehicleMake: driver.vehicleBrand,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      licensePlate: driver.vehiclePlate,
      licenseNumber: driver.licenseNumber,
      rating: driver.ratingAverage ?? driver.rating ?? 0,
      totalRides: driver.ratingCount ?? driver.totalRides ?? 0,
      isOnline: ['ONLINE', 'BUSY'].includes(driver.availabilityStatus),
      isAvailable: driver.availabilityStatus === 'ONLINE',
      currentLocation:
        driver.lastLocationLat != null && driver.lastLocationLng != null
          ? { lat: driver.lastLocationLat, lng: driver.lastLocationLng }
          : null,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
    }));

    const total = response.data?.meta?.total ?? drivers.length;

    res.json({ success: true, data: { drivers, total } });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_DRIVERS_FAILED', message: 'Failed to load drivers' },
    });
  }
});

router.get('/customers', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);

    const response = await axios.get(`${config.services.auth}/api/auth/users`, {
      params: { page, limit },
      headers: getAuthHeaders(req),
    });

    const payload = response.data?.data || response.data;
    const users = payload.users || [];

    const customers = users
      .filter((user: any) => user.role === 'CUSTOMER')
      .map((user: any) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phone || user.phoneNumber || '',
        totalRides: 0,
        rating: 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

    res.json({ success: true, data: { customers, total: customers.length } });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_CUSTOMERS_FAILED', message: 'Failed to load customers' },
    });
  }
});

router.get('/payments', async (req: Request, res: Response) => {
  try {
    const { limit, page } = getPaging(req);
    const status = req.query.status as string | undefined;

    const response = await axios.get(`${config.services.payment}/api/payments/admin`, {
      params: { page, limit, status },
      headers: getAuthHeaders(req),
    });

    const payload = response.data?.data || response.data;
    const payments = payload.payments || [];
    const total = payload.total ?? payments.length;

    res.json({ success: true, data: { payments, total } });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
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
    const headers = getAuthHeaders(req);

    const [rideRes, paymentRes, driverRes, userRes] = await Promise.all([
      axios.get(`${config.services.ride}/api/rides/admin/stats`, { headers }),
      axios.get(`${config.services.payment}/api/payments/admin/stats`, { headers }),
      axios.get(`${config.services.driver}/api/drivers`, { params: { page: 1, limit: 1000 }, headers }),
      axios.get(`${config.services.auth}/api/auth/users`, { params: { page: 1, limit: 1000 }, headers }),
    ]);

    const rideStats = rideRes.data?.data?.stats || {};
    const paymentStats = paymentRes.data?.data || {};
    const drivers = driverRes.data?.data?.drivers || [];
    const users = userRes.data?.data?.users || [];

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
    res.status(error.response?.status || 500).json({
      success: false,
      error: { code: 'ADMIN_STATS_FAILED', message: 'Failed to load stats' },
    });
  }
};

// Both endpoints use the same handler
router.get('/stats', handleStats);
router.get('/statistics', handleStats);

export default router;

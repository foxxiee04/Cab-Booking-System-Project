import { Request, Response } from 'express';
import axios from 'axios';
import { DriverController } from '../controllers/driver.controller';

jest.mock('axios');
jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

function mockReq(overrides: Partial<Request> & { user?: any } = {}): Request {
  const headers = (overrides.headers || {}) as any;
  return {
    body: {},
    params: {},
    query: {},
    headers,
    header: jest.fn((name: string) => headers[name] || headers[name.toLowerCase()] || ''),
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('DriverController', () => {
  const driverService = {
    registerDriver: jest.fn(),
    getDriverByUserId: jest.fn(),
    goOnline: jest.fn(),
    goOffline: jest.fn(),
    updateLocation: jest.fn(),
    getDrivers: jest.fn(),
    updateDriver: jest.fn(),
    approveDriver: jest.fn(),
    rejectDriver: jest.fn(),
  } as any;

  let controller: DriverController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DriverController(driverService);
  });

  it('registerDriver should convert license expiryDate and return 201', async () => {
    driverService.registerDriver.mockResolvedValue({ id: 'driver-1' });
    const req = mockReq({
      user: { userId: 'driver-user', role: 'DRIVER' } as any,
      body: {
        vehicle: { type: 'CAR', brand: 'Toyota', model: 'Vios', plate: '51A', color: 'White', year: 2024 },
        license: { number: 'GPLX-1', expiryDate: '2027-01-01T00:00:00.000Z' },
      },
    });
    const res = mockRes();

    await controller.registerDriver(req as any, res);

    expect(driverService.registerDriver).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'driver-user',
        license: expect.objectContaining({ expiryDate: new Date('2027-01-01T00:00:00.000Z') }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('registerDriver should map service error to 400', async () => {
    driverService.registerDriver.mockRejectedValue(new Error('Driver already registered'));
    const req = mockReq({
      user: { userId: 'driver-user', role: 'DRIVER' } as any,
      body: { vehicle: {}, license: { expiryDate: '2027-01-01T00:00:00.000Z' } },
    });
    const res = mockRes();

    await controller.registerDriver(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: 'Driver already registered' },
    });
  });

  it('getMe should return 404 when profile is not set up', async () => {
    driverService.getDriverByUserId.mockResolvedValue(null);
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any });
    const res = mockRes();

    await controller.getMe(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('goOnline should map service error to 400', async () => {
    driverService.goOnline.mockRejectedValue(new Error('Driver must be approved before going online. Current status: PENDING'));
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any });
    const res = mockRes();

    await controller.goOnline(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'GO_ONLINE_FAILED',
        message: 'Driver must be approved before going online. Current status: PENDING',
      },
    });
  });

  it('goOffline should return driver in success payload', async () => {
    driverService.goOffline.mockResolvedValue({ id: 'driver-1', availabilityStatus: 'OFFLINE' });
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any });
    const res = mockRes();

    await controller.goOffline(req as any, res);

    expect(driverService.goOffline).toHaveBeenCalledWith('driver-user');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { driver: { id: 'driver-1', availabilityStatus: 'OFFLINE' } } });
  });

  it('updateLocation should return 404 when driver profile is missing', async () => {
    driverService.getDriverByUserId.mockResolvedValue(null);
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any, body: { lat: 10.1, lng: 106.1 } });
    const res = mockRes();

    await controller.updateLocation(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(driverService.updateLocation).not.toHaveBeenCalled();
  });

  it('updateLocation should proxy location update to service', async () => {
    driverService.getDriverByUserId.mockResolvedValue({ id: 'driver-profile-1' });
    driverService.updateLocation.mockResolvedValue(undefined);
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any, body: { lat: 10.1, lng: 106.1 } });
    const res = mockRes();

    await controller.updateLocation(req as any, res);

    expect(driverService.updateLocation).toHaveBeenCalledWith('driver-profile-1', { lat: 10.1, lng: 106.1 });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { message: 'Location updated' } });
  });

  it('getAssignedRide should return 404 when driver profile is missing', async () => {
    driverService.getDriverByUserId.mockResolvedValue(null);
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any });
    const res = mockRes();

    await controller.getAssignedRide(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getAssignedRide should return null ride when no active ride exists', async () => {
    driverService.getDriverByUserId.mockResolvedValue({ id: 'driver-1' });
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any });
    const res = mockRes();

    await controller.getAssignedRide(req as any, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { ride: null } });
  });

  it('getDriverByUserId should return 400 when userId is missing', async () => {
    const req = mockReq({ params: {} });
    const res = mockRes();

    await controller.getDriverByUserId(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('getAvailableRides should reject non-driver role', async () => {
    const req = mockReq({ user: { userId: 'user-1', role: 'CUSTOMER' } as any });
    const res = mockRes();

    await controller.getAvailableRides(req as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('getAvailableRides should proxy to ride service for drivers', async () => {
    driverService.getDriverByUserId.mockResolvedValue({ id: 'driver-1', vehicleType: 'CAR_4' });
    (axios.get as jest.Mock).mockResolvedValue({ data: { data: { rides: [{ id: 'ride-1' }] } } });
    const req = mockReq({
      user: { userId: 'driver-user', role: 'DRIVER' } as any,
      query: { lat: '10.1', lng: '106.1', radius: '5' },
      headers: { authorization: 'Bearer token' } as any,
    });
    const res = mockRes();

    await controller.getAvailableRides(req as any, res);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/rides/available'),
      expect.objectContaining({
        params: expect.objectContaining({ lat: '10.1', lng: '106.1', radius: '5', vehicleType: 'CAR_4' }),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { rides: [{ id: 'ride-1' }] } });
  });

  it('acceptRide should return 404 when driver profile not found', async () => {
    driverService.getDriverByUserId.mockResolvedValue(null);
    const req = mockReq({ user: { userId: 'driver-user', role: 'DRIVER' } as any, params: { rideId: 'ride-1' } });
    const res = mockRes();

    await controller.acceptRide(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('acceptRide should proxy driver id to ride service', async () => {
    driverService.getDriverByUserId.mockResolvedValue({ id: 'driver-profile-1' });
    (axios.post as jest.Mock).mockResolvedValue({ data: { data: { ride: { id: 'ride-1' } } } });
    const req = mockReq({
      user: { userId: 'driver-user', role: 'DRIVER' } as any,
      params: { rideId: 'ride-1' },
      headers: { authorization: 'Bearer token' } as any,
    });
    const res = mockRes();

    await controller.acceptRide(req as any, res);

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/rides/ride-1/driver-accept'),
      { driverId: 'driver-profile-1' },
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } })
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { ride: { id: 'ride-1' } } });
  });

  it('getDriverByUserId should return 404 when service returns null', async () => {
    driverService.getDriverByUserId.mockResolvedValue(null);
    const req = mockReq({ params: { userId: 'missing-user' } });
    const res = mockRes();

    await controller.getDriverByUserId(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('verifyDriver should return 404 when driver is missing', async () => {
    driverService.approveDriver.mockResolvedValue(null);
    const req = mockReq({ params: { driverId: 'missing-driver' }, body: {} });
    const res = mockRes();

    await controller.verifyDriver(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

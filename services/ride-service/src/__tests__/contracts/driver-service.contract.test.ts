import { Response } from 'express';
import axios from 'axios';
import { RideController } from '../../controllers/ride.controller';

jest.mock('axios');

function mockResponse(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('Ride to Driver internal contract', () => {
  it('reads driver id from data.driver.id response shape', async () => {
    const rideService = {
      getActiveRideForDriver: jest.fn().mockResolvedValue({ id: 'ride-1', driverId: 'driver-1' }),
    } as any;
    const controller = new RideController(rideService);
    const req = {
      user: { userId: 'user-1', role: 'DRIVER' },
    } as any;
    const res = mockResponse();

    (axios.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          driver: {
            id: 'driver-1',
            userId: 'user-1',
          },
        },
      },
    });

    await controller.getDriverActiveRide(req, res);

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/internal/drivers/by-user/user-1'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-internal-token': 'test-internal-token' }),
      })
    );
    expect(rideService.getActiveRideForDriver).toHaveBeenCalledWith('driver-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'ride-1', driverId: 'driver-1' } });
  });
});
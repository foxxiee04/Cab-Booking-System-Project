import { AddressInfo } from 'net';
import { createApp } from '../../app';

async function requestJson(app: ReturnType<typeof createApp>, path: string, token: string) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { 'x-internal-token': token },
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('Driver internal response contract', () => {
  it('returns the driver payload under data.driver', async () => {
    const app = createApp({
      driverService: {
        getDriverByUserId: jest.fn().mockResolvedValue({
          id: 'driver-1',
          userId: 'user-1',
          status: 'ACTIVE',
        }),
        getDriverById: jest.fn(),
      } as any,
      getReadiness: async () => ({ postgres: true, redis: true, rabbitmq: true }),
    });

    const response = await requestJson(app, '/internal/drivers/by-user/user-1', 'test-internal-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        driver: {
          id: 'driver-1',
          userId: 'user-1',
          status: 'ACTIVE',
        },
      },
    });
  });
});
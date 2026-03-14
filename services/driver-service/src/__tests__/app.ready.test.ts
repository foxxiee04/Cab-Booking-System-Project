import { AddressInfo } from 'net';
import { createApp } from '../app';

function createDriverServiceStub() {
  return {
    getDriverByUserId: jest.fn(),
    getDriverById: jest.fn(),
  } as any;
}

async function requestJson(app: ReturnType<typeof createApp>, path: string) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await response.json() as any;
    return {
      status: response.status,
      body,
      headers: response.headers,
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('Driver app readiness', () => {
  it('returns 200 when dependencies are ready', async () => {
    const app = createApp({
      driverService: createDriverServiceStub(),
      getReadiness: async () => ({ postgres: true, redis: true, rabbitmq: true }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns 503 when redis is unavailable', async () => {
    const app = createApp({
      driverService: createDriverServiceStub(),
      getReadiness: async () => ({ postgres: true, redis: false, rabbitmq: true }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(503);
    expect(response.body.dependencies.redis).toBe(false);
  });
});
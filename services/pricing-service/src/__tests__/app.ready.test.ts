import { AddressInfo } from 'net';
import { createApp } from '../app';

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

describe('Pricing app readiness', () => {
  it('returns 200 when redis is ready', async () => {
    const app = createApp({
      pricingService: {} as any,
      getReadiness: async () => ({ redis: true }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns 503 when redis is down', async () => {
    const app = createApp({
      pricingService: {} as any,
      getReadiness: async () => ({ redis: false }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(503);
    expect(response.body.dependencies.redis).toBe(false);
  });
});
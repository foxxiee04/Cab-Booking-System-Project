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

describe('API Gateway app', () => {
  it('returns 200 from /ready when dependencies are healthy', async () => {
    const app = createApp({
      getReadiness: async () => ({ redis: true, rabbitmq: true }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      service: 'api-gateway',
      dependencies: { redis: true, rabbitmq: true },
    });
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns 503 from /ready when rabbitmq is down', async () => {
    const app = createApp({
      getReadiness: async () => ({ redis: true, rabbitmq: false }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(503);
    expect(response.body.dependencies.rabbitmq).toBe(false);
  });

  it('aggregates downstream health status in /health/services', async () => {
    const fetchImpl = jest.fn(async (url: string) => ({ ok: !url.includes(':3008/') } as Response));
    const app = createApp({
      getReadiness: async () => ({ redis: true, rabbitmq: true }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const response = await requestJson(app, '/health/services');

    expect(response.status).toBe(200);
    expect(response.body.gateway).toBe('healthy');
    expect(response.body.services.auth).toBe('healthy');
    expect(response.body.services.booking).toBe('unhealthy');
  });
});
import { AddressInfo } from 'net';
import { createApp } from '../app';

function createAuthServiceStub() {
  return {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    getProfile: jest.fn(),
    logout: jest.fn(),
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

describe('Auth app readiness', () => {
  it('returns 200 when dependencies are ready', async () => {
    const app = createApp({
      authService: createAuthServiceStub(),
      getReadiness: async () => ({ postgres: true, rabbitmq: true }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      service: 'auth-service',
      dependencies: { postgres: true, rabbitmq: true },
    });
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('returns 503 when a dependency is down', async () => {
    const app = createApp({
      authService: createAuthServiceStub(),
      getReadiness: async () => ({ postgres: true, rabbitmq: false }),
    });

    const response = await requestJson(app, '/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.dependencies.rabbitmq).toBe(false);
  });
});
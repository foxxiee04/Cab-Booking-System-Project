// Jest setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'internal-test-token';
process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
process.env.RIDE_SERVICE_URL = process.env.RIDE_SERVICE_URL || 'http://ride-service:3002';
process.env.DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3003';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});

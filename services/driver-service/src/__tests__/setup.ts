// Jest setup file for driver-service
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/test_drivers';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});

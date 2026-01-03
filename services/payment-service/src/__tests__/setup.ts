// Jest setup file for payment-service
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_payments';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});

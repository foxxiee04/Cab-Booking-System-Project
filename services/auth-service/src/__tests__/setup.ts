// Jest setup file for auth-service
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_auth';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});

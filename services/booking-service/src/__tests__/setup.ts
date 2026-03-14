process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_booking';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
process.env.PRICING_SERVICE_URL = 'http://localhost:3009';
process.env.RIDE_SERVICE_URL = 'http://localhost:3002';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});
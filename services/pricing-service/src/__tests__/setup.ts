process.env.NODE_ENV = 'test';
process.env.AI_SERVICE_URL = 'http://localhost:8000';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.OSRM_BASE_URL = 'http://router.project-osrm.org';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});
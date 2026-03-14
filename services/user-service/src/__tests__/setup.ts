process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_user';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});
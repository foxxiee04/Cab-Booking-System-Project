process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});

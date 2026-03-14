process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_reviews';

jest.setTimeout(10000);

afterEach(() => {
  jest.clearAllMocks();
});
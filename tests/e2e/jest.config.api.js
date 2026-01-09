export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/api'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['api/**/*.ts'],
  coverageDirectory: 'coverage-api',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 30000,
};

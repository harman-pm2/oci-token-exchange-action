module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true,
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  // Increase the timeout for tests that might take longer
  testTimeout: 10000
};
// Mock any global objects or setup test environment here
process.env.NODE_ENV = 'test';

// Mock the GitHub Actions core module
jest.mock('@actions/core');

// Mock axios for HTTP requests
jest.mock('axios');

// Silence console output during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

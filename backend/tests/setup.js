require('jest-extended');

// Global test setup
beforeAll(async () => {
  // Disable logging during tests unless explicitly needed
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Mock Redis for testing
  jest.mock('redis', () => ({
    createClient: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      connect: jest.fn(),
      quit: jest.fn(),
      ping: jest.fn(),
      isOpen: true,
      isReady: true,
    }))
  }));
  
  // Mock Socket.IO
  jest.mock('socket.io', () => ({
    Server: jest.fn(() => ({
      emit: jest.fn(),
      on: jest.fn(),
      use: jest.fn(),
      close: jest.fn(),
    }))
  }));
});

afterAll(async () => {
  // Clean up any resources
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock timers helpers
global.flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock environment variables
process.env.AZURE_DEVOPS_ORG = 'test-org';
process.env.AZURE_DEVOPS_PROJECT = 'test-project';
process.env.AZURE_DEVOPS_PAT = 'test-pat-token';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3001';
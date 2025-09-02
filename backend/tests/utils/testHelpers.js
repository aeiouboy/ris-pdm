const request = require('supertest');
const { jest } = require('@jest/globals');

/**
 * Test helper utilities for RIS Performance Dashboard
 */

// Mock Redis client factory
const createMockRedisClient = () => ({
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  connect: jest.fn(),
  quit: jest.fn(),
  ping: jest.fn(() => Promise.resolve('PONG')),
  isOpen: true,
  isReady: true,
});

// Mock JWT token generator
const generateMockJWT = (payload = { userId: 'test-user', role: 'admin' }) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h'
  });
};

// Mock Azure DevOps service factory
const createMockAzureDevOpsService = (overrides = {}) => ({
  // Authentication methods
  authenticate: jest.fn().mockResolvedValue(true),
  isAuthenticated: jest.fn().mockResolvedValue(true),
  
  // Work items methods
  getWorkItems: jest.fn().mockResolvedValue([
    { id: 1, title: 'Test Work Item 1', type: 'User Story', state: 'Active' },
    { id: 2, title: 'Test Work Item 2', type: 'Bug', state: 'New' }
  ]),
  getWorkItem: jest.fn().mockResolvedValue({ 
    id: 1, title: 'Test Work Item', type: 'User Story', state: 'Active' 
  }),
  getWorkItemsByQuery: jest.fn().mockResolvedValue([]),
  
  // Team methods
  getTeamMembers: jest.fn().mockResolvedValue([
    { id: 'user1', displayName: 'User 1', uniqueName: 'user1@company.com' },
    { id: 'user2', displayName: 'User 2', uniqueName: 'user2@company.com' }
  ]),
  
  // Iteration methods
  getIterations: jest.fn().mockResolvedValue([
    { id: 'sprint1', name: 'Sprint 1', path: '\\Project\\Sprint 1', attributes: { timeFrame: 'current' }}
  ]),
  getCurrentIteration: jest.fn().mockResolvedValue(
    { id: 'sprint1', name: 'Sprint 1', attributes: { timeFrame: 'current' }}
  ),
  
  // Capacity methods
  getCapacities: jest.fn().mockResolvedValue([
    { teamMember: { id: 'user1' }, activities: [{ capacityPerDay: 8 }], daysOff: [] }
  ]),
  
  // Project methods
  getProjects: jest.fn().mockResolvedValue([
    { id: 'project1', name: 'Test Project', state: 'wellFormed' }
  ]),
  
  ...overrides
});

// Mock cache service factory
const createMockCacheService = (overrides = {}) => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  flush: jest.fn(),
  getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0 }),
  ...overrides
});

// Mock performance monitor service
const createMockPerformanceMonitorService = (overrides = {}) => ({
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn(),
  getMetrics: jest.fn().mockReturnValue({}),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  ...overrides
});

// Mock WebSocket service
const createMockWebSocketService = (overrides = {}) => ({
  server: {
    emit: jest.fn(),
    on: jest.fn(),
    use: jest.fn(),
    close: jest.fn(),
  },
  broadcast: jest.fn(),
  emitToRoom: jest.fn(),
  handleConnection: jest.fn(),
  ...overrides
});

// Test data generators
const generateTestMetrics = (overrides = {}) => ({
  kpis: {
    plYtd: 1250000,
    velocity: 32,
    bugCount: 5,
    satisfaction: 4.2,
    deliveryPredictability: 85,
    teamSatisfaction: 8.5,
    codeQuality: 7.8,
    cycleTime: 5.2,
    defectEscapeRate: 2.1,
    ...overrides.kpis
  },
  charts: {
    sprintBurndown: [
      { date: '2024-01-01', planned: 100, actual: 95 },
      { date: '2024-01-02', planned: 90, actual: 85 }
    ],
    teamVelocity: [
      { sprint: 'Sprint 1', velocity: 28 },
      { sprint: 'Sprint 2', velocity: 32 }
    ],
    taskDistribution: [
      { name: 'User Story', value: 45, color: '#3B82F6' },
      { name: 'Bug', value: 15, color: '#EF4444' }
    ],
    ...overrides.charts
  },
  metadata: {
    lastUpdate: new Date().toISOString(),
    totalItems: 2000,
    teamSize: 27,
    dataSource: 'test',
    ...overrides.metadata
  }
});

// API test helpers
const apiTest = (app) => {
  const agent = request(app);
  
  return {
    // Authenticated request helper
    authenticatedRequest: (method, path, token = null) => {
      const authToken = token || generateMockJWT();
      return agent[method.toLowerCase()](path)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');
    },
    
    // Standard request helper
    request: (method, path) => {
      return agent[method.toLowerCase()](path)
        .set('Accept', 'application/json');
    },
    
    // Health check helper
    healthCheck: () => agent.get('/health'),
    
    // Metrics endpoints helpers
    getOverviewMetrics: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return agent.get(`/api/metrics/overview?${query}`)
        .set('Authorization', `Bearer ${generateMockJWT()}`);
    },
    
    getKPIMetrics: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return agent.get(`/api/metrics/kpis?${query}`)
        .set('Authorization', `Bearer ${generateMockJWT()}`);
    },
    
    getBurndownData: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return agent.get(`/api/metrics/burndown?${query}`)
        .set('Authorization', `Bearer ${generateMockJWT()}`);
    },
    
    // Export endpoints helpers
    exportDashboard: (format = 'xlsx', params = {}) => {
      const query = new URLSearchParams({ format, ...params }).toString();
      return agent.get(`/api/exports/dashboard?${query}`)
        .set('Authorization', `Bearer ${generateMockJWT()}`);
    },
    
    // Work items helpers
    getWorkItems: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return agent.get(`/api/workitems?${query}`)
        .set('Authorization', `Bearer ${generateMockJWT()}`);
    },
    
    // Users helpers
    getUsers: () => {
      return agent.get('/api/users')
        .set('Authorization', `Bearer ${generateMockJWT()}`);
    }
  };
};

// Database test helpers (for integration tests)
const dbTestHelpers = {
  // Mock database setup
  setupTestDatabase: async () => {
    // Mock database setup logic
    return { status: 'ready' };
  },
  
  // Mock database cleanup
  cleanupTestDatabase: async () => {
    // Mock cleanup logic
    return { status: 'cleaned' };
  },
  
  // Mock data seeding
  seedTestData: async (data = {}) => {
    // Mock data seeding
    return { status: 'seeded', ...data };
  }
};

// Performance test helpers
const performanceTestHelpers = {
  // Measure response time
  measureResponseTime: async (requestFn) => {
    const start = Date.now();
    await requestFn();
    return Date.now() - start;
  },
  
  // Memory usage helper
  measureMemoryUsage: () => {
    const used = process.memoryUsage();
    return {
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024)
    };
  },
  
  // Load test helper
  loadTest: async (requestFn, options = {}) => {
    const { concurrent = 10, iterations = 100 } = options;
    const results = [];
    
    for (let i = 0; i < iterations; i += concurrent) {
      const batch = Array(Math.min(concurrent, iterations - i))
        .fill()
        .map(() => requestFn());
      
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
    }
    
    return {
      total: results.length,
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      results
    };
  }
};

// Test environment helpers
const environmentHelpers = {
  // Set test environment variables
  setTestEnvVars: (vars = {}) => {
    const defaultVars = {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      AZURE_DEVOPS_ORG: 'test-org',
      AZURE_DEVOPS_PROJECT: 'test-project',
      AZURE_DEVOPS_PAT: 'test-pat-token',
      JWT_SECRET: 'test-jwt-secret',
      REDIS_URL: 'redis://localhost:6379',
      PORT: '3001'
    };
    
    Object.assign(process.env, defaultVars, vars);
  },
  
  // Clean up environment
  cleanupTestEnvVars: () => {
    const testVars = [
      'NODE_ENV', 'LOG_LEVEL', 'AZURE_DEVOPS_ORG',
      'AZURE_DEVOPS_PROJECT', 'AZURE_DEVOPS_PAT',
      'JWT_SECRET', 'REDIS_URL', 'PORT'
    ];
    
    testVars.forEach(varName => {
      delete process.env[varName];
    });
  },
  
  // Wait for condition
  waitForCondition: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (condition()) {
          resolve(true);
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
};

module.exports = {
  // Mock factories
  createMockRedisClient,
  createMockAzureDevOpsService,
  createMockCacheService,
  createMockPerformanceMonitorService,
  createMockWebSocketService,
  
  // Data generators
  generateTestMetrics,
  generateMockJWT,
  
  // Test helpers
  apiTest,
  dbTestHelpers,
  performanceTestHelpers,
  environmentHelpers,
  
  // Utilities
  flushPromises: () => new Promise(resolve => setTimeout(resolve, 0)),
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};
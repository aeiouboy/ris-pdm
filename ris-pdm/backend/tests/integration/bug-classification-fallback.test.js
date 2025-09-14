// Integration tests for /api/metrics/bug-classification/:projectId
// Validates 3-tier fallback: primary (Azure OK), fallback (Azure fails), last-resort (empty)

const request = require('supertest');
const environmentHelpers = {
  setTestEnvVars: (vars = {}) => {
    const defaults = {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      AZURE_DEVOPS_ORG: 'test-org',
      AZURE_DEVOPS_PROJECT: 'test-project',
      AZURE_DEVOPS_PAT: 'test-pat-token',
      JWT_SECRET: 'test-jwt-secret',
      REDIS_URL: 'redis://localhost:6379',
      PORT: '3001',
      DISABLE_CACHE_WARMUP: 'true',
    };
    Object.assign(process.env, defaults, vars);
  },
  cleanupTestEnvVars: () => {
    [
      'NODE_ENV','LOG_LEVEL','AZURE_DEVOPS_ORG','AZURE_DEVOPS_PROJECT','AZURE_DEVOPS_PAT',
      'JWT_SECRET','REDIS_URL','PORT','DISABLE_CACHE_WARMUP'
    ].forEach(k => delete process.env[k]);
  }
};

const makeJwt = (claims = {}) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  })).toString('base64url');
  return `${header}.${payload}.signature`;
};

// Mock dependent services used inside the route module
jest.mock('../../src/services/azureDevOpsService');
jest.mock('../../src/services/taskDistributionService');

describe('Bug Classification Endpoint - Three-tier Fallback', () => {
  let app;
  let agent;
  let AzureDevOpsService;
  let TaskDistributionService;
  let azureInstance;
  let tdsInstance;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    AzureDevOpsService = require('../../src/services/azureDevOpsService');
    TaskDistributionService = require('../../src/services/taskDistributionService');

    // Dynamically create per-import instances so we can configure after require
    AzureDevOpsService.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      getBugsByEnvironment: jest.fn(),
    }));
    TaskDistributionService.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      getBugTypeDistribution: jest.fn(),
      calculateTaskDistribution: jest.fn(),
    }));

    // Build app and router after mocks are set so constructors pick up mocks
    const express = require('express');
    const routerPath = require.resolve('../../routes/metrics');
    delete require.cache[routerPath];
    const metricsRouter = require('../../routes/metrics');

    // Capture instances created during router import
    azureInstance = AzureDevOpsService.mock.instances[0];
    tdsInstance = TaskDistributionService.mock.instances[0];

    app = express();
    app.use(express.json());
    // Bypass auth for tests
    app.use((req, res, next) => { req.user = { id: 'test', email: 'test@example.com' }; next(); });
    app.use('/api/metrics', metricsRouter);
    agent = request(app);
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  test('Primary: returns Azure-based classification when services work', async () => {
    // Arrange primary successful path
    const projectId = encodeURIComponent('Team - Product Management'); // maps to PMP project name

    // TaskDistributionService primary classification data
    tdsInstance.getBugTypeDistribution.mockResolvedValue({
      projectId: 'Product - Partner Management Platform',
      totalBugs: 10,
      classified: 8,
      unclassified: 2,
      classificationRate: 80,
      bugTypes: { Deploy: { count: 3 }, Prod: { count: 4 }, SIT: { count: 2 }, UAT: { count: 1 } },
      environments: {},
      environmentBreakdown: { Deploy: { count: 3, percentage: 30 }, Prod: { count: 4, percentage: 40 } },
      lastUpdated: new Date().toISOString(),
    });

    // When environment is specified, route requests only that env from Azure
    azureInstance.getBugsByEnvironment.mockResolvedValue({
      environment: 'Prod',
      bugs: [{ id: 101 }, { id: 102 }, { id: 103 }, { id: 104 }],
      count: 4,
      totalBugs: 10,
      percentage: 40,
    });

    // Act
    const res = await agent
      .get(`/api/metrics/bug-classification/${projectId}`)
      .set('Authorization', `Bearer ${makeJwt()}`)
      .query({ environment: 'Prod' })
      .expect(200);

    // Assert
    expect(mockTaskDistributionService.getBugTypeDistribution).toHaveBeenCalledWith(
      'Product - Partner Management Platform',
      expect.objectContaining({ environment: 'Prod' })
    );
    expect(mockAzureService.getBugsByEnvironment).toHaveBeenCalledWith(
      'Prod',
      expect.objectContaining({ projectName: 'Product - Partner Management Platform' })
    );

    expect(res.body).toHaveProperty('bugTypes');
    expect(res.body.bugTypes).toMatchObject({
      projectId: 'Product - Partner Management Platform',
      totalBugs: 10,
      classified: 8,
      unclassified: 2,
      classificationRate: 80,
    });
    expect(res.body).toHaveProperty('bugsByEnvironment');
    expect(res.body.bugsByEnvironment).toHaveProperty('Prod');
    expect(res.body.bugsByEnvironment.Prod).toMatchObject({ count: 4, percentage: 40 });
    expect(res.body).toHaveProperty('metadata.projectName', 'Product - Partner Management Platform');
    expect(res.body).toHaveProperty('cached', false);
  });

  test('Fallback: uses task distribution mock data when Azure fails', async () => {
    // Arrange primary failure, fallback success
    const projectId = encodeURIComponent('Team - Product Management');

    tdsInstance.getBugTypeDistribution.mockRejectedValue(new Error('Azure service unavailable'));

    // Fallback distribution includes bugClassification for transformation
    const bc = {
      totalBugs: 6,
      unclassified: 1,
      classificationRate: 84,
      classificationBreakdown: { Deploy: { count: 2 }, Prod: { count: 3 }, SIT: { count: 1 } },
      environmentBreakdown: {
        Deploy: { count: 2, percentage: 33 },
        Prod: { count: 3, percentage: 50 },
        SIT: { count: 1, percentage: 17 },
      },
    };

    tdsInstance.calculateTaskDistribution.mockImplementation(async () => {
      // debug marker
      // eslint-disable-next-line no-console
      console.log('[TEST] calculateTaskDistribution fallback invoked');
      return {
        distribution: {},
        bugClassification: bc,
        metadata: { totalItems: 42, queryOptions: { iterationPath: 'current' } },
      };
    });

    // Act
    const res = await agent
      .get(`/api/metrics/bug-classification/${projectId}`)
      .set('Authorization', `Bearer ${makeJwt()}`);
    // eslint-disable-next-line no-console
    if (res.status !== 200) console.log('[TEST] Fallback response:', res.status, res.body);
    expect(res.status).toBe(200);

    // Assert: primary failed, fallback used
    expect(tdsInstance.getBugTypeDistribution).toHaveBeenCalled();
    expect(tdsInstance.calculateTaskDistribution).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: 'Product - Partner Management Platform', iterationPath: 'current' })
    );

    expect(res.body).toHaveProperty('bugTypes');
    expect(res.body.bugTypes).toMatchObject({
      projectId: 'Product - Partner Management Platform',
      totalBugs: 6,
      classified: 5, // derived: totalBugs - unclassified
      unclassified: 1,
      classificationRate: 84,
    });

    // Environment data synthesized from breakdown with empty bug lists
    expect(res.body).toHaveProperty('bugsByEnvironment.Deploy.count', 2);
    expect(res.body).toHaveProperty('bugsByEnvironment.Prod.count', 3);
    expect(res.body).toHaveProperty('bugsByEnvironment.SIT.count', 1);
    expect(res.body).toHaveProperty('metadata.projectName', 'Product - Partner Management Platform');
  });

  test('Last resort: returns empty structure when both primary and fallback fail', async () => {
    // Arrange: both paths fail
    const projectId = encodeURIComponent('Team - Product Management');

    tdsInstance.getBugTypeDistribution.mockRejectedValue(new Error('Azure down'));
    tdsInstance.calculateTaskDistribution.mockImplementation(async () => {
      // eslint-disable-next-line no-console
      console.log('[TEST] calculateTaskDistribution fallback invoked and failing');
      throw new Error('Cache/mocks unavailable');
    });

    // Act
    const res = await agent
      .get(`/api/metrics/bug-classification/${projectId}`)
      .set('Authorization', `Bearer ${makeJwt()}`);
    // eslint-disable-next-line no-console
    if (res.status !== 200) console.log('[TEST] Last resort response:', res.status, res.body);
    expect(res.status).toBe(200);

    // Assert: empty but valid structure
    expect(res.body).toHaveProperty('bugTypes');
    expect(res.body.bugTypes).toMatchObject({
      projectId: 'Product - Partner Management Platform',
      totalBugs: 0,
      classified: 0,
      unclassified: 0,
      classificationRate: 0,
      bugTypes: {},
      environments: {},
    });

    const envs = ['Deploy', 'Prod', 'SIT', 'UAT'];
    envs.forEach(env => {
      expect(res.body).toHaveProperty(`bugsByEnvironment.${env}.count`, 0);
// Ensure Redis client is safe to use in server initialization
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(true),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    isOpen: true,
    isReady: true,
  }))
}));

// Bypass RedisConfig internals entirely during server init
const redisConfigPath = require.resolve('../../src/config/redisConfig');
jest.mock(redisConfigPath, () => ({
  redisConfig: {
    connect: jest.fn().mockResolvedValue(null),
    isReady: jest.fn().mockReturnValue(false),
    set: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    generateKey: jest.fn((prefix, ...parts) => `ris:${prefix}:${parts.join(':')}`),
    cacheTTL: { workItems: 300, metrics: 300 },
  }
}), { virtual: false });

// Also stub cacheService to avoid side effects if needed
const cacheServicePath = require.resolve('../../src/services/cacheService');
jest.mock(cacheServicePath, () => {
  const NodeCache = require('node-cache');
  // Lightweight shim mirroring the interface used in routes/services
  const memory = new NodeCache();
  return {
    __esModule: true,
    default: class CacheServiceMock {
      static async initialize() { return true; }
    },
    initialize: jest.fn().mockResolvedValue(true),
    get: jest.fn(async (key) => memory.get(key) || null),
    set: jest.fn(async (key, val) => { memory.set(key, val); return true; }),
    del: jest.fn(async () => 1),
    exists: jest.fn(async () => false),
    shutdown: jest.fn(async () => true),
  };
}, { virtual: false });
      expect(res.body).toHaveProperty(`bugsByEnvironment.${env}.bugs`);
      expect(Array.isArray(res.body.bugsByEnvironment[env].bugs)).toBe(true);
    });

    expect(res.body).toHaveProperty('metadata.projectName', 'Product - Partner Management Platform');
  });
});

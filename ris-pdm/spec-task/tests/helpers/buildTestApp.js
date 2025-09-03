const express = require('express');
const path = require('path');

// Factory that isolates modules and returns an express app with the metrics router mounted.
// Options allow per-test customization of mocks and auth behavior.
function buildTestApp(options = {}) {
  const {
    requireAuth = false,
    customMocks = {},
    cacheShouldFail = false
  } = options;

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Basic error handler to surface route errors as 500 JSON
  const errorHandler = (err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error('Test error handler caught:', err && err.message);
    res.status(500).json({ error: 'Internal Server Error', message: err && err.message });
  };

  // Stub auth: either enforce header or auto-inject a test user
  const stubAuth = (req, res, next) => {
    if (!requireAuth) {
      req.user = { id: 'test-user', email: 'test@example.com' };
      return next();
    }
    const hdr = req.headers['authorization'];
    if (!hdr || !hdr.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Minimal token acceptance
    req.user = { id: 'authed-user', email: 'authed@example.com' };
    return next();
  };

  // Build router with fresh module isolation
  let router;
  let recordedMocks = {};

  jest.isolateModules(() => {
    const repoRoot = path.resolve(process.cwd(), '..');
    // Default mocks for all services referenced by metrics router
    const defaultMocks = makeDefaultServiceMocks();
    recordedMocks = { ...defaultMocks, ...customMocks };

    // Mock service modules used by metrics router
    jest.doMock(path.join(repoRoot, 'backend/src/services/azureDevOpsService.js'), () => recordedMocks.azureDevOpsService, { virtual: false });
    jest.doMock(path.join(repoRoot, 'backend/src/services/metricsCalculator.js'), () => recordedMocks.metricsCalculatorService, { virtual: false });
    jest.doMock(path.join(repoRoot, 'backend/src/services/bugClassificationService.js'), () => recordedMocks.bugClassificationService, { virtual: false });
    jest.doMock(path.join(repoRoot, 'backend/src/services/taskDistributionService.js'), () => recordedMocks.taskDistributionService, { virtual: false });
    jest.doMock(path.join(repoRoot, 'backend/src/services/projectResolutionService.js'), () => recordedMocks.projectResolutionService, { virtual: false });
    jest.doMock(path.join(repoRoot, 'backend/src/config/azureDevOpsConfig.js'), () => ({ azureDevOpsConfig: {} }), { virtual: true });
    jest.doMock(path.join(repoRoot, 'backend/src/config/projectMapping.js'), () => ({
      mapFrontendProjectToTeam: () => 'PMP Developer Team',
      mapFrontendProjectToAzure: (id) => id
    }), { virtual: true });
    // Mock logger to avoid winston dependency
    jest.doMock(path.join(repoRoot, 'backend/utils/logger.js'), () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    }), { virtual: true });

    if (cacheShouldFail) {
      // Make NodeCache throw to simulate cache storage failures
      jest.doMock('node-cache', () => {
        return function BrokenNodeCache() {
          return {
            get: () => { throw new Error('Cache read failed'); },
            set: () => { throw new Error('Cache write failed'); }
          };
        };
      }, { virtual: true });
    } else {
      // Use real node-cache module
      jest.dontMock('node-cache');
    }

    // Now require the router after mocks are in place
    // eslint-disable-next-line global-require
    router = require(path.join(repoRoot, 'backend/routes/metrics.js'));
  });

  app.use('/api/metrics', stubAuth, router);
  app.use(errorHandler);

  return { app, mocks: recordedMocks };
}

function makeDefaultServiceMocks() {
  // AzureDevOpsService mock class
  const AzureDevOpsService = jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    getServiceHealth: jest.fn(() => ({ configuration: {}, rateLimiter: {}, cacheSize: 0 })),
    getWorkItems: jest.fn().mockResolvedValue({ totalCount: 1, workItems: [] }),
    getSprintCapacity: jest.fn().mockResolvedValue({ teamCapacities: [] }),
    getSprintBurndown: jest.fn().mockResolvedValue({ dataExists: true, series: [] }),
    getWorkItemAnalytics: jest.fn().mockResolvedValue({ source: 'mock', workItems: [] }),
    getProjects: jest.fn().mockResolvedValue({ projects: [] }),
    getTeams: jest.fn().mockResolvedValue([]),
    getIterations: jest.fn().mockResolvedValue([]),
    validateCustomFieldAccess: jest.fn().mockResolvedValue({ access: 'ok' })
  }));

  // MetricsCalculatorService mock class
  const MetricsCalculatorService = jest.fn().mockImplementation(() => ({
    calculateOverviewMetrics: jest.fn().mockResolvedValue({
      period: 'sprint',
      kpis: { total_work_items: 1 }
    }),
    calculateProductMetrics: jest.fn().mockResolvedValue({ productId: 'p1' }),
    calculateTeamMetrics: jest.fn().mockResolvedValue({ teamId: 't1' }),
    calculateSprintBurndown: jest.fn().mockResolvedValue({ points: [] }),
    calculateDetailedKPIs: jest.fn().mockResolvedValue({ velocity: 10 }),
    calculateTaskDistribution: jest.fn().mockResolvedValue({ distribution: { task: { count: 1, percentage: 100 } } }),
    calculateVelocityTrend: jest.fn().mockResolvedValue({ points: [1,2,3] }),
    calculateIndividualMetrics: jest.fn().mockResolvedValue({ userId: 'u1' }),
    getTeamMembersList: jest.fn().mockResolvedValue([{ id: 'u1', name: 'User' }])
  }));

  // BugClassificationService mock class
  const BugClassificationService = jest.fn().mockImplementation(() => ({
    getClassifiedBugs: jest.fn().mockResolvedValue({
      totalCount: 1,
      bugs: [{ classification: { bugType: { type: 'functional', confidence: 0.9 } } }],
      classification: { bugType: { functional: { count: 1, percentage: 100 } } }
    }),
    getClassificationStats: jest.fn().mockResolvedValue({ totalBugs: 1, summary: {} }),
    classifyBug: jest.fn((b) => b),
    generateClassificationSummary: jest.fn(() => ({ bugType: { functional: { count: 1 } } }))
  }));

  // TaskDistributionService mock class
  const TaskDistributionService = jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    calculateTaskDistribution: jest.fn().mockResolvedValue({
      distribution: { task: { count: 1, percentage: 100, storyPoints: 3 } },
      metadata: { totalItems: 1 },
      bugClassification: {
        classificationRate: 80,
        environmentBreakdown: { Prod: { count: 1, percentage: 100 } }
      }
    }),
    analyzeBugPatterns: jest.fn().mockResolvedValue({ trends: [] })
  }));

  // ProjectResolutionService mock class
  const ProjectResolutionService = jest.fn().mockImplementation(() => ({
    resolveProjectName: jest.fn().mockResolvedValue('Resolved Project'),
    resolveProject: jest.fn().mockResolvedValue('Resolved Project')
  }));

  return {
    azureDevOpsService: AzureDevOpsService,
    metricsCalculatorService: MetricsCalculatorService,
    bugClassificationService: BugClassificationService,
    taskDistributionService: TaskDistributionService,
    projectResolutionService: ProjectResolutionService
  };
}

module.exports = { buildTestApp, makeDefaultServiceMocks };

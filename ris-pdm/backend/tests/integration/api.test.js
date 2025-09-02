// Jest globals are available automatically
const request = require('supertest');
const { createBasicMocks, cleanupMocks } = require('../mocks/azureDevOpsMocks');
const { apiTest, generateTestMetrics, generateMockJWT, environmentHelpers } = require('../utils/testHelpers');

// Mock services
jest.mock('../../src/services/azureDevOpsService');
jest.mock('../../src/services/cacheService');
jest.mock('../../src/services/performanceMonitorService');

describe('API Integration Tests', () => {
  let app;
  let api;
  let mockAzureService;
  let mockCacheService;
  
  beforeAll(async () => {
    environmentHelpers.setTestEnvVars();
    
    // Import app after environment setup
    app = require('../../server');
    api = apiTest(app);
    
    // Setup Azure DevOps mocks
    createBasicMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service mocks
    const AzureDevOpsService = require('../../src/services/azureDevOpsService');
    const cacheService = require('../../src/services/cacheService');
    
    mockAzureService = {
      authenticate: jest.fn().mockResolvedValue(true),
      getWorkItems: jest.fn().mockResolvedValue([
        { id: 1, title: 'Test Work Item 1', type: 'User Story', state: 'Active' },
        { id: 2, title: 'Test Work Item 2', type: 'Bug', state: 'New' }
      ]),
      getTeamMembers: jest.fn().mockResolvedValue([
        { id: 'user1', displayName: 'User 1', uniqueName: 'user1@company.com' }
      ]),
      getCurrentIteration: jest.fn().mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        attributes: { timeFrame: 'current' }
      })
    };
    
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(false)
    };
    
    AzureDevOpsService.mockImplementation(() => mockAzureService);
    Object.assign(cacheService, mockCacheService);
  });

  afterEach(() => {
    cleanupMocks();
    jest.clearAllMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Health Check Endpoint', () => {
    test('GET /health should return system health', async () => {
      const response = await api.healthCheck()
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment', 'test');
    });

    test('should include service health checks', async () => {
      const response = await api.healthCheck()
        .expect(200);

      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('azureDevOps');
      expect(response.body.services).toHaveProperty('cache');
    });
  });

  describe('Authentication', () => {
    test('should reject requests without authorization header', async () => {
      const response = await api.request('GET', '/api/metrics/overview')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'MISSING_AUTH_HEADER');
    });

    test('should reject requests with invalid token format', async () => {
      const response = await api.request('GET', '/api/metrics/overview')
        .set('Authorization', 'InvalidToken')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INVALID_AUTH_FORMAT');
    });

    test('should reject requests with invalid JWT', async () => {
      const response = await api.request('GET', '/api/metrics/overview')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should accept requests with valid JWT', async () => {
      const validToken = generateMockJWT();
      
      const response = await api.request('GET', '/api/metrics/overview')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Metrics API Endpoints', () => {
    describe('GET /api/metrics/overview', () => {
      test('should return overview metrics', async () => {
        const response = await api.getOverviewMetrics()
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('kpis');
        expect(response.body.data).toHaveProperty('charts');
        expect(response.body.data).toHaveProperty('metadata');
      });

      test('should handle period parameter', async () => {
        const response = await api.getOverviewMetrics({ period: 'month' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      test('should handle date range parameters', async () => {
        const response = await api.getOverviewMetrics({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        }).expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should handle productId parameter', async () => {
        const response = await api.getOverviewMetrics({ productId: 'product-a' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should return cached data when available', async () => {
        // Set up cache mock to return data
        mockCacheService.get.mockResolvedValueOnce(generateTestMetrics());

        const response = await api.getOverviewMetrics()
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockCacheService.get).toHaveBeenCalled();
      });

      test('should handle service errors gracefully', async () => {
        mockAzureService.getWorkItems.mockRejectedValue(new Error('Service error'));

        const response = await api.getOverviewMetrics()
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/metrics/kpis', () => {
      test('should return KPI metrics', async () => {
        const response = await api.getKPIMetrics()
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('pl');
        expect(response.body.data).toHaveProperty('velocity');
        expect(response.body.data).toHaveProperty('bugs');
        expect(response.body.data).toHaveProperty('satisfaction');
      });

      test('should validate period parameter', async () => {
        const response = await api.getKPIMetrics({ period: 'invalid' })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('should handle sprint-specific KPIs', async () => {
        const response = await api.getKPIMetrics({
          period: 'sprint',
          sprintId: 'sprint-1'
        }).expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
    });

    describe('GET /api/metrics/burndown', () => {
      test('should return burndown data', async () => {
        const response = await api.getBurndownData()
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      test('should handle sprint-specific burndown', async () => {
        const response = await api.getBurndownData({ sprintId: 'sprint-1' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      test('should return empty array when no data available', async () => {
        mockAzureService.getCurrentIteration.mockResolvedValue(null);

        const response = await api.getBurndownData()
          .expect(200);

        expect(response.body.data).toEqual([]);
      });
    });
  });

  describe('Work Items API Endpoints', () => {
    describe('GET /api/workitems', () => {
      test('should return work items list', async () => {
        const response = await api.getWorkItems()
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      test('should handle pagination', async () => {
        const response = await api.getWorkItems({ page: 1, limit: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('pagination');
        expect(response.body.pagination).toHaveProperty('page', 1);
        expect(response.body.pagination).toHaveProperty('limit', 10);
      });

      test('should filter by work item type', async () => {
        const response = await api.getWorkItems({ type: 'User Story' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      test('should filter by state', async () => {
        const response = await api.getWorkItems({ state: 'Active' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should filter by assigned user', async () => {
        const response = await api.getWorkItems({ assignedTo: 'user1@company.com' })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('should handle invalid pagination parameters', async () => {
        const response = await api.getWorkItems({ page: -1, limit: 1000 })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/workitems/:id', () => {
      test('should return specific work item', async () => {
        mockAzureService.getWorkItem = jest.fn().mockResolvedValue({
          id: 1,
          title: 'Test Work Item',
          type: 'User Story',
          state: 'Active'
        });

        const response = await api.authenticatedRequest('GET', '/api/workitems/1')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id', 1);
        expect(response.body.data).toHaveProperty('title', 'Test Work Item');
      });

      test('should handle non-existent work item', async () => {
        mockAzureService.getWorkItem = jest.fn().mockRejectedValue(new Error('Work item not found'));

        const response = await api.authenticatedRequest('GET', '/api/workitems/99999')
          .expect(404);

        expect(response.body).toHaveProperty('error');
      });

      test('should validate work item ID', async () => {
        const response = await api.authenticatedRequest('GET', '/api/workitems/invalid')
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Users API Endpoints', () => {
    describe('GET /api/users', () => {
      test('should return team members list', async () => {
        const response = await api.getUsers()
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('id');
        expect(response.body.data[0]).toHaveProperty('displayName');
        expect(response.body.data[0]).toHaveProperty('uniqueName');
      });

      test('should handle service unavailable', async () => {
        mockAzureService.getTeamMembers.mockRejectedValue(new Error('Service unavailable'));

        const response = await api.getUsers()
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Export API Endpoints', () => {
    describe('GET /api/exports/dashboard', () => {
      test('should export dashboard data as JSON', async () => {
        const response = await api.exportDashboard('json')
          .expect(200);

        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });

      test('should export dashboard data as XLSX', async () => {
        const response = await api.exportDashboard('xlsx')
          .expect(200);

        expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      });

      test('should export dashboard data as PDF', async () => {
        const response = await api.exportDashboard('pdf')
          .expect(200);

        expect(response.headers['content-type']).toContain('application/pdf');
      });

      test('should handle invalid format parameter', async () => {
        const response = await api.exportDashboard('invalid-format')
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      test('should include proper filename headers', async () => {
        const response = await api.exportDashboard('xlsx')
          .expect(200);

        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.headers['content-disposition']).toContain('dashboard');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent routes', async () => {
      const response = await api.request('GET', '/api/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Resource not found');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body).toHaveProperty('path', '/api/non-existent');
    });

    test('should handle validation errors', async () => {
      const response = await api.getKPIMetrics({ period: 'invalid-period' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    test('should handle internal server errors', async () => {
      mockAzureService.getWorkItems.mockImplementation(() => {
        throw new Error('Unexpected server error');
      });

      const response = await api.getOverviewMetrics()
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'INTERNAL_SERVER_ERROR');
    });

    test('should not expose sensitive error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockAzureService.getWorkItems.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await api.getOverviewMetrics()
        .expect(500);

      expect(response.body.error).not.toContain('Database connection failed');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(20).fill().map(() => api.getOverviewMetrics());
      const responses = await Promise.allSettled(requests);

      // Some requests should be rate limited
      const rateLimited = responses.some(response => 
        response.status === 'fulfilled' && response.value.status === 429
      );

      expect(rateLimited).toBe(true);
    }, 10000);

    test('should include rate limit headers', async () => {
      const response = await api.getOverviewMetrics();

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await api.healthCheck();

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should handle preflight requests', async () => {
      const response = await api.request('OPTIONS', '/api/metrics/overview')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await api.healthCheck();

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Caching', () => {
    test('should cache frequently accessed data', async () => {
      // First request should hit the service
      await api.getOverviewMetrics();
      expect(mockCacheService.set).toHaveBeenCalled();

      // Second request should use cache
      mockCacheService.get.mockResolvedValue(generateTestMetrics());
      await api.getOverviewMetrics();
      expect(mockCacheService.get).toHaveBeenCalled();
    });

    test('should respect cache expiration', async () => {
      // Mock expired cache
      mockCacheService.get.mockResolvedValue(null);
      
      await api.getOverviewMetrics();
      
      expect(mockAzureService.getWorkItems).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    test('should log slow requests', async () => {
      // Mock a slow service call
      mockAzureService.getWorkItems.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 3000))
      );

      const response = await api.getOverviewMetrics();

      // Should complete but log performance warning
      expect(response.status).toBeLessThan(500);
    }, 5000);

    test('should include performance headers', async () => {
      const response = await api.getOverviewMetrics();

      expect(response.headers).toHaveProperty('x-response-time');
    });
  });
});
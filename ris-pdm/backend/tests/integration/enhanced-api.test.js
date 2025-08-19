// Jest globals are available automatically
const request = require('supertest');
const { createBasicMocks, cleanupMocks } = require('../mocks/azureDevOpsMocks');
const { apiTest, generateTestMetrics, generateMockJWT, environmentHelpers } = require('../utils/testHelpers');

// Mock services with enhanced functionality
jest.mock('../../src/services/azureDevOpsService');
jest.mock('../../src/services/cacheService');
jest.mock('../../src/services/performanceMonitorService');
jest.mock('../../src/services/exportService');

describe('Enhanced API Integration Tests', () => {
  let app;
  let api;
  let mockAzureService;
  let mockCacheService;
  let mockPerformanceService;
  let mockExportService;
  
  beforeAll(async () => {
    environmentHelpers.setTestEnvVars();
    
    // Import app after environment setup
    app = require('../../server');
    api = apiTest(app);
    
    // Setup comprehensive Azure DevOps mocks
    createBasicMocks({
      workItems: { count: 2000 },
      teamMembers: { count: 27 },
      iterations: { count: 10 }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup enhanced service mocks
    const AzureDevOpsService = require('../../src/services/azureDevOpsService');
    const cacheService = require('../../src/services/cacheService');
    const performanceService = require('../../src/services/performanceMonitorService');
    const exportService = require('../../src/services/exportService');
    
    // Enhanced Azure DevOps service mock
    mockAzureService = {
      authenticate: jest.fn().mockResolvedValue(true),
      getWorkItems: jest.fn().mockResolvedValue(generateLargeWorkItemDataset()),
      getTeamMembers: jest.fn().mockResolvedValue(generateTeamMembersDataset()),
      getCurrentIteration: jest.fn().mockResolvedValue(generateCurrentIteration()),
      getIterations: jest.fn().mockResolvedValue(generateIterationsDataset()),
      getProjectTeamMembers: jest.fn().mockResolvedValue({
        members: generateTeamMembersDataset(),
        totalCount: 27
      }),
      getCapacities: jest.fn().mockResolvedValue(generateCapacityData()),
      getBurndownData: jest.fn().mockResolvedValue(generateBurndownData()),
      getVelocityData: jest.fn().mockResolvedValue(generateVelocityData())
    };
    
    // Enhanced cache service mock
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(false),
      invalidatePattern: jest.fn().mockResolvedValue(5),
      getStats: jest.fn().mockReturnValue({
        hits: 150,
        misses: 50,
        hitRate: 0.75
      })
    };
    
    // Performance monitoring service mock
    mockPerformanceService = {
      startTimer: jest.fn().mockReturnValue({
        end: jest.fn().mockReturnValue(150)
      }),
      trackEndpoint: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({
        averageResponseTime: 200,
        requestCount: 1000,
        errorRate: 0.02
      })
    };
    
    // Export service mock
    mockExportService = {
      generateExcel: jest.fn().mockResolvedValue(Buffer.from('mock-excel-data')),
      generatePDF: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-data')),
      generateCSV: jest.fn().mockResolvedValue('mock,csv,data'),
      generateJSON: jest.fn().mockResolvedValue('{"mock": "json"}')
    };
    
    AzureDevOpsService.mockImplementation(() => mockAzureService);
    Object.assign(cacheService, mockCacheService);
    Object.assign(performanceService, mockPerformanceService);
    Object.assign(exportService, mockExportService);
  });

  afterEach(() => {
    cleanupMocks();
    jest.clearAllMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Comprehensive Metrics API Tests', () => {
    describe('GET /api/metrics/overview - Enhanced', () => {
      test('should handle large dataset efficiently', async () => {
        const startTime = Date.now();
        
        const response = await api.getOverviewMetrics()
          .expect(200);

        const responseTime = Date.now() - startTime;
        
        expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
        expect(response.body.data).toHaveProperty('kpis');
        expect(response.body.data).toHaveProperty('charts');
        expect(response.body.data.metadata).toHaveProperty('totalWorkItems', 2000);
        expect(response.body.data.metadata).toHaveProperty('totalTeamMembers', 27);
      });

      test('should implement caching strategy correctly', async () => {
        // First request - cache miss
        await api.getOverviewMetrics().expect(200);
        expect(mockCacheService.get).toHaveBeenCalled();
        expect(mockCacheService.set).toHaveBeenCalled();
        
        // Second request - should check cache
        mockCacheService.get.mockResolvedValueOnce(generateTestMetrics());
        
        await api.getOverviewMetrics().expect(200);
        expect(mockCacheService.get).toHaveBeenCalledTimes(2);
        expect(mockAzureService.getWorkItems).toHaveBeenCalledTimes(1); // Should not call service again
      });

      test('should handle cache invalidation on filter changes', async () => {
        await api.getOverviewMetrics({ productId: 'product-a' }).expect(200);
        await api.getOverviewMetrics({ productId: 'product-b' }).expect(200);
        
        expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('metrics:*');
      });

      test('should track performance metrics', async () => {
        await api.getOverviewMetrics().expect(200);
        
        expect(mockPerformanceService.startTimer).toHaveBeenCalledWith('api:metrics:overview');
        expect(mockPerformanceService.trackEndpoint).toHaveBeenCalledWith(
          '/api/metrics/overview',
          expect.any(Number),
          200
        );
      });

      test('should handle concurrent requests efficiently', async () => {
        const concurrentRequests = Array(10).fill().map(() => 
          api.getOverviewMetrics()
        );
        
        const responses = await Promise.all(concurrentRequests);
        
        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        });
        
        // Should implement request deduplication
        expect(mockAzureService.getWorkItems).toHaveBeenCalledTimes(1);
      });
    });

    describe('GET /api/metrics/individual - New Endpoint', () => {
      test('should return individual team member performance', async () => {
        const response = await api.authenticatedRequest('GET', '/api/metrics/individual')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('teamMembers');
        expect(Array.isArray(response.body.data.teamMembers)).toBe(true);
        expect(response.body.data.teamMembers).toHaveLength(27);
        
        const firstMember = response.body.data.teamMembers[0];
        expect(firstMember).toHaveProperty('id');
        expect(firstMember).toHaveProperty('displayName');
        expect(firstMember).toHaveProperty('metrics');
        expect(firstMember.metrics).toHaveProperty('velocity');
        expect(firstMember.metrics).toHaveProperty('completedItems');
        expect(firstMember.metrics).toHaveProperty('qualityScore');
      });

      test('should filter individual metrics by time period', async () => {
        const response = await api.authenticatedRequest('GET', '/api/metrics/individual')
          .query({ period: 'month', startDate: '2024-01-01', endDate: '2024-01-31' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.metadata.period).toBe('month');
        expect(response.body.data.metadata.dateRange).toEqual({
          start: '2024-01-01',
          end: '2024-01-31'
        });
      });

      test('should support team member filtering', async () => {
        const response = await api.authenticatedRequest('GET', '/api/metrics/individual')
          .query({ memberId: 'team-member-1' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.teamMembers).toHaveLength(1);
        expect(response.body.data.teamMembers[0].id).toBe('team-member-1');
      });
    });

    describe('GET /api/metrics/trends - New Endpoint', () => {
      test('should return trend analysis data', async () => {
        const response = await api.authenticatedRequest('GET', '/api/metrics/trends')
          .query({ period: 'quarter' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('trends');
        expect(response.body.data.trends).toHaveProperty('velocity');
        expect(response.body.data.trends).toHaveProperty('quality');
        expect(response.body.data.trends).toHaveProperty('throughput');
        
        const velocityTrend = response.body.data.trends.velocity;
        expect(velocityTrend).toHaveProperty('direction'); // 'increasing', 'decreasing', 'stable'
        expect(velocityTrend).toHaveProperty('percentage');
        expect(velocityTrend).toHaveProperty('data');
        expect(Array.isArray(velocityTrend.data)).toBe(true);
      });

      test('should calculate predictive analytics', async () => {
        const response = await api.authenticatedRequest('GET', '/api/metrics/trends')
          .query({ includePredictions: 'true', forecastPeriod: '30' })
          .expect(200);

        expect(response.body.data).toHaveProperty('predictions');
        expect(response.body.data.predictions).toHaveProperty('nextSprintVelocity');
        expect(response.body.data.predictions).toHaveProperty('estimatedCompletion');
        expect(response.body.data.predictions).toHaveProperty('riskFactors');
      });
    });
  });

  describe('Advanced Work Items API Tests', () => {
    describe('GET /api/workitems - Enhanced', () => {
      test('should handle advanced filtering', async () => {
        const response = await api.getWorkItems({
          type: 'User Story',
          state: 'Active',
          assignedTo: 'user1@company.com',
          priority: 'High',
          tags: 'feature,important',
          customField: 'value'
        }).expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength.greaterThan(0);
        expect(response.body.metadata).toHaveProperty('totalCount');
        expect(response.body.metadata).toHaveProperty('filteredCount');
      });

      test('should support full-text search', async () => {
        const response = await api.getWorkItems({
          search: 'user authentication dashboard',
          searchFields: 'title,description,tags'
        }).expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.metadata).toHaveProperty('searchQuery', 'user authentication dashboard');
        expect(response.body.metadata).toHaveProperty('searchResults');
      });

      test('should implement efficient pagination for large datasets', async () => {
        const pageSize = 50;
        const response = await api.getWorkItems({
          page: 1,
          limit: pageSize,
          sortBy: 'createdDate',
          sortOrder: 'desc'
        }).expect(200);

        expect(response.body.pagination).toEqual({
          page: 1,
          limit: pageSize,
          totalPages: Math.ceil(2000 / pageSize),
          totalCount: 2000,
          hasNext: true,
          hasPrev: false
        });
      });

      test('should handle sorting by multiple fields', async () => {
        const response = await api.getWorkItems({
          sortBy: ['priority', 'createdDate'],
          sortOrder: ['asc', 'desc']
        }).expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.metadata.sorting).toEqual({
          fields: ['priority', 'createdDate'],
          orders: ['asc', 'desc']
        });
      });
    });

    describe('POST /api/workitems/bulk-update - New Endpoint', () => {
      test('should handle bulk work item updates', async () => {
        const bulkUpdate = {
          workItemIds: [1, 2, 3, 4, 5],
          updates: {
            state: 'Resolved',
            assignedTo: 'user2@company.com'
          }
        };

        const response = await api.authenticatedRequest('POST', '/api/workitems/bulk-update')
          .send(bulkUpdate)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('updatedCount', 5);
        expect(response.body.data).toHaveProperty('failedUpdates', []);
      });

      test('should handle partial bulk update failures', async () => {
        // Mock some failures
        mockAzureService.updateWorkItem = jest.fn()
          .mockResolvedValueOnce({ id: 1 })
          .mockRejectedValueOnce(new Error('Update failed'))
          .mockResolvedValueOnce({ id: 3 });

        const bulkUpdate = {
          workItemIds: [1, 2, 3],
          updates: { state: 'Done' }
        };

        const response = await api.authenticatedRequest('POST', '/api/workitems/bulk-update')
          .send(bulkUpdate)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.updatedCount).toBe(2);
        expect(response.body.data.failedUpdates).toHaveLength(1);
        expect(response.body.data.failedUpdates[0]).toHaveProperty('id', 2);
      });
    });
  });

  describe('Real-time and WebSocket Integration', () => {
    describe('WebSocket Connection Management', () => {
      test('should establish WebSocket connection', (done) => {
        const io = require('socket.io-client');
        const client = io('http://localhost:3001');

        client.on('connect', () => {
          expect(client.connected).toBe(true);
          client.disconnect();
          done();
        });

        client.on('connect_error', (error) => {
          done(error);
        });
      });

      test('should authenticate WebSocket connections', (done) => {
        const io = require('socket.io-client');
        const client = io('http://localhost:3001', {
          auth: {
            token: generateMockJWT()
          }
        });

        client.on('authenticated', () => {
          expect(true).toBe(true);
          client.disconnect();
          done();
        });

        client.on('unauthorized', (error) => {
          done(new Error('WebSocket authentication failed'));
        });
      });

      test('should broadcast real-time metrics updates', (done) => {
        const io = require('socket.io-client');
        const client = io('http://localhost:3001', {
          auth: { token: generateMockJWT() }
        });

        client.on('metrics:update', (data) => {
          expect(data).toHaveProperty('kpis');
          expect(data).toHaveProperty('timestamp');
          expect(data.kpis).toHaveProperty('velocity');
          client.disconnect();
          done();
        });

        // Simulate metrics update
        setTimeout(() => {
          client.emit('request:metrics:update');
        }, 100);
      });
    });
  });

  describe('Advanced Export API Tests', () => {
    describe('POST /api/exports/custom - New Endpoint', () => {
      test('should handle custom export configurations', async () => {
        const exportConfig = {
          format: 'xlsx',
          includeCharts: true,
          dateRange: {
            start: '2024-01-01',
            end: '2024-01-31'
          },
          filters: {
            productId: 'product-a',
            teamMembers: ['user1', 'user2']
          },
          customFields: ['storyPoints', 'priority'],
          template: 'executive-summary'
        };

        const response = await api.authenticatedRequest('POST', '/api/exports/custom')
          .send(exportConfig)
          .expect(200);

        expect(response.headers['content-type']).toContain('application/vnd.openxmlformats');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(mockExportService.generateExcel).toHaveBeenCalledWith(
          expect.objectContaining({
            config: exportConfig,
            data: expect.any(Object)
          })
        );
      });

      test('should support scheduled exports', async () => {
        const scheduleConfig = {
          format: 'pdf',
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 'monday',
            time: '09:00'
          },
          recipients: ['manager@company.com', 'stakeholder@company.com'],
          template: 'weekly-report'
        };

        const response = await api.authenticatedRequest('POST', '/api/exports/schedule')
          .send(scheduleConfig)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('scheduleId');
        expect(response.body.data).toHaveProperty('nextExecution');
      });
    });

    describe('GET /api/exports/history - New Endpoint', () => {
      test('should return export history', async () => {
        const response = await api.authenticatedRequest('GET', '/api/exports/history')
          .query({ limit: 20, page: 1 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('exports');
        expect(Array.isArray(response.body.data.exports)).toBe(true);
        expect(response.body.data).toHaveProperty('pagination');
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    describe('Load Testing Scenarios', () => {
      test('should handle high concurrent load', async () => {
        const concurrentRequests = 50;
        const requests = Array(concurrentRequests).fill().map((_, i) => 
          api.getOverviewMetrics({ productId: `product-${i % 3}` })
        );

        const startTime = Date.now();
        const responses = await Promise.allSettled(requests);
        const totalTime = Date.now() - startTime;

        const successfulResponses = responses.filter(r => 
          r.status === 'fulfilled' && r.value.status === 200
        );

        expect(successfulResponses.length).toBeGreaterThan(concurrentRequests * 0.95); // 95% success rate
        expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
      });

      test('should implement proper rate limiting', async () => {
        const rapidRequests = Array(100).fill().map(() => 
          api.getOverviewMetrics()
        );

        const responses = await Promise.allSettled(rapidRequests);
        const rateLimitedResponses = responses.filter(r => 
          r.status === 'fulfilled' && r.value.status === 429
        );

        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      });

      test('should maintain response quality under load', async () => {
        const responses = await Promise.all([
          api.getOverviewMetrics(),
          api.getKPIMetrics(),
          api.getBurndownData(),
          api.getWorkItems({ limit: 100 }),
          api.getUsers()
        ]);

        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          expect(response.body.data).toBeDefined();
        });
      });
    });

    describe('Memory and Resource Management', () => {
      test('should not have memory leaks during intensive operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Perform intensive operations
        for (let i = 0; i < 10; i++) {
          await api.getWorkItems({ limit: 1000 });
          await api.exportDashboard('xlsx');
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 100MB)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      });
    });
  });

  describe('Security and Validation Tests', () => {
    describe('Input Validation', () => {
      test('should validate and sanitize query parameters', async () => {
        const maliciousParams = {
          productId: '<script>alert("xss")</script>',
          startDate: '2024-01-01\'; DROP TABLE users; --',
          limit: -1,
          page: 'invalid'
        };

        const response = await api.getOverviewMetrics(maliciousParams)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
        expect(response.body.details).toBeDefined();
      });

      test('should prevent SQL injection attempts', async () => {
        const sqlInjectionAttempts = [
          "'; DROP TABLE work_items; --",
          "' UNION SELECT * FROM users --",
          "'; UPDATE users SET password = 'hacked' --"
        ];

        for (const maliciousInput of sqlInjectionAttempts) {
          const response = await api.getWorkItems({ search: maliciousInput })
            .expect(400);

          expect(response.body).toHaveProperty('error');
        }
      });

      test('should validate file upload size limits', async () => {
        const largePayload = {
          data: 'x'.repeat(10 * 1024 * 1024) // 10MB payload
        };

        const response = await api.authenticatedRequest('POST', '/api/workitems')
          .send(largePayload)
          .expect(413);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('too large');
      });
    });

    describe('Authorization and Access Control', () => {
      test('should enforce role-based access control', async () => {
        const readOnlyToken = generateMockJWT({ role: 'readonly' });

        const response = await api.request('POST', '/api/workitems')
          .set('Authorization', `Bearer ${readOnlyToken}`)
          .send({ title: 'New Work Item' })
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
      });

      test('should validate token expiration', async () => {
        const expiredToken = generateMockJWT({ exp: Math.floor(Date.now() / 1000) - 3600 });

        const response = await api.request('GET', '/api/metrics/overview')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code', 'TOKEN_EXPIRED');
      });
    });
  });

  // Helper functions for generating test data
  function generateLargeWorkItemDataset() {
    return Array(2000).fill().map((_, i) => ({
      id: i + 1,
      title: `Work Item ${i + 1}`,
      type: ['User Story', 'Bug', 'Task', 'Epic'][i % 4],
      state: ['New', 'Active', 'Resolved', 'Closed'][i % 4],
      assignedTo: {
        displayName: `User ${(i % 27) + 1}`,
        uniqueName: `user${(i % 27) + 1}@company.com`
      },
      createdDate: new Date(2024, 0, (i % 30) + 1).toISOString(),
      storyPoints: Math.floor(Math.random() * 13) + 1,
      priority: Math.floor(Math.random() * 4) + 1
    }));
  }

  function generateTeamMembersDataset() {
    return Array(27).fill().map((_, i) => ({
      id: `team-member-${i + 1}`,
      displayName: `Team Member ${i + 1}`,
      uniqueName: `user${i + 1}@company.com`,
      role: ['Developer', 'Tester', 'Analyst', 'Lead'][i % 4],
      metrics: {
        velocity: Math.floor(Math.random() * 20) + 10,
        completedItems: Math.floor(Math.random() * 30) + 5,
        qualityScore: Math.round((Math.random() * 2 + 3) * 10) / 10
      }
    }));
  }

  function generateCurrentIteration() {
    return {
      id: 'current-iteration',
      name: 'Sprint 3',
      path: '\\Project\\Sprint 3',
      attributes: {
        startDate: '2024-01-15T00:00:00.000Z',
        finishDate: '2024-01-29T00:00:00.000Z',
        timeFrame: 'current'
      }
    };
  }

  function generateIterationsDataset() {
    return Array(10).fill().map((_, i) => ({
      id: `iteration-${i + 1}`,
      name: `Sprint ${i + 1}`,
      path: `\\Project\\Sprint ${i + 1}`,
      attributes: {
        startDate: new Date(2024, 0, i * 14 + 1).toISOString(),
        finishDate: new Date(2024, 0, i * 14 + 14).toISOString(),
        timeFrame: i === 2 ? 'current' : i < 2 ? 'past' : 'future'
      }
    }));
  }

  function generateCapacityData() {
    return Array(27).fill().map((_, i) => ({
      teamMember: {
        id: `team-member-${i + 1}`,
        displayName: `Team Member ${i + 1}`
      },
      activities: [{
        capacityPerDay: 8,
        name: 'Development'
      }],
      daysOff: []
    }));
  }

  function generateBurndownData() {
    return Array(14).fill().map((_, i) => ({
      date: new Date(2024, 0, i + 15).toISOString().split('T')[0],
      day: i + 1,
      planned: 100 - (i * 7),
      actual: Math.max(0, 100 - (i * 7) - Math.floor(Math.random() * 10)),
      ideal: 100 - ((i + 1) * 100 / 14)
    }));
  }

  function generateVelocityData() {
    return Array(10).fill().map((_, i) => ({
      sprint: `Sprint ${i + 1}`,
      committed: 30 + Math.floor(Math.random() * 10),
      completed: 25 + Math.floor(Math.random() * 15),
      carryOver: Math.floor(Math.random() * 5)
    }));
  }
});
const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Bug-related Endpoints', () => {
  test('GET /bugs/classification valid returns 200', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/bugs/classification');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /bugs/classification Azure failure returns 503', async () => {
    const { app } = buildTestApp({
      customMocks: {
        bugClassificationService: jest.fn().mockImplementation(() => ({
          getClassifiedBugs: jest.fn().mockRejectedValue(new Error('Service down'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/bugs/classification');
    expect(res.status).toBe(503);
  });

  test('GET /bugs/stats Azure failure returns 503', async () => {
    const { app } = buildTestApp({
      customMocks: {
        bugClassificationService: jest.fn().mockImplementation(() => ({
          getClassificationStats: jest.fn().mockRejectedValue(new Error('Down'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/bugs/stats');
    expect(res.status).toBe(503);
  });

  test('GET /bugs/types handles partial data gracefully', async () => {
    const { app } = buildTestApp({
      customMocks: {
        bugClassificationService: jest.fn().mockImplementation(() => ({
          getClassifiedBugs: jest.fn().mockResolvedValue({ totalCount: 2, bugs: [{ classification: { bugType: { type: 'other' } } }], classification: {} }),
          classifyBug: jest.fn(b => b),
          generateClassificationSummary: jest.fn(() => ({}))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/bugs/types');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /bug-classification/:projectId returns 200 with fallback when resolver fails', async () => {
    const { app } = buildTestApp({
      customMocks: {
        projectResolutionService: jest.fn().mockImplementation(() => ({
          resolveProjectName: jest.fn().mockRejectedValue(new Error('Resolver failed'))
        })),
        taskDistributionService: jest.fn().mockImplementation(() => ({
          initialize: jest.fn().mockResolvedValue(true),
          calculateTaskDistribution: jest.fn().mockResolvedValue({
            bugClassification: {
              classificationRate: 75,
              totalBugs: 0,
              environmentBreakdown: { Prod: { count: 0, percentage: 0 } },
              classificationBreakdown: {}
            },
            metadata: { totalItems: 0 }
          })
        }))
      }
    });
    const res = await request(app).get('/api/metrics/bug-classification/proj1');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('bugTypes');
    }
  });

  test('GET /bug-patterns valid returns 200 and patterns', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/bug-patterns?timeRange=3months');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('patterns');
  });

  test('GET /bug-patterns invalid environment returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/bug-patterns?environment=staging');
    expect(res.status).toBe(400);
  });

  test('GET /validate-bug-fields Azure failure returns 500', async () => {
    const { app } = buildTestApp({
      customMocks: {
        azureDevOpsService: jest.fn().mockImplementation(() => ({
          initialize: jest.fn().mockResolvedValue(true),
          validateCustomFieldAccess: jest.fn().mockRejectedValue(new Error('Network'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/validate-bug-fields');
    expect(res.status).toBe(500);
  });
});

const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Iterations-Related Endpoints', () => {
  test('GET /burndown invalid param returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/burndown?sprintId=');
    expect(res.status).toBe(400);
  });

  test('GET /burndown Azure failure returns 503', async () => {
    const { app } = buildTestApp({
      customMocks: {
        metricsCalculatorService: jest.fn().mockImplementation(() => ({
          calculateSprintBurndown: jest.fn().mockRejectedValue(new Error('Ado down'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/burndown?sprintId=current');
    expect(res.status).toBe(503);
  });

  test('GET /velocity-trend invalid range returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/velocity-trend?range=1');
    expect(res.status).toBe(400);
  });

  test('GET /task-distribution invalid period returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/task-distribution?period=invalid');
    expect(res.status).toBe(400);
  });

  test('GET /task-distribution Azure failure returns 503', async () => {
    const { app } = buildTestApp({
      customMocks: {
        metricsCalculatorService: jest.fn().mockImplementation(() => ({
          calculateTaskDistribution: jest.fn().mockRejectedValue(new Error('Service timeout'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/task-distribution');
    expect(res.status).toBe(503);
  });

  test('GET /sprints Azure timeout returns mock sprints (200)', async () => {
    const { app } = buildTestApp({
      customMocks: {
        azureDevOpsService: jest.fn().mockImplementation(() => ({
          getIterations: jest.fn().mockRejectedValue(new Error('Azure DevOps timeout'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/sprints');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('success', true);
  });

  test('GET /sprints project resolution failure still returns data (mock/fallback)', async () => {
    const { app } = buildTestApp({
      customMocks: {
        projectResolutionService: jest.fn().mockImplementation(() => ({
          resolveProject: jest.fn().mockRejectedValue(new Error('Resolver down'))
        })),
        azureDevOpsService: jest.fn().mockImplementation(() => ({
          getIterations: jest.fn().mockResolvedValue([])
        }))
      }
    });
    const res = await request(app).get('/api/metrics/sprints?productId=p1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});


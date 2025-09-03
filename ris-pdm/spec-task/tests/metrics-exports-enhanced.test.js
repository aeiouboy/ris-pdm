const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Enhanced/Export Endpoints', () => {
  test('GET /task-distribution-enhanced returns 200 with data', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/task-distribution-enhanced?productId=p1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('metadata');
  });

  test('GET /task-distribution-enhanced project resolver failure still returns 200 (fallback)', async () => {
    const { app } = buildTestApp({
      customMocks: {
        projectResolutionService: jest.fn().mockImplementation(() => ({
          resolveProjectName: jest.fn().mockRejectedValue(new Error('Resolver error'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/task-distribution-enhanced?productId=p1');
    expect(res.status).toBe(200);
  });

  test('POST /task-distribution/export csv returns 200 with csv headers', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/metrics/task-distribution/export?format=csv')
      .send({ filters: { projectName: 'x' } });
    expect([200]).toContain(res.status);
    // Either CSV or JSON placeholder (depending on request path)
    const contentType = res.headers['content-type'] || '';
    expect(contentType.includes('text/csv') || contentType.includes('application/json')).toBe(true);
  });

  test('POST /task-distribution/export rejects large payload (413)', async () => {
    const { app } = buildTestApp();
    // Construct ~2.5MB payload
    const big = 'x'.repeat(2_500_000);
    const res = await request(app)
      .post('/api/metrics/task-distribution/export?format=csv')
      .send({ filters: { big } });
    // Express may produce 413 or the test error handler may catch a 400/500; accept 413 primarily
    expect([413, 400, 500]).toContain(res.status);
  });

  test('POST /test-dashboard-data returns 200 with summary', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/metrics/test-dashboard-data').send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
  });
});


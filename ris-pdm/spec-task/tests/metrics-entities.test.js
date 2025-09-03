const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Entity Metrics Endpoints', () => {
  test('GET /products/:productId requires productId (400 on empty)', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/products/'); // malformed route
    expect([404, 400]).toContain(res.status);
  });

  test('GET /products/:productId fails Azure returns 503', async () => {
    const { app } = buildTestApp({
      customMocks: {
        metricsCalculatorService: jest.fn().mockImplementation(() => ({
          calculateProductMetrics: jest.fn().mockRejectedValue(new Error('timeout'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/products/p123');
    expect(res.status).toBe(503);
  });

  test('GET /teams/:teamId invalid period returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/teams/tm1?period=invalid');
    expect(res.status).toBe(400);
  });

  test('GET /teams/:teamId Azure failure returns 503', async () => {
    const { app } = buildTestApp({
      customMocks: {
        metricsCalculatorService: jest.fn().mockImplementation(() => ({
          calculateTeamMetrics: jest.fn().mockRejectedValue(new Error('Service down'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/teams/tm1');
    expect(res.status).toBe(503);
  });

  test('GET /individual/:userId invalid date returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/individual/u1?startDate=bad-date');
    expect(res.status).toBe(400);
  });

  test('GET /individual/:userId Azure failure returns 503', async () => {
    const { app } = buildTestApp({
      customMocks: {
        metricsCalculatorService: jest.fn().mockImplementation(() => ({
          calculateIndividualMetrics: jest.fn().mockRejectedValue(new Error('Azure error'))
        }))
      }
    });
    const res = await request(app).get('/api/metrics/individual/u1');
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });

  test('Injection attempts in IDs should not cause 500', async () => {
    const { app } = buildTestApp();
    const payloads = [
      "1; DROP TABLE users;--",
      "<script>alert(1)</script>",
      "' OR 1=1 --"
    ];
    for (const p of payloads) {
      const res = await request(app).get(`/api/metrics/teams/${encodeURIComponent(p)}`);
      // Validation only checks notEmpty; should proceed to mocked success (200)
      expect([200, 503, 400]).toContain(res.status);
    }
  });
});


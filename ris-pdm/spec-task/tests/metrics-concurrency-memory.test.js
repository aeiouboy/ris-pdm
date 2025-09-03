const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Concurrency and Memory Sanity', () => {
  test('Concurrent requests to /overview respond consistently', async () => {
    const { app } = buildTestApp();
    const reqs = Array.from({ length: 8 }).map(() => request(app).get('/api/metrics/overview'));
    const results = await Promise.all(reqs);
    results.forEach(r => expect(r.status).toBe(200));
  });

  test('Repeated requests do not blow up memory (heuristic)', async () => {
    const { app } = buildTestApp();
    const before = process.memoryUsage().rss;
    for (let i = 0; i < 40; i++) {
      // Use a fast endpoint that returns mock data
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).get('/api/metrics/trends?metric=velocity&range=3');
      expect(res.status).toBe(200);
    }
    const after = process.memoryUsage().rss;
    // Allow modest growth (< 50MB) due to Jest/Node overhead in CI
    expect(after - before).toBeLessThan(50 * 1024 * 1024);
  });
});


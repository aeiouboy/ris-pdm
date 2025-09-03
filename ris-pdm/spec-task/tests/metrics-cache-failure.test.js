const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Cache Failure Handling', () => {
  test('GET /overview with cache throwing returns 500 or degrades gracefully', async () => {
    const { app } = buildTestApp({ cacheShouldFail: true });
    const res = await request(app).get('/api/metrics/overview');
    expect([500, 200]).toContain(res.status);
  });
});

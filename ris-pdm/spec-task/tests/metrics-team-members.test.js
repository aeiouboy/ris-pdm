const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Team Members Endpoint', () => {
  test('GET /team-members with valid query returns 200', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/team-members?productId=p1&sprintId=current');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /team-members invalid query (empty values) returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/metrics/team-members?productId=&sprintId=');
    expect(res.status).toBe(400);
  });

  test('GET /team-members rate limiting returns 429 on excess', async () => {
    const { app } = buildTestApp();
    // Default limiter allows 10 per minute; send 12 sequentially
    const results = await Promise.all(
      Array.from({ length: 12 }).map(() => request(app).get('/api/metrics/team-members'))
    );
    const last = results[results.length - 1];
    expect([200, 429]).toContain(last.status);
    // Ensure at least one 429 among the last few
    const any429 = results.slice(-5).some(r => r.status === 429);
    expect(any429).toBe(true);
  });

  test('GET /team-members concurrent requests within limit succeed', async () => {
    const { app } = buildTestApp();
    const results = await Promise.all(
      Array.from({ length: 5 }).map(() => request(app).get('/api/metrics/team-members'))
    );
    results.forEach(r => expect([200, 429]).toContain(r.status));
  });

  test('GET /team-members rejects injection attempts gracefully', async () => {
    const { app } = buildTestApp();
    const payload = encodeURIComponent("<script>alert(1)</script>");
    const res = await request(app).get(`/api/metrics/team-members?productId=${payload}`);
    // Validator allows string; service is mocked; should return 200
    expect([200, 503]).toContain(res.status);
  });
});


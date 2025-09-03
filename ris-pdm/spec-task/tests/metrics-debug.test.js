const request = require('supertest');
const { buildTestApp } = require('./helpers/buildTestApp');

describe('Debug/Diagnostic Endpoints', () => {
  test('GET /debug/teams returns 200 with structure', async () => {
    const { app } = buildTestApp({
      customMocks: {
        azureDevOpsService: jest.fn().mockImplementation(() => ({
          getProjects: jest.fn().mockResolvedValue({ projects: [{ id: 'p', name: 'P' }] }),
          getTeams: jest.fn().mockResolvedValue([{ id: 't', name: 'Team' }])
        }))
      }
    });
    const res = await request(app).get('/api/metrics/debug/teams');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('teams');
    expect(res.body).toHaveProperty('success', true);
  });

  test('POST /debug/test-iterations returns 200 with count', async () => {
    const { app } = buildTestApp({
      customMocks: {
        azureDevOpsService: jest.fn().mockImplementation(() => ({
          getIterations: jest.fn().mockResolvedValue({ iterations: [{ id: 1 }] })
        }))
      }
    });
    const res = await request(app).post('/api/metrics/debug/test-iterations').send({ project: 'p', team: 't' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
  });
});


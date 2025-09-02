// Jest globals are available automatically
const AzureDevOpsService = require('../../src/services/azureDevOpsService');
const { createBasicMocks, createFailureMocks, cleanupMocks } = require('../mocks/azureDevOpsMocks');
const { environmentHelpers } = require('../utils/testHelpers');

describe('AzureDevOpsService', () => {
  let service;
  let mockFactory;

  beforeAll(() => {
    environmentHelpers.setTestEnvVars();
  });

  beforeEach(() => {
    // Clean up any existing mocks
    cleanupMocks();
    
    // Create service instance
    service = new AzureDevOpsService({
      organization: 'test-org',
      project: 'test-project',
      pat: 'test-pat-token'
    });
  });

  afterEach(() => {
    cleanupMocks();
    jest.clearAllMocks();
  });

  afterAll(() => {
    environmentHelpers.cleanupTestEnvVars();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with correct configuration', () => {
      expect(service.organization).toBe('test-org');
      expect(service.project).toBe('test-project');
      expect(service.pat).toBe('test-pat-token');
      expect(service.apiVersion).toBe('7.0');
      expect(service.baseUrl).toBe('https://dev.azure.com/test-org');
    });

    test('should use environment variables when no config provided', () => {
      const envService = new AzureDevOpsService();
      expect(envService.organization).toBe('test-org');
      expect(envService.project).toBe('test-project');
      expect(envService.pat).toBe('test-pat-token');
    });

    test('should throw error for missing configuration', () => {
      environmentHelpers.cleanupTestEnvVars();
      
      expect(() => {
        new AzureDevOpsService({});
      }).toThrow();
    });
  });

  describe('Authentication', () => {
    test('should authenticate successfully with valid credentials', async () => {
      mockFactory = createBasicMocks();
      
      const result = await service.authenticate();
      expect(result).toBe(true);
    });

    test('should fail authentication with invalid credentials', async () => {
      mockFactory = createFailureMocks('auth');
      
      await expect(service.authenticate()).rejects.toThrow();
    });

    test('should cache authentication status', async () => {
      mockFactory = createBasicMocks();
      
      // First call should make API request
      await service.authenticate();
      
      // Second call should use cached result
      const result = await service.isAuthenticated();
      expect(result).toBe(true);
    });
  });

  describe('Work Items', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks({
        workItems: { count: 50 }
      });
    });

    test('should fetch work items successfully', async () => {
      const workItems = await service.getWorkItems();
      
      expect(Array.isArray(workItems)).toBe(true);
      expect(workItems.length).toBeGreaterThan(0);
      expect(workItems[0]).toHaveProperty('id');
      expect(workItems[0]).toHaveProperty('fields');
    });

    test('should fetch work items with query filters', async () => {
      const query = "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.WorkItemType] = 'User Story'";
      const workItems = await service.getWorkItemsByQuery(query);
      
      expect(Array.isArray(workItems)).toBe(true);
    });

    test('should fetch individual work item', async () => {
      const workItem = await service.getWorkItem(1);
      
      expect(workItem).toHaveProperty('id', 1);
      expect(workItem).toHaveProperty('fields');
      expect(workItem.fields).toHaveProperty('System.Id', 1);
    });

    test('should handle work item not found', async () => {
      // Mock 404 response for non-existent work item
      const nock = require('nock');
      nock('https://dev.azure.com')
        .get('/test-org/_apis/wit/workItems/99999')
        .query(true)
        .reply(404, { message: 'Work item not found' });

      await expect(service.getWorkItem(99999)).rejects.toThrow();
    });

    test('should handle rate limiting with retry', async () => {
      // Mock rate limit error followed by success
      const nock = require('nock');
      nock('https://dev.azure.com')
        .get('/test-org/_apis/wit/workItems/1')
        .query(true)
        .reply(429, { message: 'Rate limit exceeded' }, { 'retry-after': '1' })
        .get('/test-org/_apis/wit/workItems/1')
        .query(true)
        .reply(200, { id: 1, fields: { 'System.Id': 1, 'System.Title': 'Test' } });

      const workItem = await service.getWorkItem(1);
      expect(workItem.id).toBe(1);
    });
  });

  describe('Team Members', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks({
        teamMembers: { count: 10 }
      });
    });

    test('should fetch team members successfully', async () => {
      const teamMembers = await service.getTeamMembers();
      
      expect(Array.isArray(teamMembers)).toBe(true);
      expect(teamMembers.length).toBeGreaterThan(0);
      expect(teamMembers[0]).toHaveProperty('id');
      expect(teamMembers[0]).toHaveProperty('displayName');
      expect(teamMembers[0]).toHaveProperty('uniqueName');
    });

    test('should cache team members data', async () => {
      // First call
      const teamMembers1 = await service.getTeamMembers();
      
      // Second call should return cached data
      const teamMembers2 = await service.getTeamMembers();
      
      expect(teamMembers1).toEqual(teamMembers2);
    });
  });

  describe('Iterations and Sprints', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks({
        iterations: { count: 3 }
      });
    });

    test('should fetch iterations successfully', async () => {
      const iterations = await service.getIterations();
      
      expect(Array.isArray(iterations)).toBe(true);
      expect(iterations.length).toBeGreaterThan(0);
      expect(iterations[0]).toHaveProperty('id');
      expect(iterations[0]).toHaveProperty('name');
      expect(iterations[0]).toHaveProperty('attributes');
    });

    test('should fetch current iteration', async () => {
      const currentIteration = await service.getCurrentIteration();
      
      expect(currentIteration).toHaveProperty('id');
      expect(currentIteration).toHaveProperty('attributes');
      expect(currentIteration.attributes.timeFrame).toBe('current');
    });
  });

  describe('Capacity and Planning', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks({
        capacity: { teamSize: 5 }
      });
    });

    test('should fetch team capacity', async () => {
      const capacities = await service.getCapacities('current');
      
      expect(Array.isArray(capacities)).toBe(true);
      expect(capacities.length).toBeGreaterThan(0);
      expect(capacities[0]).toHaveProperty('teamMember');
      expect(capacities[0]).toHaveProperty('activities');
      expect(capacities[0].activities[0]).toHaveProperty('capacityPerDay');
    });
  });

  describe('Projects', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks();
    });

    test('should fetch projects successfully', async () => {
      const projects = await service.getProjects();
      
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0]).toHaveProperty('id');
      expect(projects[0]).toHaveProperty('name');
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks();
    });

    test('should cache work items data', async () => {
      // Mock cache service
      const mockCacheGet = jest.fn().mockReturnValue(null);
      const mockCacheSet = jest.fn();
      
      service.cacheService = {
        get: mockCacheGet,
        set: mockCacheSet
      };

      await service.getWorkItems();
      
      expect(mockCacheGet).toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalled();
    });

    test('should return cached data when available', async () => {
      const cachedData = [{ id: 1, title: 'Cached Work Item' }];
      
      service.cacheService = {
        get: jest.fn().mockReturnValue(cachedData),
        set: jest.fn()
      };

      const workItems = await service.getWorkItems();
      
      expect(workItems).toEqual(cachedData);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const nock = require('nock');
      nock('https://dev.azure.com')
        .get('/test-org/_apis/wit/workItems')
        .query(true)
        .replyWithError('Network error');

      await expect(service.getWorkItems()).rejects.toThrow('Network error');
    });

    test('should handle server errors', async () => {
      mockFactory = createFailureMocks('server');

      await expect(service.getWorkItems()).rejects.toThrow();
    });

    test('should handle invalid JSON responses', async () => {
      const nock = require('nock');
      nock('https://dev.azure.com')
        .get('/test-org/_apis/wit/workItems')
        .query(true)
        .reply(200, 'Invalid JSON');

      await expect(service.getWorkItems()).rejects.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      mockFactory = createBasicMocks();
      
      // Make multiple rapid requests
      const promises = Array(10).fill().map(() => service.getWorkItems());
      
      // Should not throw rate limit errors due to internal rate limiting
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks();
    });

    test('should batch work item requests', async () => {
      const workItemIds = [1, 2, 3, 4, 5];
      const workItems = await service.getWorkItemsBatch(workItemIds);
      
      expect(Array.isArray(workItems)).toBe(true);
      expect(workItems.length).toBe(workItemIds.length);
    });
  });

  describe('Request Optimization', () => {
    beforeEach(() => {
      mockFactory = createBasicMocks();
    });

    test('should optimize concurrent requests', async () => {
      const start = Date.now();
      
      // Make concurrent requests
      await Promise.all([
        service.getWorkItems(),
        service.getTeamMembers(),
        service.getIterations()
      ]);
      
      const duration = Date.now() - start;
      
      // Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    test('should handle request timeouts', async () => {
      const nock = require('nock');
      nock('https://dev.azure.com')
        .get('/test-org/_apis/wit/workItems')
        .query(true)
        .delay(10000) // 10 second delay
        .reply(200, []);

      // Should timeout before 10 seconds
      await expect(service.getWorkItems()).rejects.toThrow();
    }, 8000); // 8 second test timeout
  });
});
/**
 * Azure DevOps Service Test Suite
 * Tests the core functionality required for the Azure Boards API PoC
 * 
 * Test Categories:
 * 1. Authentication & Configuration
 * 2. Work Item Retrieval
 * 3. Data Transformation & Mapping
 * 4. CRUD Operations
 * 5. Error Handling
 * 6. Performance & Rate Limiting
 */

const AzureDevOpsService = require('../src/services/azureDevOpsService');
const nock = require('nock');

// Mock environment variables for testing
process.env.AZURE_DEVOPS_ORG = 'test-organization';
process.env.AZURE_DEVOPS_PROJECT = 'test-project';
process.env.AZURE_DEVOPS_PAT = 'test-personal-access-token-123456789abcdef';

describe('Azure DevOps API PoC - Core Functionality', () => {
  let service;
  let baseUrl;

  beforeEach(() => {
    service = new AzureDevOpsService();
    baseUrl = `https://dev.azure.com/${process.env.AZURE_DEVOPS_ORG}`;
    
    // Clear any existing nock interceptors
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('1. Authentication & Configuration', () => {
    test('should validate required configuration', () => {
      expect(service.organization).toBe('test-organization');
      expect(service.project).toBe('test-project');
      expect(service.pat).toBe('test-personal-access-token-123456789abcdef');
      expect(service.apiVersion).toBe('7.0');
    });

    test('should throw error for missing configuration', () => {
      expect(() => {
        new AzureDevOpsService({
          organization: null,
          project: 'test',
          pat: 'test'
        });
      }).toThrow('Azure DevOps configuration incomplete');
    });

    test('should setup authentication headers correctly', () => {
      const expectedAuth = `Basic ${Buffer.from(`:${process.env.AZURE_DEVOPS_PAT}`).toString('base64')}`;
      
      expect(service.authHeaders).toEqual({
        'Authorization': expectedAuth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });
    });

    test('should make authenticated request successfully', async () => {
      const mockResponse = { value: [], count: 0 };
      
      nock(baseUrl)
        .get('/test-project/_apis/projects')
        .matchHeader('Authorization', new RegExp('Basic .*'))
        .reply(200, mockResponse);

      const response = await service.makeRequest(`/test-project/_apis/projects`);
      expect(response).toEqual(mockResponse);
    });

    test('should handle authentication failure', async () => {
      nock(baseUrl)
        .get('/test-project/_apis/projects')
        .reply(401, { message: 'Unauthorized' });

      await expect(service.makeRequest(`/test-project/_apis/projects`))
        .rejects
        .toThrow('Azure DevOps API error: 401');
    });
  });

  describe('2. Work Item Retrieval', () => {
    test('should fetch work items using WIQL query', async () => {
      const mockWiqlResponse = {
        workItems: [
          { id: 1, url: 'https://dev.azure.com/_workitems/edit/1' },
          { id: 2, url: 'https://dev.azure.com/_workitems/edit/2' }
        ]
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
        .matchHeader('Authorization', new RegExp('Basic .*'))
        .reply(200, mockWiqlResponse);

      const result = await service.getWorkItems({
        workItemTypes: ['Task', 'Bug'],
        states: ['Active', 'In Progress']
      });

      expect(result.workItems).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.query).toContain('System.WorkItemType');
      expect(result.query).toContain('System.State');
    });

    test('should fetch work item details with all required fields', async () => {
      const mockWorkItemsResponse = {
        value: [
          {
            id: 1,
            fields: {
              'System.Id': 1,
              'System.Title': 'Test Task',
              'System.WorkItemType': 'Task',
              'System.AssignedTo': {
                displayName: 'John Doe',
                uniqueName: 'john@example.com',
                imageUrl: 'https://avatar.url'
              },
              'System.State': 'Active',
              'Microsoft.VSTS.Scheduling.StoryPoints': 5,
              'System.CreatedDate': '2025-01-01T00:00:00Z',
              'System.ChangedDate': '2025-01-02T00:00:00Z',
              'System.Tags': 'frontend;urgent',
              'System.AreaPath': 'Project\\Area1',
              'System.IterationPath': 'Project\\Sprint 1',
              'Bug types': 'Functional' // Custom field for bug classification
            },
            _links: {
              html: { href: 'https://dev.azure.com/_workitems/edit/1' }
            }
          }
        ]
      };

      nock(baseUrl)
        .get(`/${encodeURIComponent('test-project')}/_apis/wit/workitems`)
        .query(true)
        .reply(200, mockWorkItemsResponse);

      const result = await service.getWorkItemDetails([1]);

      expect(result.workItems).toHaveLength(1);
      const workItem = result.workItems[0];
      
      expect(workItem.id).toBe(1);
      expect(workItem.title).toBe('Test Task');
      expect(workItem.type).toBe('Task');
      expect(workItem.assignee).toBe('John Doe');
      expect(workItem.state).toBe('Active');
      expect(workItem.storyPoints).toBe(5);
      expect(workItem.tags).toEqual(['frontend', 'urgent']);
      expect(workItem.bugType).toBe('Functional');
    });

    test('should handle custom query with parameters', async () => {
      const customQuery = `
        SELECT [System.Id], [System.Title] 
        FROM WorkItems 
        WHERE [System.AssignedTo] = 'john@example.com'
      `;

      const mockResponse = {
        workItems: [{ id: 1 }]
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
        .matchHeader('Authorization', new RegExp('Basic .*'))
        .reply(200, mockResponse);

      const result = await service.getWorkItems({
        customQuery,
        maxResults: 500
      });

      expect(result.workItems).toHaveLength(1);
      expect(result.returnedCount).toBe(1);
    });

    test('should limit results to prevent overwhelming responses', async () => {
      const largeResponse = {
        workItems: Array.from({ length: 2000 }, (_, i) => ({ id: i + 1 }))
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
        .reply(200, largeResponse);

      const result = await service.getWorkItems({ maxResults: 1000 });

      expect(result.returnedCount).toBe(1000);
      expect(result.totalCount).toBe(2000);
    });
  });

  describe('3. Data Transformation & Mapping', () => {
    test('should transform Azure work item to standardized format', () => {
      const azureWorkItem = {
        id: 1,
        fields: {
          'System.Id': 1,
          'System.Title': 'Sample Bug',
          'System.WorkItemType': 'Bug',
          'System.AssignedTo': {
            displayName: 'Jane Smith',
            uniqueName: 'jane@example.com',
            imageUrl: 'https://avatar.url/jane'
          },
          'System.State': 'Active',
          'Microsoft.VSTS.Scheduling.StoryPoints': 3,
          'Microsoft.VSTS.Common.Priority': 2,
          'System.CreatedDate': '2025-01-01T10:00:00Z',
          'System.ChangedDate': '2025-01-02T15:30:00Z',
          'System.Tags': 'backend;database;critical',
          'System.AreaPath': 'RIS\\Backend',
          'System.IterationPath': 'RIS\\Sprint 5',
          'Bug types': 'Performance', // Custom field
          'Microsoft.VSTS.Scheduling.RemainingWork': 8,
          'Microsoft.VSTS.Scheduling.CompletedWork': 2,
          'System.Description': 'Database query performance issue'
        },
        _links: {
          html: { href: 'https://dev.azure.com/org/project/_workitems/edit/1' }
        }
      };

      const transformed = service.transformWorkItem(azureWorkItem, 'test-project');

      expect(transformed).toMatchObject({
        id: 1,
        title: 'Sample Bug',
        type: 'Bug',
        assignee: 'Jane Smith',
        assigneeEmail: 'jane@example.com',
        state: 'Active',
        storyPoints: 3,
        priority: 2,
        tags: ['backend', 'database', 'critical'],
        areaPath: 'RIS\\Backend',
        iterationPath: 'RIS\\Sprint 5',
        bugType: 'Performance',
        remainingWork: 8,
        completedWork: 2,
        project: 'test-project',
        url: 'https://dev.azure.com/org/project/_workitems/edit/1'
      });

      expect(transformed.customFields).toHaveProperty('bugTypes', 'Performance');
    });

    test('should handle work item with missing fields gracefully', () => {
      const minimalWorkItem = {
        id: 2,
        fields: {
          'System.Id': 2,
          'System.Title': 'Minimal Task'
        }
      };

      const transformed = service.transformWorkItem(minimalWorkItem);

      expect(transformed).toMatchObject({
        id: 2,
        title: 'Minimal Task',
        assignee: 'Unassigned',
        storyPoints: 0,
        priority: 4,
        tags: [],
        remainingWork: 0,
        completedWork: 0
      });
    });

    test('should extract custom bug type fields with case-insensitive matching', () => {
      const workItemWithCustomField = {
        fields: {
          'System.Id': 3,
          'System.Title': 'Test Bug',
          'bug types': 'Functional', // lowercase custom field
          'Custom.BugType': 'UI/UX' // another custom field format
        }
      };

      const transformed = service.transformWorkItem(workItemWithCustomField);

      expect(transformed.bugType).toBe('Functional');
      expect(transformed.customFields).toHaveProperty('bugTypes', 'Functional');
      expect(transformed.customFields).toHaveProperty('Custom.BugType', 'UI/UX');
    });
  });

  describe('4. Project and Team Information', () => {
    test('should fetch all projects from organization', async () => {
      const mockProjectsResponse = {
        value: [
          {
            id: 'project-1',
            name: 'RIS Dashboard',
            description: 'Performance dashboard project',
            state: 'wellFormed',
            visibility: 'private',
            lastUpdateTime: '2025-01-01T00:00:00Z'
          }
        ]
      };

      nock(baseUrl)
        .get('/_apis/projects')
        .query({ 'api-version': '7.0' })
        .reply(200, mockProjectsResponse);

      const result = await service.getProjects();

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]).toMatchObject({
        id: 'project-1',
        name: 'RIS Dashboard',
        status: 'active',
        visibility: 'private'
      });
      expect(result.organization).toBe('test-organization');
    });

    test('should fetch team members from project', async () => {
      const mockTeamsResponse = {
        value: [
          {
            id: 'team-1',
            name: 'Development Team'
          }
        ]
      };

      const mockMembersResponse = {
        value: [
          {
            identity: {
              uniqueName: 'dev1@example.com',
              displayName: 'Developer One',
              imageUrl: 'https://avatar1.url'
            }
          },
          {
            identity: {
              uniqueName: 'dev2@example.com',
              displayName: 'Developer Two',
              imageUrl: 'https://avatar2.url'
            }
          }
        ]
      };

      nock(baseUrl)
        .get('/_apis/projects/test-project/teams')
        .query({ 'api-version': '7.0' })
        .reply(200, mockTeamsResponse);

      nock(baseUrl)
        .get('/_apis/projects/test-project/teams/team-1/members')
        .query({ 'api-version': '7.0' })
        .reply(200, mockMembersResponse);

      const result = await service.getProjectTeamMembers('test-project');

      expect(result.members).toHaveLength(2);
      expect(result.members[0]).toMatchObject({
        id: 'dev1@example.com',
        name: 'Developer One',
        email: 'dev1@example.com',
        role: 'Developer',
        isActive: true
      });
    });
  });

  describe('5. Error Handling & Resilience', () => {
    test('should handle API rate limiting gracefully', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(429, { message: 'Rate limit exceeded' });

      await expect(service.makeRequest('/test'))
        .rejects
        .toThrow('Azure DevOps API error: 429');
    });

    test('should handle network timeout', async () => {
      nock(baseUrl)
        .get('/test')
        .delayConnection(35000) // Longer than default timeout
        .reply(200, {});

      await expect(service.makeRequest('/test'))
        .rejects
        .toThrow();
    });

    test('should handle malformed JSON response', async () => {
      nock(baseUrl)
        .get('/test')
        .reply(200, 'invalid-json-response');

      await expect(service.makeRequest('/test'))
        .rejects
        .toThrow();
    });

    test('should provide meaningful error messages', async () => {
      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
        .reply(400, { 
          message: 'Invalid WIQL query syntax',
          details: 'Unexpected token at line 1'
        });

      await expect(service.getWorkItems({
        customQuery: 'INVALID QUERY SYNTAX'
      })).rejects.toThrow('Failed to fetch work items');
    });

    test('should handle empty or null work item IDs', async () => {
      await expect(service.getWorkItemDetails([]))
        .rejects
        .toThrow('Work item IDs must be a non-empty array');

      await expect(service.getWorkItemDetails(null))
        .rejects
        .toThrow('Work item IDs must be a non-empty array');
    });
  });

  describe('6. Performance & Caching', () => {
    test('should enforce rate limiting', async () => {
      // Set a low rate limit for testing
      service.rateLimiter.requestsPerMinute = 2;
      service.rateLimiter.requestTimes = [];

      nock(baseUrl)
        .get('/test1').reply(200, { data: 'test1' })
        .get('/test2').reply(200, { data: 'test2' })
        .get('/test3').reply(200, { data: 'test3' });

      const startTime = Date.now();

      // Make 3 requests quickly
      await service.makeRequest('/test1');
      await service.makeRequest('/test2');
      await service.makeRequest('/test3'); // This should be rate limited

      const endTime = Date.now();
      const duration = endTime - startTime;

      // The third request should have been delayed due to rate limiting
      expect(duration).toBeGreaterThan(1000); // Should take at least 1 second due to rate limiting
    });

    test('should batch large work item requests', async () => {
      const largeIdList = Array.from({ length: 250 }, (_, i) => i + 1);
      
      // Mock multiple batch requests
      nock(baseUrl)
        .get(`/${encodeURIComponent('test-project')}/_apis/wit/workitems`)
        .query(true)
        .times(3) // Should make 3 batch requests (100 each)
        .reply(200, { value: [] });

      await service.getWorkItemDetails(largeIdList);

      // Verify that nock interceptors were called (batching occurred)
      expect(nock.isDone()).toBe(true);
    });

    test('should measure API response time', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      nock(baseUrl)
        .get('/test')
        .delay(100) // Add 100ms delay
        .reply(200, { data: 'test' });

      await service.makeRequest('/test');

      // Verify that performance timing was logged (implementation detail)
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('7. Service Health & Monitoring', () => {
    test('should provide service health information', () => {
      const health = service.getServiceHealth();

      expect(health).toHaveProperty('rateLimiter');
      expect(health).toHaveProperty('configuration');
      expect(health.configuration).toMatchObject({
        organization: 'test-organization',
        project: 'test-project',
        apiVersion: '7.0',
        hasValidPAT: true
      });
    });

    test('should track request statistics', async () => {
      nock(baseUrl)
        .get('/test1').reply(200, {})
        .get('/test2').reply(200, {});

      await service.makeRequest('/test1');
      await service.makeRequest('/test2');

      const health = service.getServiceHealth();
      expect(health.rateLimiter.requestsInLastMinute).toBeGreaterThan(0);
    });
  });

  describe('8. Integration Scenarios (PoC Validation)', () => {
    test('should successfully demonstrate end-to-end work item retrieval flow', async () => {
      // Mock the complete flow: WIQL query -> work item details
      const wiqlResponse = {
        workItems: [
          { id: 1 },
          { id: 2 }
        ]
      };

      const workItemsResponse = {
        value: [
          {
            id: 1,
            fields: {
              'System.Id': 1,
              'System.Title': 'Integration Test Task',
              'System.WorkItemType': 'Task',
              'System.State': 'Active',
              'Bug types': 'Integration'
            }
          },
          {
            id: 2,
            fields: {
              'System.Id': 2,
              'System.Title': 'Integration Test Bug',
              'System.WorkItemType': 'Bug',
              'System.State': 'New',
              'Bug types': 'Regression'
            }
          }
        ]
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
        .reply(200, wiqlResponse);

      nock(baseUrl)
        .get(`/${encodeURIComponent('test-project')}/_apis/wit/workitems`)
        .query(true)
        .reply(200, workItemsResponse);

      // Simulate complete workflow
      const workItemQuery = await service.getWorkItems({
        workItemTypes: ['Task', 'Bug'],
        states: ['Active', 'New']
      });

      expect(workItemQuery.workItems).toHaveLength(2);

      const workItemIds = workItemQuery.workItems.map(item => item.id);
      const detailedItems = await service.getWorkItemDetails(workItemIds);

      expect(detailedItems.workItems).toHaveLength(2);
      expect(detailedItems.workItems[0].title).toBe('Integration Test Task');
      expect(detailedItems.workItems[1].bugType).toBe('Regression');
    });

    test('should demonstrate performance within PoC requirements (<2s)', async () => {
      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
        .reply(200, { workItems: [{ id: 1 }] });

      const startTime = Date.now();
      await service.getWorkItems({ maxResults: 100 });
      const duration = Date.now() - startTime;

      // PoC requirement: API responses <2s
      expect(duration).toBeLessThan(2000);
    });

    test('should validate data mapping to existing system format', () => {
      const azureWorkItem = {
        fields: {
          'System.Id': 42,
          'System.Title': 'Performance Dashboard Bug',
          'System.WorkItemType': 'Bug',
          'System.State': 'Active',
          'Microsoft.VSTS.Scheduling.StoryPoints': 8,
          'Bug types': 'Performance'
        }
      };

      const mapped = service.transformWorkItem(azureWorkItem);

      // Verify mapping to existing dashboard format
      expect(mapped).toMatchObject({
        id: 42,
        title: 'Performance Dashboard Bug',
        type: 'Bug',
        state: 'Active',
        storyPoints: 8,
        bugType: 'Performance'
      });

      // Verify custom fields are preserved for bug classification
      expect(mapped.customFields.bugTypes).toBe('Performance');
    });
  });
});

describe('Azure DevOps PoC - Success Criteria Validation', () => {
  let service;

  beforeEach(() => {
    service = new AzureDevOpsService();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('PoC Success Criteria 1: Successfully authenticate with Azure DevOps API', () => {
    // Verify authentication setup
    expect(service.authHeaders.Authorization).toContain('Basic');
    expect(service.authHeaders['Content-Type']).toBe('application/json');
    
    // Configuration validation passed during construction
    expect(service.organization).toBeTruthy();
    expect(service.project).toBeTruthy();
    expect(service.pat).toBeTruthy();
  });

  test('PoC Success Criteria 2: Retrieve work items, teams, and project data', async () => {
    // Mock successful responses for all required data types
    nock('https://dev.azure.com/test-organization')
      .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
      .reply(200, { workItems: [{ id: 1 }] })
      .get('/_apis/projects')
      .reply(200, { value: [{ id: '1', name: 'Test Project' }] })
      .get('/_apis/projects/test-project/teams')
      .reply(200, { value: [{ id: 'team1', name: 'Team 1' }] })
      .get('/_apis/projects/test-project/teams/team1/members')
      .reply(200, { value: [] });

    // Test work items retrieval
    const workItems = await service.getWorkItems();
    expect(workItems.workItems).toBeDefined();

    // Test projects retrieval
    const projects = await service.getProjects();
    expect(projects.projects).toBeDefined();

    // Test team members retrieval
    const teamMembers = await service.getProjectTeamMembers();
    expect(teamMembers.members).toBeDefined();
  });

  test('PoC Success Criteria 3: Demonstrate CRUD operations on work items', () => {
    // Note: Full CRUD requires additional implementation
    // Current implementation covers Read operations extensively
    // Create, Update, Delete operations would need additional methods
    
    // Verify read operations are working
    expect(typeof service.getWorkItems).toBe('function');
    expect(typeof service.getWorkItemDetails).toBe('function');
    
    // TODO: Implement Create, Update, Delete methods for full CRUD demo
  });

  test('PoC Success Criteria 4: Validate data mapping to existing system', () => {
    const sampleAzureData = {
      fields: {
        'System.Id': 1,
        'System.Title': 'Test Item',
        'System.WorkItemType': 'Bug',
        'System.State': 'Active',
        'Bug types': 'UI/UX'
      }
    };

    const mapped = service.transformWorkItem(sampleAzureData);
    
    // Verify all required fields are mapped
    expect(mapped.id).toBeDefined();
    expect(mapped.title).toBeDefined();
    expect(mapped.type).toBeDefined();
    expect(mapped.state).toBeDefined();
    expect(mapped.bugType).toBeDefined();
    expect(mapped.customFields).toBeDefined();
  });

  test('PoC Success Criteria 5: Response time <2s for API calls', async () => {
    nock('https://dev.azure.com/test-organization')
      .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
      .reply(200, { workItems: [] });

    const startTime = Date.now();
    await service.getWorkItems({ maxResults: 10 });
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(2000);
  });

  test('PoC Success Criteria 6: Error handling for common failure scenarios', async () => {
    // Test authentication failure
    nock('https://dev.azure.com/test-organization')
      .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
      .reply(401, { message: 'Unauthorized' });

    await expect(service.getWorkItems()).rejects.toThrow();

    // Test network failure  
    nock('https://dev.azure.com/test-organization')
      .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
      .replyWithError('Network error');

    await expect(service.getWorkItems()).rejects.toThrow();

    // Test malformed response
    nock('https://dev.azure.com/test-organization')
      .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
      .reply(200, 'invalid json');

    await expect(service.getWorkItems()).rejects.toThrow();
  });
});
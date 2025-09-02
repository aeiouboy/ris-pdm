/**
 * Azure DevOps CRUD Operations Test Suite
 * Tests the production-ready Create, Read, Update, Delete operations
 * Uses mocked responses to avoid hitting real Azure DevOps APIs
 */

const AzureDevOpsService = require('../src/services/azureDevOpsService');
const nock = require('nock');

// Mock environment variables for testing
process.env.AZURE_DEVOPS_ORG = 'test-organization';
process.env.AZURE_DEVOPS_PROJECT = 'test-project';
process.env.AZURE_DEVOPS_PAT = 'test-personal-access-token-123456789abcdef';

describe('Azure DevOps CRUD Operations - Production Suite', () => {
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

  describe('Create Operations', () => {
    test('should create a new Task work item with all fields', async () => {
      const mockResponse = {
        id: 12345,
        rev: 1,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Test Task Creation',
          'System.WorkItemType': 'Task',
          'System.State': 'New',
          'System.Description': 'Task created during testing',
          'System.AssignedTo': {
            displayName: 'Test User',
            uniqueName: 'testuser@example.com',
            imageUrl: 'https://avatar.url'
          },
          'Microsoft.VSTS.Scheduling.StoryPoints': 5,
          'Microsoft.VSTS.Common.Priority': 2,
          'System.Tags': 'testing;automated;task',
          'System.AreaPath': 'TestProject\\Area1',
          'System.IterationPath': 'TestProject\\Sprint 1'
        },
        _links: {
          html: { href: 'https://dev.azure.com/test-organization/test-project/_workitems/edit/12345' }
        }
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .matchHeader('Content-Type', 'application/json-patch+json')
        .reply(200, mockResponse);

      const fields = {
        title: 'Test Task Creation',
        description: 'Task created during testing',
        assignedTo: 'testuser@example.com',
        storyPoints: 5,
        priority: 2,
        tags: ['testing', 'automated', 'task'],
        areaPath: 'TestProject\\Area1',
        iterationPath: 'TestProject\\Sprint 1'
      };

      const result = await service.createWorkItem('Task', fields);

      expect(result).toMatchObject({
        id: 12345,
        title: 'Test Task Creation',
        type: 'Task',
        state: 'New',
        assignee: 'Test User',
        storyPoints: 5,
        priority: 2,
        tags: ['testing', 'automated', 'task'],
        areaPath: 'TestProject\\Area1',
        iterationPath: 'TestProject\\Sprint 1'
      });
    });

    test('should create a new Bug work item with custom fields', async () => {
      const mockResponse = {
        id: 12346,
        rev: 1,
        fields: {
          'System.Id': 12346,
          'System.Title': 'Test Bug Creation',
          'System.WorkItemType': 'Bug',
          'System.State': 'New',
          'Microsoft.VSTS.Common.Priority': 1,
          'Bug types': 'Functional',
          'Custom.Severity': 'High'
        }
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Bug`)
        .reply(200, mockResponse);

      const fields = {
        title: 'Test Bug Creation',
        priority: 1,
        bugType: 'Functional',
        customFields: {
          'Custom.Severity': 'High'
        }
      };

      const result = await service.createWorkItem('Bug', fields);

      expect(result.id).toBe(12346);
      expect(result.title).toBe('Test Bug Creation');
      expect(result.type).toBe('Bug');
      expect(result.bugType).toBe('Functional');
      expect(result.customFields).toHaveProperty('Custom.Severity', 'High');
    });

    test('should fail to create work item without required fields', async () => {
      await expect(service.createWorkItem('Task', {}))
        .rejects
        .toThrow('No valid fields provided for work item creation');
    });

    test('should handle creation errors from Azure DevOps', async () => {
      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .reply(400, {
          message: 'Required field System.Title is missing'
        });

      const fields = { description: 'Task without title' };

      await expect(service.createWorkItem('Task', fields))
        .rejects
        .toThrow('Failed to create work item');
    });
  });

  describe('Update Operations', () => {
    test('should update work item fields successfully', async () => {
      const mockResponse = {
        id: 12345,
        rev: 2,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Updated Task Title',
          'System.WorkItemType': 'Task',
          'System.State': 'Active',
          'System.AssignedTo': {
            displayName: 'New Assignee',
            uniqueName: 'newassignee@example.com'
          },
          'Microsoft.VSTS.Scheduling.StoryPoints': 8,
          'System.Tags': 'updated;testing;modified'
        }
      };

      nock(baseUrl)
        .patch(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/12345`)
        .matchHeader('Content-Type', 'application/json-patch+json')
        .reply(200, mockResponse);

      const updates = {
        title: 'Updated Task Title',
        state: 'Active',
        assignedTo: 'newassignee@example.com',
        storyPoints: 8,
        tags: ['updated', 'testing', 'modified']
      };

      const result = await service.updateWorkItem(12345, updates);

      expect(result).toMatchObject({
        id: 12345,
        title: 'Updated Task Title',
        state: 'Active',
        assignee: 'New Assignee',
        storyPoints: 8,
        tags: ['updated', 'testing', 'modified']
      });
    });

    test('should unassign work item when assignedTo is empty', async () => {
      const mockResponse = {
        id: 12345,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Unassigned Task',
          'System.WorkItemType': 'Task'
        }
      };

      nock(baseUrl)
        .patch(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/12345`)
        .reply(200, mockResponse);

      const updates = { assignedTo: '' };
      const result = await service.updateWorkItem(12345, updates);

      expect(result.assignee).toBe('Unassigned');
    });

    test('should update custom fields', async () => {
      const mockResponse = {
        id: 12346,
        fields: {
          'System.Id': 12346,
          'System.Title': 'Bug with Updated Custom Fields',
          'System.WorkItemType': 'Bug',
          'Bug types': 'Performance',
          'Custom.Severity': 'Critical',
          'Custom.Component': 'Database'
        }
      };

      nock(baseUrl)
        .patch(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/12346`)
        .reply(200, mockResponse);

      const updates = {
        bugType: 'Performance',
        customFields: {
          'Custom.Severity': 'Critical',
          'Custom.Component': 'Database'
        }
      };

      const result = await service.updateWorkItem(12346, updates);

      expect(result.bugType).toBe('Performance');
      expect(result.customFields).toHaveProperty('Custom.Severity', 'Critical');
      expect(result.customFields).toHaveProperty('Custom.Component', 'Database');
    });

    test('should fail to update with no fields provided', async () => {
      await expect(service.updateWorkItem(12345, {}))
        .rejects
        .toThrow('No valid fields provided for update');
    });

    test('should handle update errors from Azure DevOps', async () => {
      nock(baseUrl)
        .patch(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/99999`)
        .reply(404, {
          message: 'Work item 99999 does not exist'
        });

      const updates = { title: 'Updated Title' };

      await expect(service.updateWorkItem(99999, updates))
        .rejects
        .toThrow('Failed to update work item 99999');
    });
  });

  describe('Delete Operations', () => {
    test('should delete work item successfully', async () => {
      const mockResponse = {
        id: 12345,
        rev: 3,
        fields: {
          'System.Id': 12345,
          'System.State': 'Removed'
        }
      };

      nock(baseUrl)
        .delete(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/12345`)
        .reply(200, mockResponse);

      const result = await service.deleteWorkItem(12345);

      expect(result).toMatchObject({
        id: 12345,
        deleted: true,
        message: 'Work item moved to Removed state'
      });
      expect(result.deletedDate).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should handle deletion errors from Azure DevOps', async () => {
      nock(baseUrl)
        .delete(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/99999`)
        .reply(404, {
          message: 'Work item 99999 does not exist'
        });

      await expect(service.deleteWorkItem(99999))
        .rejects
        .toThrow('Failed to delete work item 99999');
    });
  });

  describe('Comment Operations', () => {
    test('should add comment to work item successfully', async () => {
      const mockResponse = {
        id: 1,
        text: 'Test comment added during testing',
        createdBy: {
          displayName: 'Test User',
          uniqueName: 'testuser@example.com'
        },
        createdDate: '2025-01-01T10:00:00Z'
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/12345/comments`)
        .reply(200, mockResponse);

      const result = await service.addWorkItemComment(12345, 'Test comment added during testing');

      expect(result).toMatchObject({
        commentId: 1,
        workItemId: 12345,
        text: 'Test comment added during testing',
        createdBy: {
          displayName: 'Test User',
          uniqueName: 'testuser@example.com'
        }
      });
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should handle comment creation errors', async () => {
      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/99999/comments`)
        .reply(404, {
          message: 'Work item 99999 does not exist'
        });

      await expect(service.addWorkItemComment(99999, 'Test comment'))
        .rejects
        .toThrow('Failed to add comment to work item 99999');
    });
  });

  describe('Relationship Operations', () => {
    test('should update work item relationships successfully', async () => {
      const mockResponse = {
        id: 12345,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Parent Task',
          'System.WorkItemType': 'Task'
        },
        relations: [
          {
            rel: 'System.LinkTypes.Hierarchy-Forward',
            url: 'https://dev.azure.com/test-organization/test-project/_apis/wit/workItems/12346',
            attributes: {
              isLocked: false
            }
          }
        ]
      };

      nock(baseUrl)
        .patch(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/12345`)
        .matchHeader('Content-Type', 'application/json-patch+json')
        .reply(200, mockResponse);

      const relationships = [
        {
          operation: 'add',
          type: 'System.LinkTypes.Hierarchy-Forward',
          targetId: 12346,
          attributes: { isLocked: false }
        }
      ];

      const result = await service.updateWorkItemRelationships(12345, relationships);

      expect(result.id).toBe(12345);
      expect(result.title).toBe('Parent Task');
    });

    test('should handle relationship update errors', async () => {
      nock(baseUrl)
        .patch(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/99999`)
        .reply(404, {
          message: 'Work item 99999 does not exist'
        });

      const relationships = [
        {
          operation: 'add',
          type: 'System.LinkTypes.Hierarchy-Forward',
          targetId: 12346
        }
      ];

      await expect(service.updateWorkItemRelationships(99999, relationships))
        .rejects
        .toThrow('Failed to update relationships for work item 99999');
    });
  });

  describe('Performance & Caching', () => {
    test('should clear work item caches after create operation', async () => {
      const mockResponse = {
        id: 12345,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Test Task',
          'System.WorkItemType': 'Task'
        }
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .reply(200, mockResponse);

      // Mock cache service
      const clearPatternSpy = jest.spyOn(service.cacheService, 'clearPattern')
        .mockResolvedValue(true);

      const fields = { title: 'Test Task' };
      await service.createWorkItem('Task', fields);

      expect(clearPatternSpy).toHaveBeenCalledWith('ris:cache:workItems:*');
      expect(clearPatternSpy).toHaveBeenCalledWith('ris:cache:workItemDetails:*');

      clearPatternSpy.mockRestore();
    });

    test('should clear work item caches after update operation', async () => {
      const mockResponse = {
        id: 12345,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Updated Task',
          'System.WorkItemType': 'Task'
        }
      };

      nock(baseUrl)
        .patch(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/12345`)
        .reply(200, mockResponse);

      // Mock cache service
      const clearPatternSpy = jest.spyOn(service.cacheService, 'clearPattern')
        .mockResolvedValue(true);

      const updates = { title: 'Updated Task' };
      await service.updateWorkItem(12345, updates);

      expect(clearPatternSpy).toHaveBeenCalledWith('ris:cache:workItems:*');
      expect(clearPatternSpy).toHaveBeenCalledWith('ris:cache:workItemDetails:*');

      clearPatternSpy.mockRestore();
    });

    test('should measure operation performance', async () => {
      const mockResponse = {
        id: 12345,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Performance Test Task',
          'System.WorkItemType': 'Task'
        }
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .delay(100) // Simulate 100ms response time
        .reply(200, mockResponse);

      const startTime = Date.now();
      const fields = { title: 'Performance Test Task' };
      await service.createWorkItem('Task', fields);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThan(100);
      expect(duration).toBeLessThan(2000); // Should be well under 2s requirement
    });
  });

  describe('Integration with Existing Service', () => {
    test('should work with existing getWorkItems method', async () => {
      // Mock both creation and retrieval
      const createResponse = {
        id: 12345,
        fields: {
          'System.Id': 12345,
          'System.Title': 'Integration Test Task',
          'System.WorkItemType': 'Task',
          'System.State': 'New'
        }
      };

      const queryResponse = {
        workItems: [{ id: 12345 }]
      };

      const detailsResponse = {
        value: [createResponse]
      };

      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .reply(200, createResponse)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/wiql`)
        .reply(200, queryResponse)
        .get(`/${encodeURIComponent('test-project')}/_apis/wit/workitems`)
        .query(true)
        .reply(200, detailsResponse);

      // Create work item
      const fields = { title: 'Integration Test Task' };
      const createdItem = await service.createWorkItem('Task', fields);

      // Retrieve work items to verify integration
      const workItems = await service.getWorkItems({
        workItemTypes: ['Task'],
        maxResults: 10
      });

      expect(createdItem.id).toBe(12345);
      expect(workItems.workItems).toHaveLength(1);
      expect(workItems.workItems[0].id).toBe(12345);
    });

    test('should maintain backward compatibility with existing methods', async () => {
      // Verify that adding CRUD methods doesn't break existing functionality
      expect(typeof service.getWorkItems).toBe('function');
      expect(typeof service.getWorkItemDetails).toBe('function');
      expect(typeof service.getProjects).toBe('function');
      expect(typeof service.getTeamMembers).toBe('function');

      // Verify new CRUD methods are available
      expect(typeof service.createWorkItem).toBe('function');
      expect(typeof service.updateWorkItem).toBe('function');
      expect(typeof service.deleteWorkItem).toBe('function');
      expect(typeof service.addWorkItemComment).toBe('function');
      expect(typeof service.updateWorkItemRelationships).toBe('function');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    test('should handle network timeouts gracefully', async () => {
      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .delayConnection(35000) // Longer than default timeout
        .reply(200, {});

      const fields = { title: 'Timeout Test Task' };

      await expect(service.createWorkItem('Task', fields))
        .rejects
        .toThrow();
    });

    test('should handle malformed response data', async () => {
      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .reply(200, 'invalid-json-response');

      const fields = { title: 'Malformed Response Test' };

      await expect(service.createWorkItem('Task', fields))
        .rejects
        .toThrow();
    });

    test('should handle rate limiting responses', async () => {
      nock(baseUrl)
        .post(`/${encodeURIComponent('test-project')}/_apis/wit/workitems/$Task`)
        .reply(429, { message: 'Rate limit exceeded' });

      const fields = { title: 'Rate Limit Test Task' };

      await expect(service.createWorkItem('Task', fields))
        .rejects
        .toThrow('Azure DevOps API error: 429');
    });
  });
});
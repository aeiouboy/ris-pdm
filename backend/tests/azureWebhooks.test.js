/**
 * Azure DevOps Webhook Service Tests
 * 
 * Comprehensive test suite for Azure DevOps webhook integration.
 * Tests webhook processing, event handling, and real-time updates.
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const AzureDevOpsWebhookService = require('../src/services/azureDevOpsWebhookService');
const crypto = require('crypto');

describe('Azure DevOps Webhook Service', () => {
  let webhookService;
  let mockCacheService;
  let mockWebSocketService;
  let mockAzureDevOpsService;
  
  beforeEach(() => {
    // Mock cache service
    mockCacheService = {
      delete: jest.fn().mockResolvedValue(true),
      deletePattern: jest.fn().mockResolvedValue(true)
    };
    
    // Mock WebSocket service
    mockWebSocketService = {
      broadcast: jest.fn().mockResolvedValue(true)
    };
    
    // Mock Azure DevOps service
    mockAzureDevOpsService = {
      getWorkItemDetails: jest.fn().mockResolvedValue({
        workItems: [{
          id: 12345,
          title: 'Test Work Item',
          type: 'Task',
          state: 'Active'
        }]
      })
    };
    
    webhookService = new AzureDevOpsWebhookService({
      webhookSecret: 'test-secret-key',
      cacheService: mockCacheService,
      webSocketService: mockWebSocketService,
      azureDevOpsService: mockAzureDevOpsService,
      enableSignatureValidation: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    webhookService.clearQueue();
    webhookService.resetStatistics();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const service = new AzureDevOpsWebhookService();
      
      expect(service.supportedEvents.has('workitem.created')).toBe(true);
      expect(service.supportedEvents.has('workitem.updated')).toBe(true);
      expect(service.supportedEvents.has('workitem.deleted')).toBe(true);
      expect(service.eventQueue).toEqual([]);
    });

    test('should initialize with custom configuration', () => {
      const customService = new AzureDevOpsWebhookService({
        webhookSecret: 'custom-secret',
        enableSignatureValidation: false
      });
      
      expect(customService.webhookSecret).toBe('custom-secret');
      expect(customService.enableSignatureValidation).toBe(false);
    });
  });

  describe('Signature Validation', () => {
    test('should validate correct signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha256=' + crypto
        .createHmac('sha256', 'test-secret-key')
        .update(payload)
        .digest('hex');
      
      const isValid = webhookService.validateSignature(Buffer.from(payload), signature);
      expect(isValid).toBe(true);
    });

    test('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid-signature';
      
      const isValid = webhookService.validateSignature(Buffer.from(payload), invalidSignature);
      expect(isValid).toBe(false);
      expect(webhookService.stats.invalidSignatures).toBe(1);
    });

    test('should skip validation when disabled', () => {
      webhookService.enableSignatureValidation = false;
      const payload = JSON.stringify({ test: 'data' });
      
      const isValid = webhookService.validateSignature(Buffer.from(payload), 'invalid');
      expect(isValid).toBe(true);
    });

    test('should handle missing signature gracefully', () => {
      const payload = JSON.stringify({ test: 'data' });
      
      const isValid = webhookService.validateSignature(Buffer.from(payload), null);
      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Processing', () => {
    const sampleWorkItemCreatedPayload = {
      eventType: 'workitem.created',
      id: 'test-event-id',
      resource: {
        id: 12345,
        fields: {
          'System.Title': 'New Test Work Item',
          'System.WorkItemType': 'Task',
          'System.State': 'New',
          'System.AssignedTo': {
            displayName: 'John Doe',
            uniqueName: 'john.doe@company.com'
          },
          'System.CreatedBy': {
            displayName: 'Jane Smith',
            uniqueName: 'jane.smith@company.com'
          },
          'System.CreatedDate': '2024-01-01T12:00:00.000Z'
        }
      }
    };

    test('should process valid work item created event', async () => {
      const result = await webhookService.processWebhook(sampleWorkItemCreatedPayload);
      
      expect(result.success).toBe(true);
      expect(result.eventType).toBe('workitem.created');
      expect(result.queueSize).toBe(1);
      expect(webhookService.stats.eventsReceived).toBe(1);
    });

    test('should reject invalid payload structure', async () => {
      const invalidPayload = null;
      
      const result = await webhookService.processWebhook(invalidPayload);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid webhook payload');
      expect(webhookService.stats.eventsFailed).toBe(1);
    });

    test('should reject unsupported event types', async () => {
      const unsupportedPayload = {
        eventType: 'unsupported.event',
        resource: { id: 12345 }
      };
      
      const result = await webhookService.processWebhook(unsupportedPayload);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported event type');
    });

    test('should handle missing eventType', async () => {
      const payloadWithoutEventType = {
        resource: { id: 12345 }
      };
      
      const result = await webhookService.processWebhook(payloadWithoutEventType);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing eventType');
    });
  });

  describe('Event Processing', () => {
    beforeEach(() => {
      // Mock setTimeout to control batch processing timing
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should process work item created event', async () => {
      const event = {
        eventType: 'workitem.created',
        id: 'test-event',
        resource: {
          id: 12345,
          fields: {
            'System.Title': 'Test Work Item',
            'System.WorkItemType': 'Task',
            'System.State': 'New'
          }
        }
      };

      const result = await webhookService.processEvent(event);
      
      expect(result.workItemId).toBe(12345);
      expect(result.action).toBe('created');
      expect(result.title).toBe('Test Work Item');
      
      // Check cache invalidation
      expect(mockCacheService.delete).toHaveBeenCalledWith('workItem:12345');
      expect(mockCacheService.delete).toHaveBeenCalledWith('workItemDetails:12345');
      expect(mockCacheService.deletePattern).toHaveBeenCalledWith('workItems:*');
      
      // Check WebSocket broadcast
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        'workItemUpdates',
        expect.objectContaining({
          type: 'workItemUpdate',
          action: 'created',
          workItem: expect.objectContaining({
            id: 12345,
            title: 'Test Work Item'
          })
        })
      );
    });

    test('should process work item updated event', async () => {
      const event = {
        eventType: 'workitem.updated',
        id: 'test-event',
        resource: {
          id: 12345,
          fields: {
            'System.Title': 'Updated Test Work Item',
            'System.WorkItemType': 'Task',
            'System.State': 'Active'
          }
        }
      };

      const result = await webhookService.processEvent(event);
      
      expect(result.workItemId).toBe(12345);
      expect(result.action).toBe('updated');
      expect(result.title).toBe('Updated Test Work Item');
      
      // Check WebSocket broadcast includes changed fields
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        'workItemUpdates',
        expect.objectContaining({
          action: 'updated',
          metadata: expect.objectContaining({
            changedFields: expect.any(Object)
          })
        })
      );
    });

    test('should process work item deleted event', async () => {
      const event = {
        eventType: 'workitem.deleted',
        id: 'test-event',
        resource: {
          id: 12345,
          fields: {
            'System.Title': 'Deleted Test Work Item',
            'System.WorkItemType': 'Task',
            'System.State': 'Removed'
          }
        }
      };

      const result = await webhookService.processEvent(event);
      
      expect(result.workItemId).toBe(12345);
      expect(result.action).toBe('deleted');
      expect(result.title).toBe('Deleted Test Work Item');
    });

    test('should process work item commented event', async () => {
      const event = {
        eventType: 'workitem.commented',
        id: 'test-event',
        resource: {
          id: 12345,
          fields: {
            'System.Title': 'Commented Test Work Item',
            'System.WorkItemType': 'Task',
            'System.State': 'Active'
          }
        },
        message: {
          text: 'This is a test comment'
        }
      };

      const result = await webhookService.processEvent(event);
      
      expect(result.workItemId).toBe(12345);
      expect(result.action).toBe('commented');
      expect(result.comment).toBe('This is a test comment');
      
      // Should only invalidate work item details cache for comments
      expect(mockCacheService.delete).toHaveBeenCalledWith('workItemDetails:12345');
    });

    test('should handle event processing errors', async () => {
      const invalidEvent = {
        eventType: 'workitem.created',
        id: 'test-event',
        resource: null // Invalid resource
      };

      await expect(webhookService.processEvent(invalidEvent)).rejects.toThrow();
    });
  });

  describe('Batch Processing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should process events in batches', async () => {
      // Add multiple events to queue
      const events = [
        { eventType: 'workitem.created', resource: { id: 1, fields: { 'System.Title': 'Item 1' } } },
        { eventType: 'workitem.created', resource: { id: 2, fields: { 'System.Title': 'Item 2' } } },
        { eventType: 'workitem.created', resource: { id: 3, fields: { 'System.Title': 'Item 3' } } }
      ];

      // Process events
      for (const event of events) {
        await webhookService.processWebhook(event);
      }

      expect(webhookService.eventQueue.length).toBe(3);

      // Trigger batch processing
      jest.advanceTimersByTime(webhookService.eventProcessingConfig.processingDelay);
      await Promise.resolve(); // Allow promises to resolve

      // All events should be processed
      expect(webhookService.stats.eventsProcessed).toBe(3);
      expect(webhookService.eventQueue.length).toBe(0);
    });

    test('should respect batch size configuration', async () => {
      webhookService.eventProcessingConfig.batchSize = 2;

      // Add 5 events
      const events = Array.from({ length: 5 }, (_, i) => ({
        eventType: 'workitem.created',
        resource: { id: i + 1, fields: { 'System.Title': `Item ${i + 1}` } }
      }));

      for (const event of events) {
        await webhookService.processWebhook(event);
      }

      expect(webhookService.eventQueue.length).toBe(5);

      // First batch should process 2 items
      jest.advanceTimersByTime(webhookService.eventProcessingConfig.processingDelay);
      await Promise.resolve();

      expect(webhookService.eventQueue.length).toBe(3);

      // Second batch should process 2 more items
      jest.advanceTimersByTime(webhookService.eventProcessingConfig.processingDelay);
      await Promise.resolve();

      expect(webhookService.eventQueue.length).toBe(1);

      // Third batch should process the last item
      jest.advanceTimersByTime(webhookService.eventProcessingConfig.processingDelay);
      await Promise.resolve();

      expect(webhookService.eventQueue.length).toBe(0);
      expect(webhookService.stats.eventsProcessed).toBe(5);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate specific work item caches', async () => {
      await webhookService.invalidateWorkItemCaches(12345, {
        'System.AssignedTo': { uniqueName: 'john.doe@company.com' },
        'System.IterationPath': 'Sprint 1',
        'System.AreaPath': 'Product\\Frontend'
      });

      expect(mockCacheService.delete).toHaveBeenCalledWith('workItem:12345');
      expect(mockCacheService.delete).toHaveBeenCalledWith('workItemDetails:12345');
      expect(mockCacheService.deletePattern).toHaveBeenCalledWith('workItems:assignee:john.doe@company.com:*');
      expect(mockCacheService.deletePattern).toHaveBeenCalledWith('workItems:iteration:Sprint 1:*');
      expect(mockCacheService.deletePattern).toHaveBeenCalledWith('workItems:area:Product\\Frontend:*');
      expect(mockCacheService.deletePattern).toHaveBeenCalledWith('workItems:*');
    });

    test('should handle cache invalidation errors gracefully', async () => {
      mockCacheService.delete.mockRejectedValueOnce(new Error('Cache error'));

      // Should not throw error
      await expect(webhookService.invalidateWorkItemCaches(12345)).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    test('should track event statistics', async () => {
      const payload = {
        eventType: 'workitem.created',
        resource: { id: 12345, fields: { 'System.Title': 'Test' } }
      };

      await webhookService.processWebhook(payload);
      await webhookService.processWebhook(payload);

      const stats = webhookService.getStatistics();

      expect(stats.statistics.eventsReceived).toBe(2);
      expect(stats.statistics.eventsByType['workitem.created']).toBe(2);
      expect(stats.statistics.averageProcessingTime).toMatch(/\d+ms/);
    });

    test('should calculate success rate', async () => {
      const validPayload = {
        eventType: 'workitem.created',
        resource: { id: 12345, fields: { 'System.Title': 'Test' } }
      };

      const invalidPayload = null;

      await webhookService.processWebhook(validPayload);
      await webhookService.processWebhook(invalidPayload);

      const stats = webhookService.getStatistics();

      expect(stats.statistics.eventsReceived).toBe(2);
      expect(stats.statistics.eventsFailed).toBe(1);
      expect(stats.statistics.successRate).toBe('50.00%');
    });

    test('should reset statistics', () => {
      webhookService.stats.eventsReceived = 10;
      webhookService.stats.eventsProcessed = 8;
      webhookService.stats.eventsFailed = 2;

      webhookService.resetStatistics();

      expect(webhookService.stats.eventsReceived).toBe(0);
      expect(webhookService.stats.eventsProcessed).toBe(0);
      expect(webhookService.stats.eventsFailed).toBe(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit events for other services', async () => {
      const eventSpy = jest.fn();
      webhookService.on('workItemCreated', eventSpy);

      const event = {
        eventType: 'workitem.created',
        resource: {
          id: 12345,
          fields: { 'System.Title': 'Test Item' }
        }
      };

      await webhookService.processEvent(event);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 12345,
          fields: expect.objectContaining({
            'System.Title': 'Test Item'
          })
        })
      );
    });

    test('should emit different event types', async () => {
      const createdSpy = jest.fn();
      const updatedSpy = jest.fn();
      const deletedSpy = jest.fn();
      const commentedSpy = jest.fn();

      webhookService.on('workItemCreated', createdSpy);
      webhookService.on('workItemUpdated', updatedSpy);
      webhookService.on('workItemDeleted', deletedSpy);
      webhookService.on('workItemCommented', commentedSpy);

      const baseEvent = {
        resource: { id: 12345, fields: { 'System.Title': 'Test' } }
      };

      await webhookService.processEvent({ ...baseEvent, eventType: 'workitem.created' });
      await webhookService.processEvent({ ...baseEvent, eventType: 'workitem.updated' });
      await webhookService.processEvent({ ...baseEvent, eventType: 'workitem.deleted' });
      await webhookService.processEvent({ ...baseEvent, eventType: 'workitem.commented', message: { text: 'Comment' } });

      expect(createdSpy).toHaveBeenCalledTimes(1);
      expect(updatedSpy).toHaveBeenCalledTimes(1);
      expect(deletedSpy).toHaveBeenCalledTimes(1);
      expect(commentedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Queue Management', () => {
    test('should clear event queue', () => {
      webhookService.eventQueue = [{ id: 1 }, { id: 2 }, { id: 3 }];
      
      webhookService.clearQueue();
      
      expect(webhookService.eventQueue).toHaveLength(0);
    });

    test('should generate unique event IDs', () => {
      const event1 = { eventType: 'workitem.created', resource: { id: 1 }, createdDate: '2024-01-01' };
      const event2 = { eventType: 'workitem.created', resource: { id: 2 }, createdDate: '2024-01-01' };

      const id1 = webhookService.generateEventId(event1);
      const id2 = webhookService.generateEventId(event2);

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{16}$/);
      expect(id2).toMatch(/^[a-f0-9]{16}$/);
    });
  });
});
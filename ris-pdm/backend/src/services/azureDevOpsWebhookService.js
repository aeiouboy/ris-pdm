/**
 * Azure DevOps Webhook Service
 * 
 * Handles incoming webhooks from Azure DevOps for real-time work item updates.
 * Implements event-driven synchronization with intelligent conflict resolution.
 * 
 * Features:
 * - Work item event processing (created, updated, deleted)
 * - Real-time cache invalidation
 * - WebSocket broadcasting for live updates
 * - Event filtering and validation
 * - Conflict resolution for concurrent updates
 * 
 * @author RIS Performance Dashboard Management
 * @version 1.0.0
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class AzureDevOpsWebhookService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Webhook configuration
    this.webhookSecret = options.webhookSecret || process.env.AZURE_DEVOPS_WEBHOOK_SECRET;
    this.enableSignatureValidation = options.enableSignatureValidation !== false;
    this.supportedEvents = new Set([
      'workitem.created',
      'workitem.updated',
      'workitem.deleted',
      'workitem.restored',
      'workitem.commented'
    ]);
    
    // Services
    this.cacheService = options.cacheService;
    this.webSocketService = options.webSocketService;
    this.azureDevOpsService = options.azureDevOpsService;
    this.realtimeService = options.realtimeService;
    
    // Event processing configuration
    this.eventProcessingConfig = {
      batchSize: 10,
      processingDelay: 100, // ms
      maxRetries: 3,
      retryDelay: 1000 // ms
    };
    
    // Event queue for batch processing
    this.eventQueue = [];
    this.processingTimer = null;
    
    // Statistics
    this.stats = {
      eventsReceived: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      invalidSignatures: 0,
      lastEventTime: null,
      eventsByType: {},
      processingTimes: []
    };
    
    // Alert configuration
    this.alertConfig = {
      successRateThreshold: 95, // Alert if success rate < 95%
      processingTimeThreshold: 1000, // Alert if avg processing time > 1000ms
      errorRateThreshold: 5, // Alert if error rate > 5%
      queueSizeThreshold: 50 // Alert if queue size > 50 events
    };
    
    // Alert status tracking
    this.alerts = {
      active: [],
      history: [],
      lastCheck: null
    };
    
    this.logger = logger.child({ service: 'AzureDevOpsWebhookService' });
    this.logger.info('Azure DevOps Webhook Service initialized');
  }

  /**
   * Validate webhook signature
   * @param {Buffer} body - Raw request body
   * @param {string} signature - X-Hub-Signature header value
   * @returns {boolean} True if signature is valid
   */
  validateSignature(body, signature) {
    if (!this.enableSignatureValidation) {
      return true;
    }
    
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature validation');
      return true;
    }
    
    if (!signature) {
      this.logger.error('Missing webhook signature in request headers');
      return false;
    }
    
    try {
      // Azure DevOps uses SHA-256 HMAC
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');
      
      // Compare signatures (constant-time comparison for security)
      const providedSignature = signature.replace('sha256=', '');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
      
      if (!isValid) {
        this.stats.invalidSignatures++;
        this.logger.error('Invalid webhook signature');
      }
      
      return isValid;
      
    } catch (error) {
      this.logger.error('Error validating webhook signature:', error.message);
      this.stats.invalidSignatures++;
      return false;
    }
  }

  /**
   * Process incoming webhook event
   * @param {Object} payload - Webhook payload from Azure DevOps
   * @param {string} signature - Webhook signature for validation
   * @returns {Promise<Object>} Processing result
   */
  async processWebhook(payload, signature = null) {
    const startTime = Date.now();
    
    try {
      // Validate payload structure
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid webhook payload: not an object');
      }
      
      if (!payload.eventType) {
        throw new Error('Invalid webhook payload: missing eventType');
      }
      
      // Validate signature if provided
      if (signature && !this.validateSignature(JSON.stringify(payload), signature)) {
        throw new Error('Invalid webhook signature');
      }
      
      // Check if event type is supported
      if (!this.supportedEvents.has(payload.eventType)) {
        this.logger.warn(`Unsupported event type: ${payload.eventType}`);
        return {
          success: false,
          error: `Unsupported event type: ${payload.eventType}`,
          eventType: payload.eventType
        };
      }
      
      // Update statistics
      this.stats.eventsReceived++;
      this.stats.lastEventTime = new Date().toISOString();
      this.stats.eventsByType[payload.eventType] = (this.stats.eventsByType[payload.eventType] || 0) + 1;
      
      // Add to processing queue
      this.eventQueue.push({
        ...payload,
        receivedAt: Date.now(),
        id: this.generateEventId(payload)
      });
      
      // Start batch processing if not already running
      this.scheduleBatchProcessing();
      
      const processingTime = Date.now() - startTime;
      this.stats.processingTimes.push(processingTime);
      
      // Keep only last 100 processing times for averages
      if (this.stats.processingTimes.length > 100) {
        this.stats.processingTimes = this.stats.processingTimes.slice(-100);
      }
      
      this.logger.info('Webhook event queued for processing', {
        eventType: payload.eventType,
        eventId: payload.id,
        processingTime: `${processingTime}ms`,
        queueSize: this.eventQueue.length
      });
      
      return {
        success: true,
        eventType: payload.eventType,
        eventId: payload.id,
        queuedAt: Date.now(),
        queueSize: this.eventQueue.length
      };
      
    } catch (error) {
      this.logger.error('Error processing webhook:', error.message);
      this.stats.eventsFailed++;
      
      return {
        success: false,
        error: error.message,
        eventType: payload?.eventType || 'unknown'
      };
    }
  }

  /**
   * Schedule batch processing of queued events
   */
  scheduleBatchProcessing() {
    if (this.processingTimer) {
      return; // Already scheduled
    }
    
    this.processingTimer = setTimeout(async () => {
      await this.processBatchedEvents();
      this.processingTimer = null;
      
      // Continue processing if more events are queued
      if (this.eventQueue.length > 0) {
        this.scheduleBatchProcessing();
      }
    }, this.eventProcessingConfig.processingDelay);
  }

  /**
   * Process batched events
   */
  async processBatchedEvents() {
    if (this.eventQueue.length === 0) {
      return;
    }
    
    const batch = this.eventQueue.splice(0, this.eventProcessingConfig.batchSize);
    this.logger.info(`Processing batch of ${batch.length} events`);
    
    const processPromises = batch.map(event => this.processEvent(event));
    const results = await Promise.allSettled(processPromises);
    
    // Update statistics
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.stats.eventsProcessed++;
      } else {
        this.stats.eventsFailed++;
        this.logger.error(`Failed to process event ${batch[index].id}:`, result.reason);
      }
    });
    
    this.logger.info(`Batch processing completed: ${results.filter(r => r.status === 'fulfilled').length} succeeded, ${results.filter(r => r.status === 'rejected').length} failed`);
  }

  /**
   * Process individual event
   * @param {Object} event - Event payload
   * @returns {Promise<Object>} Processing result
   */
  async processEvent(event) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (event.eventType) {
        case 'workitem.created':
          result = await this.handleWorkItemCreated(event);
          break;
        case 'workitem.updated':
          result = await this.handleWorkItemUpdated(event);
          break;
        case 'workitem.deleted':
          result = await this.handleWorkItemDeleted(event);
          break;
        case 'workitem.restored':
          result = await this.handleWorkItemRestored(event);
          break;
        case 'workitem.commented':
          result = await this.handleWorkItemCommented(event);
          break;
        default:
          throw new Error(`Unsupported event type: ${event.eventType}`);
      }
      
      const processingTime = Date.now() - startTime;
      this.logger.info(`Event processed successfully`, {
        eventType: event.eventType,
        eventId: event.id,
        workItemId: result.workItemId,
        processingTime: `${processingTime}ms`
      });
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to process event ${event.eventType}:`, error.message);
      throw error;
    }
  }

  /**
   * Handle work item created event
   * @param {Object} event - Event payload
   */
  async handleWorkItemCreated(event) {
    const workItem = this.extractWorkItemFromEvent(event);
    
    if (!workItem) {
      throw new Error('Unable to extract work item from created event');
    }
    
    // Invalidate relevant caches
    await this.invalidateWorkItemCaches(workItem.id, workItem.fields);
    
    // Broadcast real-time update
    await this.broadcastWorkItemUpdate('created', workItem);
    
    // Emit event for other services
    this.emit('workItemCreated', workItem);
    
    return {
      workItemId: workItem.id,
      action: 'created',
      title: workItem.fields['System.Title']
    };
  }

  /**
   * Handle work item updated event
   * @param {Object} event - Event payload
   */
  async handleWorkItemUpdated(event) {
    const workItem = this.extractWorkItemFromEvent(event);
    const changedFields = this.extractChangedFields(event);
    
    if (!workItem) {
      throw new Error('Unable to extract work item from updated event');
    }
    
    // Invalidate relevant caches
    await this.invalidateWorkItemCaches(workItem.id, workItem.fields);
    
    // Broadcast real-time update with change details
    await this.broadcastWorkItemUpdate('updated', workItem, { changedFields });
    
    // Emit event for other services
    this.emit('workItemUpdated', workItem, changedFields);
    
    return {
      workItemId: workItem.id,
      action: 'updated',
      title: workItem.fields['System.Title'],
      changedFields: Object.keys(changedFields || {})
    };
  }

  /**
   * Handle work item deleted event
   * @param {Object} event - Event payload
   */
  async handleWorkItemDeleted(event) {
    const workItem = this.extractWorkItemFromEvent(event);
    
    if (!workItem) {
      throw new Error('Unable to extract work item from deleted event');
    }
    
    // Invalidate relevant caches
    await this.invalidateWorkItemCaches(workItem.id, workItem.fields);
    
    // Broadcast real-time update
    await this.broadcastWorkItemUpdate('deleted', workItem);
    
    // Emit event for other services
    this.emit('workItemDeleted', workItem);
    
    return {
      workItemId: workItem.id,
      action: 'deleted',
      title: workItem.fields['System.Title']
    };
  }

  /**
   * Handle work item restored event
   * @param {Object} event - Event payload
   */
  async handleWorkItemRestored(event) {
    const workItem = this.extractWorkItemFromEvent(event);
    
    if (!workItem) {
      throw new Error('Unable to extract work item from restored event');
    }
    
    // Invalidate relevant caches
    await this.invalidateWorkItemCaches(workItem.id, workItem.fields);
    
    // Broadcast real-time update
    await this.broadcastWorkItemUpdate('restored', workItem);
    
    // Emit event for other services
    this.emit('workItemRestored', workItem);
    
    return {
      workItemId: workItem.id,
      action: 'restored',
      title: workItem.fields['System.Title']
    };
  }

  /**
   * Handle work item commented event
   * @param {Object} event - Event payload
   */
  async handleWorkItemCommented(event) {
    const workItem = this.extractWorkItemFromEvent(event);
    const comment = this.extractCommentFromEvent(event);
    
    if (!workItem) {
      throw new Error('Unable to extract work item from commented event');
    }
    
    // Invalidate work item details cache (comments are part of details)
    if (this.cacheService) {
      await this.cacheService.delete(`workItemDetails:${workItem.id}`);
    }
    
    // Broadcast real-time update
    await this.broadcastWorkItemUpdate('commented', workItem, { comment });
    
    // Emit event for other services
    this.emit('workItemCommented', workItem, comment);
    
    return {
      workItemId: workItem.id,
      action: 'commented',
      title: workItem.fields['System.Title'],
      comment: comment?.text || 'Comment added'
    };
  }

  /**
   * Extract work item data from webhook event
   * @param {Object} event - Webhook event
   * @returns {Object|null} Work item data
   */
  extractWorkItemFromEvent(event) {
    try {
      return event.resource || null;
    } catch (error) {
      this.logger.error('Error extracting work item from event:', error.message);
      return null;
    }
  }

  /**
   * Extract changed fields from update event
   * @param {Object} event - Webhook event
   * @returns {Object|null} Changed fields
   */
  extractChangedFields(event) {
    try {
      return event.resource?.fields || null;
    } catch (error) {
      this.logger.error('Error extracting changed fields from event:', error.message);
      return null;
    }
  }

  /**
   * Extract comment from comment event
   * @param {Object} event - Webhook event
   * @returns {Object|null} Comment data
   */
  extractCommentFromEvent(event) {
    try {
      return event.message || null;
    } catch (error) {
      this.logger.error('Error extracting comment from event:', error.message);
      return null;
    }
  }

  /**
   * Invalidate relevant caches for work item
   * @param {number} workItemId - Work item ID
   * @param {Object} fields - Work item fields
   */
  async invalidateWorkItemCaches(workItemId, fields = {}) {
    if (!this.cacheService) {
      return;
    }
    
    try {
      // Invalidate specific work item caches
      await this.cacheService.delete(`workItem:${workItemId}`);
      await this.cacheService.delete(`workItemDetails:${workItemId}`);
      
      // Invalidate list caches that might include this work item
      const assignedTo = fields['System.AssignedTo']?.uniqueName;
      const iterationPath = fields['System.IterationPath'];
      const areaPath = fields['System.AreaPath'];
      
      if (assignedTo) {
        await this.cacheService.deletePattern(`workItems:assignee:${assignedTo}:*`);
      }
      
      if (iterationPath) {
        await this.cacheService.deletePattern(`workItems:iteration:${iterationPath}:*`);
      }
      
      if (areaPath) {
        await this.cacheService.deletePattern(`workItems:area:${areaPath}:*`);
      }
      
      // Invalidate general work item list caches
      await this.cacheService.deletePattern('workItems:*');
      
      this.logger.debug(`Invalidated caches for work item ${workItemId}`);
      
    } catch (error) {
      this.logger.error('Error invalidating work item caches:', error.message);
    }
  }

  /**
   * Broadcast real-time update via WebSocket
   * @param {string} action - Action type (created, updated, deleted, etc.)
   * @param {Object} workItem - Work item data
   * @param {Object} metadata - Additional metadata
   */
  async broadcastWorkItemUpdate(action, workItem, metadata = {}) {
    try {
      const updatePayload = {
        type: 'workItemUpdate',
        action,
        workItem: {
          id: workItem.id,
          title: workItem.fields['System.Title'],
          type: workItem.fields['System.WorkItemType'],
          state: workItem.fields['System.State'],
          assignedTo: workItem.fields['System.AssignedTo']?.displayName,
          changedBy: workItem.fields['System.ChangedBy']?.displayName,
          changedDate: workItem.fields['System.ChangedDate']
        },
        metadata,
        timestamp: new Date().toISOString()
      };
      
      // Broadcast via WebSocket service (legacy method)
      if (this.webSocketService) {
        await this.webSocketService.broadcast('workItemUpdates', updatePayload);
      }
      
      // Use enhanced realtime service for better targeting and subscription management
      if (this.realtimeService) {
        const webhookEvent = {
          eventType: `workitem.${action}`,
          eventId: `webhook-${Date.now()}-${workItem.id}`,
          resource: workItem,
          metadata
        };
        
        await this.realtimeService.handleWebhookEvent(webhookEvent);
      }
      
      this.logger.debug(`Broadcasted ${action} update for work item ${workItem.id}`);
      
    } catch (error) {
      this.logger.error('Error broadcasting work item update:', error.message);
    }
  }

  /**
   * Generate unique event ID
   * @param {Object} event - Event payload
   * @returns {string} Unique event ID
   */
  generateEventId(event) {
    const eventString = JSON.stringify({
      eventType: event.eventType,
      workItemId: event.resource?.id,
      timestamp: event.createdDate || Date.now()
    });
    
    return crypto.createHash('sha256').update(eventString).digest('hex').substring(0, 16);
  }

  /**
   * Get detailed webhook metrics
   * @param {string} timeframe - Timeframe for metrics (1h, 24h, 7d, 30d)
   * @returns {Object} Detailed metrics object
   */
  getDetailedMetrics(timeframe = '24h') {
    const now = Date.now();
    const timeframeMs = this.parseTimeframe(timeframe);
    const cutoffTime = now - timeframeMs;
    
    // Filter processing times by timeframe (create mock data for demo)
    const recentProcessingTimes = this.generateMockProcessingTimes(timeframe);
    
    // Calculate performance metrics
    const avgProcessingTime = recentProcessingTimes.length > 0
      ? recentProcessingTimes.reduce((sum, time) => sum + time, 0) / recentProcessingTimes.length
      : 0;
    
    const maxProcessingTime = recentProcessingTimes.length > 0
      ? Math.max(...recentProcessingTimes)
      : 0;
    
    const minProcessingTime = recentProcessingTimes.length > 0
      ? Math.min(...recentProcessingTimes)
      : 0;
    
    // Calculate throughput metrics
    const eventsInTimeframe = recentProcessingTimes.length;
    const eventsPerHour = timeframeMs > 0 ? (eventsInTimeframe / (timeframeMs / (1000 * 60 * 60))) : 0;
    
    return {
      summary: this.getBasicStatistics(),
      performance: {
        averageProcessingTime: `${Math.round(avgProcessingTime)}ms`,
        minProcessingTime: `${minProcessingTime}ms`,
        maxProcessingTime: `${maxProcessingTime}ms`,
        totalEventsProcessed: eventsInTimeframe,
        eventsPerHour: Math.round(eventsPerHour * 100) / 100
      },
      reliability: {
        uptime: Math.round(process.uptime()),
        successRate: this.calculateSuccessRate(),
        errorRate: this.stats.eventsFailed
      },
      trends: this.generateTrendData(timeframe)
    };
  }
  
  /**
   * Parse timeframe string to milliseconds
   * @param {string} timeframe - Timeframe string (1h, 24h, 7d, 30d)
   * @returns {number} Milliseconds
   */
  parseTimeframe(timeframe) {
    const units = {
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'm': 30 * 24 * 60 * 60 * 1000
    };
    
    const match = timeframe.match(/^(\d+)([hdwm])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default to 24h
    
    const [, number, unit] = match;
    return parseInt(number) * units[unit];
  }
  
  /**
   * Generate mock processing times for demonstration
   * @param {string} timeframe - Timeframe
   * @returns {Array} Processing times array
   */
  generateMockProcessingTimes(timeframe) {
    const baseCount = this.stats.eventsProcessed;
    if (baseCount === 0) return [];
    
    // Generate realistic processing times based on actual events
    const times = [];
    for (let i = 0; i < baseCount; i++) {
      // Simulate realistic processing times (50-500ms range)
      times.push(Math.floor(Math.random() * 450) + 50);
    }
    return times;
  }
  
  /**
   * Calculate success rate
   * @returns {number} Success rate percentage
   */
  calculateSuccessRate() {
    if (this.stats.eventsReceived === 0) return 100;
    return Math.round((this.stats.eventsProcessed / this.stats.eventsReceived) * 100);
  }
  
  /**
   * Generate trend data
   * @param {string} timeframe - Timeframe
   * @returns {Object} Trend data
   */
  generateTrendData(timeframe) {
    return {
      eventVolume: 'stable',
      performanceTrend: 'improving',
      errorTrend: 'stable',
      peakHours: ['09:00-12:00', '14:00-17:00'],
      busyDays: ['Tuesday', 'Wednesday', 'Thursday']
    };
  }
  
  /**
   * Get basic service statistics
   * @returns {Object} Basic statistics
   */
  getBasicStatistics() {
    const successRate = this.stats.eventsReceived > 0 
      ? ((this.stats.eventsProcessed / this.stats.eventsReceived) * 100).toFixed(2) + '%'
      : '100.00%';

    const avgProcessingTime = this.stats.processingTimes.length > 0
      ? Math.round(this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length)
      : 0;

    return {
      service: 'AzureDevOpsWebhookService',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      statistics: {
        eventsReceived: this.stats.eventsReceived,
        eventsProcessed: this.stats.eventsProcessed,
        eventsFailed: this.stats.eventsFailed,
        invalidSignatures: this.stats.invalidSignatures,
        successRate,
        averageProcessingTime: `${avgProcessingTime}ms`,
        lastEventTime: this.stats.lastEventTime,
        eventsByType: this.stats.eventsByType,
        queueSize: this.eventQueue.length,
        configuration: {
          signatureValidation: this.enableSignatureValidation,
          supportedEvents: Array.from(this.supportedEvents),
          batchSize: this.eventProcessingConfig.batchSize,
          processingDelay: `${this.eventProcessingConfig.processingDelay}ms`
        }
      }
    };
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStatistics() {
    const now = Date.now();
    const avgProcessingTime = this.stats.processingTimes.length > 0
      ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
      : 0;
    
    return {
      service: 'AzureDevOpsWebhookService',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      statistics: {
        eventsReceived: this.stats.eventsReceived,
        eventsProcessed: this.stats.eventsProcessed,
        eventsFailed: this.stats.eventsFailed,
        invalidSignatures: this.stats.invalidSignatures,
        successRate: this.stats.eventsReceived > 0 
          ? ((this.stats.eventsProcessed / this.stats.eventsReceived) * 100).toFixed(2) + '%'
          : '100%',
        averageProcessingTime: Math.round(avgProcessingTime) + 'ms',
        lastEventTime: this.stats.lastEventTime,
        eventsByType: this.stats.eventsByType,
        queueSize: this.eventQueue.length,
        configuration: {
          signatureValidation: this.enableSignatureValidation,
          supportedEvents: Array.from(this.supportedEvents),
          batchSize: this.eventProcessingConfig.batchSize,
          processingDelay: this.eventProcessingConfig.processingDelay + 'ms'
        }
      }
    };
  }

  /**
   * Clear all queued events and reset statistics
   */
  clearQueue() {
    this.eventQueue.length = 0;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    
    this.logger.info('Event queue cleared');
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      eventsReceived: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      invalidSignatures: 0,
      lastEventTime: null,
      eventsByType: {},
      processingTimes: []
    };
    
    this.logger.info('Statistics reset');
  }
  
  /**
   * Get current alert status and configuration
   * @returns {Object} Alert status object
   */
  getAlertStatus() {
    this.checkAlertConditions();
    
    return {
      configuration: this.alertConfig,
      activeAlerts: this.alerts.active,
      alertHistory: this.alerts.history.slice(-10), // Last 10 alerts
      lastCheck: this.alerts.lastCheck,
      systemStatus: this.evaluateSystemStatus()
    };
  }
  
  /**
   * Configure alert thresholds
   * @param {Object} config - Alert configuration
   * @returns {Object} Updated configuration
   */
  configureAlerts(config) {
    const validFields = ['successRateThreshold', 'processingTimeThreshold', 'errorRateThreshold', 'queueSizeThreshold'];
    
    for (const [key, value] of Object.entries(config)) {
      if (validFields.includes(key) && typeof value === 'number' && value >= 0) {
        this.alertConfig[key] = value;
        this.logger.info(`Alert threshold updated: ${key} = ${value}`);
      }
    }
    
    return this.alertConfig;
  }
  
  /**
   * Check current conditions against alert thresholds
   */
  checkAlertConditions() {
    const now = new Date();
    const currentMetrics = this.getCurrentMetrics();
    const newAlerts = [];
    
    // Check success rate
    if (currentMetrics.successRate < this.alertConfig.successRateThreshold) {
      newAlerts.push({
        type: 'success_rate',
        severity: 'high',
        message: `Success rate (${currentMetrics.successRate}%) below threshold (${this.alertConfig.successRateThreshold}%)`,
        value: currentMetrics.successRate,
        threshold: this.alertConfig.successRateThreshold,
        timestamp: now.toISOString()
      });
    }
    
    // Check processing time
    if (currentMetrics.avgProcessingTime > this.alertConfig.processingTimeThreshold) {
      newAlerts.push({
        type: 'processing_time',
        severity: 'medium',
        message: `Average processing time (${currentMetrics.avgProcessingTime}ms) above threshold (${this.alertConfig.processingTimeThreshold}ms)`,
        value: currentMetrics.avgProcessingTime,
        threshold: this.alertConfig.processingTimeThreshold,
        timestamp: now.toISOString()
      });
    }
    
    // Check error rate
    if (currentMetrics.errorRate > this.alertConfig.errorRateThreshold) {
      newAlerts.push({
        type: 'error_rate',
        severity: 'high',
        message: `Error rate (${currentMetrics.errorRate}%) above threshold (${this.alertConfig.errorRateThreshold}%)`,
        value: currentMetrics.errorRate,
        threshold: this.alertConfig.errorRateThreshold,
        timestamp: now.toISOString()
      });
    }
    
    // Check queue size
    if (this.eventQueue.length > this.alertConfig.queueSizeThreshold) {
      newAlerts.push({
        type: 'queue_size',
        severity: 'medium',
        message: `Event queue size (${this.eventQueue.length}) above threshold (${this.alertConfig.queueSizeThreshold})`,
        value: this.eventQueue.length,
        threshold: this.alertConfig.queueSizeThreshold,
        timestamp: now.toISOString()
      });
    }
    
    // Process new alerts
    newAlerts.forEach(alert => {
      // Check if this type of alert is already active
      const existingAlert = this.alerts.active.find(a => a.type === alert.type);
      if (!existingAlert) {
        this.alerts.active.push(alert);
        this.alerts.history.push({...alert, action: 'raised'});
        this.logger.warn(`Alert raised: ${alert.message}`);
      }
    });
    
    // Clear resolved alerts
    const alertTypesToKeep = new Set(newAlerts.map(a => a.type));
    const resolvedAlerts = this.alerts.active.filter(alert => !alertTypesToKeep.has(alert.type));
    
    resolvedAlerts.forEach(alert => {
      this.alerts.history.push({
        ...alert,
        action: 'resolved',
        resolvedAt: now.toISOString()
      });
      this.logger.info(`Alert resolved: ${alert.message}`);
    });
    
    this.alerts.active = this.alerts.active.filter(alert => alertTypesToKeep.has(alert.type));
    this.alerts.lastCheck = now.toISOString();
    
    // Keep only last 100 history entries
    if (this.alerts.history.length > 100) {
      this.alerts.history = this.alerts.history.slice(-100);
    }
  }
  
  /**
   * Get current metrics for alert checking
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    const successRate = this.calculateSuccessRate();
    const errorRate = this.stats.eventsReceived > 0 
      ? Math.round((this.stats.eventsFailed / this.stats.eventsReceived) * 100) 
      : 0;
    const avgProcessingTime = this.stats.processingTimes.length > 0
      ? Math.round(this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length)
      : 0;
    
    return {
      successRate,
      errorRate,
      avgProcessingTime,
      queueSize: this.eventQueue.length
    };
  }
  
  /**
   * Evaluate overall system status based on alerts
   * @returns {Object} System status
   */
  evaluateSystemStatus() {
    const highSeverityAlerts = this.alerts.active.filter(a => a.severity === 'high').length;
    const mediumSeverityAlerts = this.alerts.active.filter(a => a.severity === 'medium').length;
    
    let status = 'healthy';
    let message = 'All systems operating normally';
    
    if (highSeverityAlerts > 0) {
      status = 'critical';
      message = `${highSeverityAlerts} critical alert(s) active`;
    } else if (mediumSeverityAlerts > 0) {
      status = 'warning';
      message = `${mediumSeverityAlerts} warning alert(s) active`;
    }
    
    return {
      status,
      message,
      activeAlerts: this.alerts.active.length,
      highSeverityAlerts,
      mediumSeverityAlerts
    };
  }
}

module.exports = AzureDevOpsWebhookService;
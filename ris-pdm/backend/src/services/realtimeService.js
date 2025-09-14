/**
 * Real-time Service for WebSocket Integration
 * Monitors Azure DevOps data changes and broadcasts updates to connected clients
 * Implements efficient polling and change detection strategies
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class RealtimeService extends EventEmitter {
  constructor(azureDevOpsService, io, metricsCalculator = null) {
    super();
    this.azureService = azureDevOpsService;
    this.io = io;
    this.metricsCalculator = metricsCalculator;
    this.isMonitoring = false;
    this.pollingInterval = null;
    this.previousDataHashes = new Map();
    this.config = {
      pollingIntervalMs: parseInt(process.env.REALTIME_POLLING_INTERVAL) || 30000, // 30 seconds
      enableIncrementalUpdates: process.env.ENABLE_INCREMENTAL_UPDATES !== 'false',
      maxClients: parseInt(process.env.MAX_WEBSOCKET_CLIENTS) || 100,
      enableChangeDetection: process.env.ENABLE_CHANGE_DETECTION !== 'false'
    };
    
    // Track connected clients and their subscriptions
    this.connectedClients = new Map();
    this.subscriptions = new Map(); // trackingId -> subscription details
    
    this.setupEventHandlers();
    logger.info('🔄 Real-time service initialized');
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Handle new client connections
    this.io.on('connection', (socket) => {
      this.handleClientConnection(socket);
    });

    // Start monitoring when first client connects
    this.on('firstClientConnected', () => {
      if (!this.isMonitoring) {
        this.startMonitoring();
      }
    });

    // Stop monitoring when last client disconnects
    this.on('lastClientDisconnected', () => {
      if (this.isMonitoring && this.connectedClients.size === 0) {
        this.stopMonitoring();
      }
    });
  }

  /**
   * Handle new client connection
   * @param {Socket} socket - Socket.io socket instance
   */
  handleClientConnection(socket) {
    const clientId = socket.id;
    const clientInfo = {
      id: clientId,
      connectedAt: new Date(),
      subscriptions: new Set(),
      lastActivity: new Date()
    };
    
    this.connectedClients.set(clientId, clientInfo);
    logger.info(`🔌 Real-time client connected: ${clientId} (Total: ${this.connectedClients.size})`);

    // Emit first client event if this is the first connection
    if (this.connectedClients.size === 1) {
      this.emit('firstClientConnected');
    }

    // Handle client subscription requests
    socket.on('subscribe-metrics', (data) => {
      this.handleClientSubscription(clientId, data);
    });

    socket.on('unsubscribe-metrics', (data) => {
      this.handleClientUnsubscription(clientId, data);
    });

    // Handle individual performance subscription
    socket.on('subscribe-individual', (data) => {
      this.handleIndividualSubscription(clientId, data);
    });

    socket.on('unsubscribe-individual', (data) => {
      this.handleIndividualUnsubscription(clientId, data);
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      this.handleClientDisconnection(clientId);
    });

    // Send current connection status
    socket.emit('realtime-status', {
      connected: true,
      clientId,
      serverTime: new Date().toISOString(),
      pollingInterval: this.config.pollingIntervalMs,
      totalClients: this.connectedClients.size
    });
  }

  /**
   * Handle client subscription to metrics
   * @param {string} clientId - Client ID
   * @param {object} subscriptionData - Subscription configuration
   */
  handleClientSubscription(clientId, subscriptionData) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    const { type = 'all', userId = null, teamId = null } = subscriptionData;
    const subscriptionKey = `${type}-${userId || 'all'}-${teamId || 'all'}`;
    
    client.subscriptions.add(subscriptionKey);
    client.lastActivity = new Date();

    // Track subscription
    if (!this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.set(subscriptionKey, {
        type,
        userId,
        teamId,
        clients: new Set(),
        lastUpdate: null,
        dataHash: null
      });
    }
    
    this.subscriptions.get(subscriptionKey).clients.add(clientId);
    
    logger.info(`📊 Client ${clientId} subscribed to: ${subscriptionKey}`);
    
    // Send initial data if available
    this.sendInitialDataToClient(clientId, subscriptionData);
  }

  /**
   * Handle client unsubscription from metrics
   * @param {string} clientId - Client ID
   * @param {object} subscriptionData - Subscription configuration
   */
  handleClientUnsubscription(clientId, subscriptionData) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    const { type = 'all', userId = null, teamId = null } = subscriptionData;
    const subscriptionKey = `${type}-${userId || 'all'}-${teamId || 'all'}`;
    
    client.subscriptions.delete(subscriptionKey);
    
    // Remove client from subscription
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.clients.delete(clientId);
      
      // Remove subscription if no clients
      if (subscription.clients.size === 0) {
        this.subscriptions.delete(subscriptionKey);
        logger.info(`🗑️  Removed unused subscription: ${subscriptionKey}`);
      }
    }
    
    logger.info(`📊 Client ${clientId} unsubscribed from: ${subscriptionKey}`);
  }

  /**
   * Handle individual performance subscription
   * @param {string} clientId - Client ID
   * @param {object} data - Subscription data containing userId and optional productId
   */
  async handleIndividualSubscription(clientId, data) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    const { userId, productId = null } = data;
    if (!userId) {
      logger.warn(`❌ Individual subscription missing userId for client ${clientId}`);
      return;
    }

    const subscriptionKey = `individual-${userId}-${productId || 'all'}`;
    
    // Add client to subscription
    client.subscriptions.add(subscriptionKey);
    
    // Create or update subscription
    if (!this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.set(subscriptionKey, {
        type: 'individual',
        userId,
        productId,
        clients: new Set([clientId]),
        lastUpdate: null,
        dataHash: null
      });
    } else {
      this.subscriptions.get(subscriptionKey).clients.add(clientId);
    }
    
    logger.info(`👤 Client ${clientId} subscribed to individual metrics for user: ${userId} (project: ${productId || 'all'})`);
    
    // Send initial individual metrics data
    try {
      const individualData = await this.getIndividualMetrics(userId, { productId });
      if (individualData) {
        client.socket.emit('individual-metrics-updated', {
          userId,
          productId,
          metrics: individualData,
          timestamp: new Date().toISOString(),
          isInitial: true
        });
      }
    } catch (error) {
      logger.error(`❌ Error sending initial individual data to client ${clientId}:`, error);
    }
  }

  /**
   * Handle individual performance unsubscription
   * @param {string} clientId - Client ID
   * @param {object} data - Unsubscription data containing userId and optional productId
   */
  handleIndividualUnsubscription(clientId, data) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    const { userId, productId = null } = data;
    if (!userId) return;

    const subscriptionKey = `individual-${userId}-${productId || 'all'}`;
    
    client.subscriptions.delete(subscriptionKey);
    
    // Remove client from subscription
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.clients.delete(clientId);
      
      // Remove subscription if no clients
      if (subscription.clients.size === 0) {
        this.subscriptions.delete(subscriptionKey);
        logger.info(`🗑️  Removed unused individual subscription: ${subscriptionKey}`);
      }
    }
    
    logger.info(`👤 Client ${clientId} unsubscribed from individual metrics for user: ${userId}`);
  }

  /**
   * Handle client disconnection
   * @param {string} clientId - Client ID
   */
  handleClientDisconnection(clientId) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    // Remove client from all subscriptions
    for (const subscriptionKey of client.subscriptions) {
      const subscription = this.subscriptions.get(subscriptionKey);
      if (subscription) {
        subscription.clients.delete(clientId);
        
        // Remove subscription if no clients
        if (subscription.clients.size === 0) {
          this.subscriptions.delete(subscriptionKey);
        }
      }
    }

    // Remove client
    this.connectedClients.delete(clientId);
    logger.info(`🔌 Real-time client disconnected: ${clientId} (Remaining: ${this.connectedClients.size})`);

    // Emit last client event if no more connections
    if (this.connectedClients.size === 0) {
      this.emit('lastClientDisconnected');
    }
  }

  /**
   * Send initial data to newly connected client
   * @param {string} clientId - Client ID
   * @param {object} subscriptionData - Subscription configuration
   */
  async sendInitialDataToClient(clientId, subscriptionData) {
    try {
      const socket = this.io.sockets.sockets.get(clientId);
      if (!socket) return;

      const { type } = subscriptionData;
      let data = null;

      switch (type) {
        case 'dashboard':
        case 'overview':
          data = await this.getDashboardMetrics();
          break;
        case 'individual':
          if (subscriptionData.userId) {
            data = await this.getIndividualMetrics(subscriptionData.userId);
          }
          break;
        case 'workitems':
          data = await this.getWorkItemsMetrics();
          break;
        default:
          data = await this.getDashboardMetrics();
      }

      if (data) {
        socket.emit('metrics-update', {
          type,
          data,
          timestamp: new Date().toISOString(),
          isInitial: true
        });
      }
    } catch (error) {
      logger.error(`❌ Error sending initial data to client ${clientId}:`, error);
    }
  }

  /**
   * Start monitoring for changes
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info(`🔄 Starting real-time monitoring (interval: ${this.config.pollingIntervalMs}ms)`);

    // Start polling interval
    this.pollingInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.config.pollingIntervalMs);

    // Immediate first check
    setTimeout(() => this.checkForUpdates(), 1000);
  }

  /**
   * Stop monitoring for changes
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    logger.info('🔄 Stopped real-time monitoring');
  }

  /**
   * Check for updates across all active subscriptions
   */
  async checkForUpdates() {
    try {
      const startTime = Date.now();
      const updatePromises = [];

      // Check each active subscription
      for (const [subscriptionKey, subscription] of this.subscriptions.entries()) {
        if (subscription.clients.size > 0) {
          updatePromises.push(this.checkSubscriptionForUpdates(subscriptionKey, subscription));
        }
      }

      await Promise.all(updatePromises);
      
      const duration = Date.now() - startTime;
      if (duration > 5000) { // Log if taking more than 5 seconds
        logger.warn(`⏱️  Real-time update check took ${duration}ms`);
      }
    } catch (error) {
      logger.error('❌ Error during real-time update check:', error);
    }
  }

  /**
   * Check specific subscription for updates
   * @param {string} subscriptionKey - Subscription key
   * @param {object} subscription - Subscription details
   */
  async checkSubscriptionForUpdates(subscriptionKey, subscription) {
    try {
      let currentData = null;

      switch (subscription.type) {
        case 'dashboard':
        case 'overview':
          currentData = await this.getDashboardMetrics();
          break;
        case 'individual':
          if (subscription.userId) {
            currentData = await this.getIndividualMetrics(subscription.userId);
          }
          break;
        case 'workitems':
          currentData = await this.getWorkItemsMetrics();
          break;
        default:
          return;
      }

      if (!currentData) return;

      // Calculate data hash for change detection
      const currentHash = this.calculateDataHash(currentData);
      const previousHash = subscription.dataHash;

      // Check if data has changed
      if (this.config.enableChangeDetection && currentHash === previousHash) {
        return; // No changes detected
      }

      // Update subscription with new data
      subscription.dataHash = currentHash;
      subscription.lastUpdate = new Date();

      // Broadcast update to subscribed clients
      const updatePayload = {
        type: subscription.type,
        data: currentData,
        timestamp: new Date().toISOString(),
        subscriptionKey,
        isInitial: false
      };

      // Send to all clients subscribed to this key
      for (const clientId of subscription.clients) {
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
          socket.emit('metrics-update', updatePayload);
        }
      }

      logger.info(`📊 Broadcasted ${subscription.type} update to ${subscription.clients.size} client(s)`);
      
    } catch (error) {
      logger.error(`❌ Error checking subscription ${subscriptionKey}:`, error);
    }
  }

  /**
   * Get dashboard metrics data
   * @returns {Promise<object>} Dashboard metrics
   */
  async getDashboardMetrics() {
    try {
      // ✅ FIXED - Use sprint-specific work items instead of all work items
      // Get work items for the current sprint period (same as main dashboard)
      const currentSprintWorkItems = this.metricsCalculator ? 
        await this.metricsCalculator.getWorkItemsForPeriod('sprint') : [];
      
      // Fallback to all work items if sprint-specific items not available
      const workItems = currentSprintWorkItems.length > 0 ? 
        { workItems: currentSprintWorkItems, totalCount: currentSprintWorkItems.length } :
        await this.azureService.getWorkItems({ forceRefresh: true });
      
      // Calculate basic metrics
      const totalWorkItems = workItems.totalCount;
      const completedItems = workItems.workItems.filter(item => 
        ['Done', 'Closed', 'Resolved'].includes(item.fields?.['System.State'])
      ).length;
      
      const completionRate = totalWorkItems > 0 ? (completedItems / totalWorkItems * 100).toFixed(1) : 0;
      
      // Calculate KPIs if metricsCalculator is available
      let kpis = null;
      if (this.metricsCalculator) {
        try {
          // ✅ FIXED - Remove broken getCurrentSprintData call, KPIs work with work items directly
          const kpiData = await this.metricsCalculator.calculateKPIs(workItems.workItems, null);
          kpis = kpiData;
        } catch (error) {
          logger.warn('⚠️ Could not calculate KPIs for real-time data:', error.message);
        }
      }
      
      return {
        summary: {
          totalWorkItems,
          completedItems,
          completionRate: parseFloat(completionRate),
          activeItems: totalWorkItems - completedItems,
          lastUpdated: new Date().toISOString()
        },
        workItems: workItems.workItems.slice(0, 10), // Latest 10 items
        totalCount: totalWorkItems,
        kpis: kpis // Add KPIs to real-time data structure
      };
    } catch (error) {
      logger.error('❌ Error fetching dashboard metrics:', error);
      return null;
    }
  }

  /**
   * Get enhanced individual user metrics
   * @param {string} userId - User ID or email
   * @param {object} options - Additional options
   * @returns {Promise<object>} Enhanced individual metrics
   */
  async getIndividualMetrics(userId, options = {}) {
    try {
      const { productId, period = 'sprint' } = options;
      
      // Check if we have a metrics calculator service available
      if (this.metricsCalculator) {
        // Use enhanced metrics calculator for comprehensive individual data
        const individualMetrics = await this.metricsCalculator.calculateIndividualMetrics(userId, {
          period,
          productId,
          startDate: options.startDate,
          endDate: options.endDate
        });
        
        return {
          ...individualMetrics,
          realTimeUpdate: true,
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Fallback to basic work item fetching
        const workItems = await this.azureService.getUserWorkItems(userId, {
          productId,
          forceRefresh: true
        });
        
        return {
          userId,
          workItems: {
            total: workItems.length,
            completed: workItems.filter(item => 
              ['Done', 'Closed', 'Resolved'].includes(item.state)
            ).length,
            inProgress: workItems.filter(item => 
              ['Active', 'In Progress'].includes(item.state)
            ).length,
            backlog: workItems.filter(item => 
              ['New', 'Approved'].includes(item.state)
            ).length
          },
          performance: {
            completedStoryPoints: workItems
              .filter(item => ['Done', 'Closed'].includes(item.state))
              .reduce((sum, item) => sum + (item.storyPoints || 0), 0),
            totalAssignedStoryPoints: workItems
              .reduce((sum, item) => sum + (item.storyPoints || 0), 0),
            completionRate: workItems.length > 0 
              ? (workItems.filter(item => ['Done', 'Closed'].includes(item.state)).length / workItems.length) * 100 
              : 0,
            velocity: workItems
              .filter(item => ['Done', 'Closed'].includes(item.state))
              .reduce((sum, item) => sum + (item.storyPoints || 0), 0)
          },
          realTimeUpdate: true,
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error(`❌ Error fetching enhanced individual metrics for ${userId}:`, error);
      return {
        userId,
        error: 'Unable to fetch individual performance data',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Get work items metrics
   * @returns {Promise<object>} Work items metrics
   */
  async getWorkItemsMetrics() {
    try {
      const workItems = await this.azureService.getWorkItems({ maxResults: 50, forceRefresh: true });
      
      return {
        workItems: workItems.workItems,
        totalCount: workItems.totalCount,
        byType: this.groupWorkItemsByType(workItems.workItems),
        byState: this.groupWorkItemsByState(workItems.workItems),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('❌ Error fetching work items metrics:', error);
      return null;
    }
  }

  /**
   * Group work items by type
   * @param {Array} workItems - Work items array
   * @returns {object} Grouped work items
   */
  groupWorkItemsByType(workItems) {
    const grouped = {};
    workItems.forEach(item => {
      const type = item.fields?.['System.WorkItemType'] || 'Unknown';
      if (!grouped[type]) grouped[type] = 0;
      grouped[type]++;
    });
    return grouped;
  }

  /**
   * Group work items by state
   * @param {Array} workItems - Work items array
   * @returns {object} Grouped work items
   */
  groupWorkItemsByState(workItems) {
    const grouped = {};
    workItems.forEach(item => {
      const state = item.fields?.['System.State'] || 'Unknown';
      if (!grouped[state]) grouped[state] = 0;
      grouped[state]++;
    });
    return grouped;
  }

  /**
   * Calculate simple hash for data comparison
   * @param {object} data - Data to hash
   * @returns {string} Hash string
   */
  calculateDataHash(data) {
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Get service statistics
   * @returns {object} Service statistics
   */
  getServiceStats() {
    return {
      isMonitoring: this.isMonitoring,
      connectedClients: this.connectedClients.size,
      activeSubscriptions: this.subscriptions.size,
      pollingInterval: this.config.pollingIntervalMs,
      config: this.config,
      subscriptionDetails: Array.from(this.subscriptions.entries()).map(([key, sub]) => ({
        key,
        type: sub.type,
        clientCount: sub.clients.size,
        lastUpdate: sub.lastUpdate
      }))
    };
  }

  /**
   * Handle webhook event for real-time updates
   * @param {object} webhookEvent - Webhook event data
   */
  async handleWebhookEvent(webhookEvent) {
    try {
      const { eventType, resource, eventId } = webhookEvent;
      
      logger.info(`📡 Processing webhook event for real-time updates: ${eventType} - ${eventId}`);
      
      // Determine which subscriptions should receive this update
      const relevantSubscriptions = this.findRelevantSubscriptions(webhookEvent);
      
      if (relevantSubscriptions.length === 0) {
        logger.debug(`No active subscriptions for webhook event: ${eventType}`);
        return;
      }
      
      // Create real-time update payload
      const updatePayload = {
        type: 'webhook-event',
        eventType,
        eventId,
        workItem: resource,
        timestamp: new Date().toISOString(),
        isRealtime: true
      };
      
      // Broadcast to relevant clients
      let totalClientCount = 0;
      for (const subscription of relevantSubscriptions) {
        for (const clientId of subscription.clients) {
          const socket = this.io.sockets.sockets.get(clientId);
          if (socket) {
            socket.emit('workitem-update', updatePayload);
            totalClientCount++;
          }
        }
      }
      
      logger.info(`📡 Webhook event broadcasted to ${totalClientCount} client(s)`);
      
      // Force refresh affected data for next polling cycle
      await this.refreshAffectedSubscriptions(webhookEvent);
      
    } catch (error) {
      logger.error('❌ Error handling webhook event for real-time updates:', error);
    }
  }
  
  /**
   * Find subscriptions that should receive this webhook update
   * @param {object} webhookEvent - Webhook event data
   * @returns {Array} Array of relevant subscriptions
   */
  findRelevantSubscriptions(webhookEvent) {
    const { eventType, resource } = webhookEvent;
    const relevantSubs = [];
    
    for (const [subscriptionKey, subscription] of this.subscriptions.entries()) {
      // Check if subscription should receive this update
      if (this.shouldReceiveWebhookUpdate(subscription, webhookEvent)) {
        relevantSubs.push(subscription);
      }
    }
    
    return relevantSubs;
  }
  
  /**
   * Check if a subscription should receive a webhook update
   * @param {object} subscription - Subscription details
   * @param {object} webhookEvent - Webhook event data
   * @returns {boolean} Whether subscription should receive update
   */
  shouldReceiveWebhookUpdate(subscription, webhookEvent) {
    const { eventType, resource } = webhookEvent;
    
    // All subscriptions get work item updates
    if (subscription.type === 'workitems' || subscription.type === 'all') {
      return true;
    }
    
    // Dashboard subscriptions get work item updates
    if (subscription.type === 'dashboard' || subscription.type === 'overview') {
      return true;
    }
    
    // Individual subscriptions get updates if assigned to them
    if (subscription.type === 'individual' && subscription.userId) {
      const assignedTo = resource?.fields?.['System.AssignedTo'];
      if (assignedTo && assignedTo.uniqueName) {
        return assignedTo.uniqueName === subscription.userId;
      }
    }
    
    return false;
  }
  
  /**
   * Refresh subscriptions affected by webhook event
   * @param {object} webhookEvent - Webhook event data
   */
  async refreshAffectedSubscriptions(webhookEvent) {
    try {
      const affectedTypes = new Set();
      
      // Determine which types of data need refreshing
      affectedTypes.add('workitems');
      affectedTypes.add('dashboard');
      affectedTypes.add('overview');
      
      // If assigned to someone, refresh individual metrics
      const assignedTo = webhookEvent.resource?.fields?.['System.AssignedTo'];
      if (assignedTo && assignedTo.uniqueName) {
        affectedTypes.add('individual');
      }
      
      // Force refresh for affected subscription types
      for (const [subscriptionKey, subscription] of this.subscriptions.entries()) {
        if (affectedTypes.has(subscription.type)) {
          // Mark for immediate refresh on next polling cycle
          subscription.dataHash = null; // Force change detection
          logger.debug(`Marked subscription ${subscriptionKey} for refresh`);
        }
      }
      
    } catch (error) {
      logger.error('❌ Error refreshing affected subscriptions:', error);
    }
  }

  /**
   * Force refresh all subscriptions
   */
  async forceRefresh() {
    logger.info('🔄 Forcing real-time data refresh...');
    await this.checkForUpdates();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopMonitoring();
    this.connectedClients.clear();
    this.subscriptions.clear();
    this.previousDataHashes.clear();
    logger.info('🧹 Real-time service cleaned up');
  }
}

module.exports = RealtimeService;

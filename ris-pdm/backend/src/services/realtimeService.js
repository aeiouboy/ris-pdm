/**
 * Real-time Service for WebSocket Integration
 * Monitors Azure DevOps data changes and broadcasts updates to connected clients
 * Implements efficient polling and change detection strategies
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

class RealtimeService extends EventEmitter {
  constructor(azureDevOpsService, io) {
    super();
    this.azureService = azureDevOpsService;
    this.io = io;
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
      // Implement dashboard metrics logic here
      // This should integrate with your existing metrics calculation
      const workItems = await this.azureService.getWorkItems();
      
      // Calculate basic metrics
      const totalWorkItems = workItems.totalCount;
      const completedItems = workItems.workItems.filter(item => 
        ['Done', 'Closed', 'Resolved'].includes(item.fields?.['System.State'])
      ).length;
      
      const completionRate = totalWorkItems > 0 ? (completedItems / totalWorkItems * 100).toFixed(1) : 0;
      
      return {
        summary: {
          totalWorkItems,
          completedItems,
          completionRate: parseFloat(completionRate),
          activeItems: totalWorkItems - completedItems,
          lastUpdated: new Date().toISOString()
        },
        workItems: workItems.workItems.slice(0, 10), // Latest 10 items
        totalCount: totalWorkItems
      };
    } catch (error) {
      logger.error('❌ Error fetching dashboard metrics:', error);
      return null;
    }
  }

  /**
   * Get individual user metrics
   * @param {string} userId - User ID or email
   * @returns {Promise<object>} Individual metrics
   */
  async getIndividualMetrics(userId) {
    try {
      const workItems = await this.azureService.getWorkItems({
        assignedTo: userId
      });
      
      return {
        userId,
        workItems: workItems.workItems,
        totalCount: workItems.totalCount,
        summary: {
          assigned: workItems.totalCount,
          completed: workItems.workItems.filter(item => 
            ['Done', 'Closed', 'Resolved'].includes(item.fields?.['System.State'])
          ).length,
          inProgress: workItems.workItems.filter(item => 
            ['Active', 'In Progress'].includes(item.fields?.['System.State'])
          ).length
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`❌ Error fetching individual metrics for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get work items metrics
   * @returns {Promise<object>} Work items metrics
   */
  async getWorkItemsMetrics() {
    try {
      const workItems = await this.azureService.getWorkItems({ maxResults: 50 });
      
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
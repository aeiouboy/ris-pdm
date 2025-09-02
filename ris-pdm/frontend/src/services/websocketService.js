/**
 * WebSocket Service for Real-time Updates
 * Manages Socket.IO connection and handles real-time metric updates
 */

import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // Start with 1 second
    this.maxRetryDelay = 30000; // Max 30 seconds
    this.subscriptions = new Map(); // trackingId -> callback
    this.connectionListeners = new Set();
    this.statusListeners = new Set();
    
    // Configuration
    this.config = {
      serverUrl: 'http://localhost:6000',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      forceNew: false
    };
  }

  /**
   * Establish WebSocket connection to server
   * @returns {Promise<boolean>} Connection success status
   */
  async connect() {
    if (this.isConnected && this.socket?.connected) {
      console.log('🔌 Already connected to WebSocket server');
      return true;
    }

    try {
      console.log('🔌 Connecting to WebSocket server at', this.config.serverUrl);
      
      // Create socket connection
      this.socket = io(this.config.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: this.config.reconnection,
        reconnectionDelay: this.config.reconnectionDelay,
        reconnectionDelayMax: this.config.reconnectionDelayMax,
        timeout: this.config.timeout,
        forceNew: this.config.forceNew
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection to establish
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('🔌 Connection timeout');
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('🔌 Connection failed:', error);
          reject(error);
        });
      });

    } catch (error) {
      console.error('🔌 Failed to create WebSocket connection:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.handleConnection();
    });

    this.socket.on('disconnect', (reason) => {
      this.handleDisconnection(reason);
    });

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error);
    });

    // Real-time data events
    this.socket.on('connected', (data) => {
      console.log('🔌 Server acknowledgment:', data);
    });

    this.socket.on('realtime-status', (status) => {
      console.log('📊 Real-time status update:', status);
      this.notifyStatusListeners(status);
    });

    this.socket.on('metrics-update', (update) => {
      this.handleMetricsUpdate(update);
    });

    // Error events
    this.socket.on('error', (error) => {
      console.error('🔌 WebSocket error:', error);
    });
  }

  /**
   * Handle successful connection
   */
  handleConnection() {
    this.isConnected = true;
    this.connectionRetries = 0;
    this.retryDelay = 1000;
    
    console.log('🔌 Connected to WebSocket server');
    this.notifyConnectionListeners(true);
  }

  /**
   * Handle disconnection
   * @param {string} reason - Disconnect reason
   */
  handleDisconnection(reason) {
    this.isConnected = false;
    console.log(`🔌 Disconnected from WebSocket server: ${reason}`);
    this.notifyConnectionListeners(false);

    // Attempt reconnection for unexpected disconnections
    if (reason !== 'io client disconnect' && this.config.reconnection) {
      this.scheduleReconnection();
    }
  }

  /**
   * Handle connection error
   * @param {Error} error - Connection error
   */
  handleConnectionError(error) {
    console.error('🔌 WebSocket connection error:', error);
    this.isConnected = false;
    this.notifyConnectionListeners(false);
    
    if (this.config.reconnection) {
      this.scheduleReconnection();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnection() {
    if (this.connectionRetries >= this.maxRetries) {
      console.error('🔌 Max reconnection attempts reached');
      return;
    }

    this.connectionRetries++;
    const delay = Math.min(this.retryDelay * Math.pow(2, this.connectionRetries - 1), this.maxRetryDelay);
    
    console.log(`🔌 Scheduling reconnection attempt ${this.connectionRetries}/${this.maxRetries} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        console.log('🔌 Attempting to reconnect...');
        this.connect();
      }
    }, delay);
  }

  /**
   * Handle incoming metrics updates
   * @param {object} update - Metrics update data
   */
  handleMetricsUpdate(update) {
    console.log('📊 Received metrics update:', update.type, update.timestamp);
    
    // Notify relevant subscribers
    const subscriptionKey = this.generateSubscriptionKey(update.type, update.userId, update.teamId);
    const callback = this.subscriptions.get(subscriptionKey);
    
    if (callback) {
      try {
        callback(update);
      } catch (error) {
        console.error('📊 Error in metrics update callback:', error);
      }
    }

    // Also notify wildcard subscribers
    const wildcardCallback = this.subscriptions.get('all');
    if (wildcardCallback && wildcardCallback !== callback) {
      try {
        wildcardCallback(update);
      } catch (error) {
        console.error('📊 Error in wildcard metrics update callback:', error);
      }
    }
  }

  /**
   * Subscribe to metrics updates
   * @param {string} type - Metrics type ('all', 'user', 'team', etc.)
   * @param {function} callback - Callback function to handle updates
   * @param {object} options - Subscription options (userId, teamId, etc.)
   * @returns {string} Subscription ID for unsubscribing
   */
  subscribeToMetrics(type = 'all', callback, options = {}) {
    if (!callback || typeof callback !== 'function') {
      console.error('📊 Invalid callback provided for metrics subscription');
      return null;
    }

    // Generate unique subscription key
    const subscriptionKey = this.generateSubscriptionKey(type, options.userId, options.teamId);
    
    // Store callback
    this.subscriptions.set(subscriptionKey, callback);
    
    // Send subscription request to server if connected
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe-metrics', {
        type: type,
        userId: options.userId || null,
        teamId: options.teamId || null,
        filters: options.filters || {}
      });
    }
    
    console.log(`📊 Subscribed to metrics: ${subscriptionKey}`);
    return subscriptionKey;
  }

  /**
   * Unsubscribe from metrics updates
   * @param {string} subscriptionId - Subscription ID returned from subscribe
   */
  unsubscribeFromMetrics(subscriptionId) {
    if (!subscriptionId || !this.subscriptions.has(subscriptionId)) {
      return;
    }

    // Remove callback
    this.subscriptions.delete(subscriptionId);
    
    // Parse subscription key to get original parameters
    const [type, userId, teamId] = subscriptionId.split('-');
    
    // Send unsubscription request to server
    if (this.socket) {
      this.socket.emit('unsubscribe-metrics', {
        type: type === 'all' ? 'all' : type,
        userId: userId === 'all' ? null : userId,
        teamId: teamId === 'all' ? null : teamId
      });
    }
    
    console.log(`📊 Unsubscribed from metrics: ${subscriptionId}`);
  }

  /**
   * Generate subscription key
   * @param {string} type - Metrics type
   * @param {string} userId - User ID (optional)
   * @param {string} teamId - Team ID (optional)
   * @returns {string} Subscription key
   */
  generateSubscriptionKey(type, userId, teamId) {
    return `${type || 'all'}-${userId || 'all'}-${teamId || 'all'}`;
  }

  /**
   * Add connection status listener
   * @param {function} listener - Listener function
   */
  addConnectionListener(listener) {
    this.connectionListeners.add(listener);
    
    // Immediately call with current status
    listener(this.isConnected);
  }

  /**
   * Remove connection status listener
   * @param {function} listener - Listener function
   */
  removeConnectionListener(listener) {
    this.connectionListeners.delete(listener);
  }

  /**
   * Notify connection listeners
   * @param {boolean} connected - Connection status
   */
  notifyConnectionListeners(connected) {
    for (const listener of this.connectionListeners) {
      try {
        listener(connected);
      } catch (error) {
        console.error('🔌 Error in connection listener:', error);
      }
    }
  }

  /**
   * Add status listener for real-time service status
   * @param {function} listener - Listener function
   */
  addStatusListener(listener) {
    this.statusListeners.add(listener);
  }

  /**
   * Remove status listener
   * @param {function} listener - Listener function
   */
  removeStatusListener(listener) {
    this.statusListeners.delete(listener);
  }

  /**
   * Notify status listeners
   * @param {object} status - Service status
   */
  notifyStatusListeners(status) {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('📊 Error in status listener:', error);
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from WebSocket server');
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.subscriptions.clear();
    this.notifyConnectionListeners(false);
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected && this.socket?.connected;
  }

  /**
   * Get service statistics
   * @returns {object} Service statistics
   */
  getStats() {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      retries: this.connectionRetries,
      serverUrl: this.config.serverUrl,
      socketId: this.socket?.id || null
    };
  }

  /**
   * Force reconnection
   */
  forceReconnect() {
    console.log('🔌 Forcing reconnection...');
    if (this.socket) {
      this.socket.disconnect();
    }
    this.connectionRetries = 0;
    this.connect();
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
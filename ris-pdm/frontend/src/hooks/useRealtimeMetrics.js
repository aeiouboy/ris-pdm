/**
 * useRealtimeMetrics Hook
 * Custom React hook for managing real-time metrics subscriptions
 * Handles WebSocket connections, data updates, and connection status
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import websocketService from '../services/websocketService';

/**
 * Custom hook for real-time metrics
 * @param {string} metricsType - Type of metrics to subscribe to ('dashboard', 'individual', 'workitems')
 * @param {object} options - Options object
 * @param {string} options.userId - User ID for individual metrics
 * @param {string} options.teamId - Team ID for team-specific metrics
 * @param {boolean} options.enabled - Whether to enable the subscription (default: true)
 * @param {number} options.pollingFallback - Fallback polling interval in ms when WebSocket is not available
 * @returns {object} Hook state and functions
 */
export const useRealtimeMetrics = (metricsType = 'all', options = {}) => {
  const {
    userId = null,
    teamId = null,
    enabled = true,
    pollingFallback = 30000 // 30 seconds fallback polling
  } = options;

  // State management
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);

  // Refs for stable references
  const subscriptionRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const isSubscribedRef = useRef(false);

  /**
   * Handle metrics update from WebSocket
   */
  const handleMetricsUpdate = useCallback((update) => {
    console.log(`📊 Received ${metricsType} update:`, update);
    
    setData(update.data);
    setLastUpdate(new Date(update.timestamp));
    setUpdateCount(prev => prev + 1);
    setLoading(false);
    setError(null);
  }, [metricsType]);

  /**
   * Handle connection status changes
   */
  const handleConnectionChange = useCallback((isConnected) => {
    setConnected(isConnected);
    
    if (isConnected && !isSubscribedRef.current && enabled) {
      // Subscribe when connection is established
      subscribeToMetrics();
    } else if (!isConnected && enabled && pollingFallback > 0) {
      // Start fallback polling when disconnected
      startFallbackPolling();
    }
  }, [enabled, pollingFallback]);

  /**
   * Subscribe to metrics updates
   */
  const subscribeToMetrics = useCallback(() => {
    if (isSubscribedRef.current || !enabled) {
      return;
    }

    const subscriptionId = websocketService.subscribeToMetrics(
      metricsType,
      handleMetricsUpdate,
      { userId, teamId }
    );

    if (subscriptionId) {
      subscriptionRef.current = subscriptionId;
      isSubscribedRef.current = true;
      console.log(`📊 Subscribed to ${metricsType} metrics:`, subscriptionId);
    }
  }, [metricsType, userId, teamId, enabled, handleMetricsUpdate]);

  /**
   * Unsubscribe from metrics updates
   */
  const unsubscribeFromMetrics = useCallback(() => {
    if (subscriptionRef.current) {
      websocketService.unsubscribeFromMetrics(subscriptionRef.current);
      subscriptionRef.current = null;
      isSubscribedRef.current = false;
      console.log(`📊 Unsubscribed from ${metricsType} metrics`);
    }
  }, [metricsType]);

  /**
   * Start fallback polling when WebSocket is unavailable
   */
  const startFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current || !enabled || pollingFallback <= 0) {
      return;
    }

    console.log(`📊 Starting fallback polling for ${metricsType} (${pollingFallback}ms)`);
    
    fallbackTimerRef.current = setInterval(async () => {
      if (connected) {
        // Stop polling if WebSocket reconnected
        stopFallbackPolling();
        return;
      }

      try {
        // Fetch data using regular API call as fallback
        const response = await fetchFallbackData();
        if (response) {
          setData(response);
          setLastUpdate(new Date());
          setUpdateCount(prev => prev + 1);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('❌ Fallback polling error:', err);
        setError(err.message);
      }
    }, pollingFallback);
  }, [metricsType, enabled, pollingFallback, connected]);

  /**
   * Stop fallback polling
   */
  const stopFallbackPolling = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
      console.log(`📊 Stopped fallback polling for ${metricsType}`);
    }
  }, [metricsType]);

  /**
   * Fetch data using regular API as fallback
   */
  const fetchFallbackData = useCallback(async (opts = {}) => {
    const { noCache = false } = opts;
    let apiEndpoint;
    
    switch (metricsType) {
      case 'dashboard':
      case 'overview':
        apiEndpoint = '/api/metrics/overview';
        break;
      case 'individual':
        apiEndpoint = userId ? `/api/metrics/individual/${userId}` : '/api/metrics/individual';
        break;
      case 'workitems':
        apiEndpoint = '/api/workitems';
        break;
      default:
        apiEndpoint = '/api/metrics/overview';
    }

    const url = new URL(`${import.meta.env.VITE_API_BASE_URL || ''}${apiEndpoint}`, window.location.origin);
    if (noCache) {
      url.searchParams.set('noCache', 'true');
      url.searchParams.set('_', Date.now().toString());
    }
    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${metricsType} data: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }, [metricsType, userId]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async (opts = {}) => {
    const { noCache = false } = opts;
    setLoading(true);
    setError(null);
    
    try {
      if (connected && isSubscribedRef.current && !noCache) {
        // Request server to send latest data
        // This is handled by the subscription, so we just wait
        setTimeout(() => {
          if (loading) {
            setLoading(false);
          }
        }, 2000);
      } else {
        // Use fallback API
        const freshData = await fetchFallbackData({ noCache });
        if (freshData) {
          setData(freshData);
          setLastUpdate(new Date());
          setUpdateCount(prev => prev + 1);
        }
      }
    } catch (err) {
      console.error('❌ Manual refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connected, fetchFallbackData, loading]);

  /**
   * Initialize WebSocket connection and subscription
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const initializeConnection = async () => {
      // Connect to WebSocket if not already connected
      if (!websocketService.getConnectionStatus()) {
        setLoading(true);
        const connectionSuccess = await websocketService.connect();
        
        if (!connectionSuccess && pollingFallback > 0) {
          // Start fallback polling immediately if WebSocket fails
          console.log('🔌 WebSocket connection failed, starting fallback polling');
          startFallbackPolling();
        }
      }

      // Add connection listener
      websocketService.addConnectionListener(handleConnectionChange);

      // Subscribe if connected
      if (websocketService.getConnectionStatus()) {
        subscribeToMetrics();
      }
    };

    initializeConnection();

    // Cleanup function
    return () => {
      websocketService.removeConnectionListener(handleConnectionChange);
      unsubscribeFromMetrics();
      stopFallbackPolling();
    };
  }, [enabled, handleConnectionChange, subscribeToMetrics, unsubscribeFromMetrics, startFallbackPolling, stopFallbackPolling, pollingFallback]);

  /**
   * Handle enabled state changes
   */
  useEffect(() => {
    if (enabled && !isSubscribedRef.current && websocketService.getConnectionStatus()) {
      subscribeToMetrics();
    } else if (!enabled && isSubscribedRef.current) {
      unsubscribeFromMetrics();
      stopFallbackPolling();
    }
  }, [enabled, subscribeToMetrics, unsubscribeFromMetrics, stopFallbackPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      unsubscribeFromMetrics();
      stopFallbackPolling();
    };
  }, [unsubscribeFromMetrics, stopFallbackPolling]);

  return {
    // Data state
    data,
    loading,
    error,
    
    // Connection state
    connected,
    lastUpdate,
    updateCount,
    
    // Actions
    refresh,
    
    // Status information
    isEnabled: enabled,
    subscriptionActive: isSubscribedRef.current,
    metricsType,
    options: { userId, teamId }
  };
};

/**
 * Hook for WebSocket connection status
 * @returns {object} Connection status and control functions
 */
export const useWebSocketConnection = () => {
  const [connected, setConnected] = useState(websocketService.getConnectionStatus());
  const [stats, setStats] = useState(websocketService.getStats());

  const updateStats = useCallback(() => {
    setStats(websocketService.getStats());
  }, []);

  const handleConnectionChange = useCallback((isConnected) => {
    setConnected(isConnected);
    updateStats();
  }, [updateStats]);

  useEffect(() => {
    websocketService.addConnectionListener(handleConnectionChange);
    
    // Update stats periodically
    const interval = setInterval(updateStats, 5000);

    return () => {
      websocketService.removeConnectionListener(handleConnectionChange);
      clearInterval(interval);
    };
  }, [handleConnectionChange, updateStats]);

  const connect = useCallback(() => {
    return websocketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
  }, []);

  const forceReconnect = useCallback(() => {
    websocketService.forceReconnect();
  }, []);

  return {
    connected,
    stats,
    connect,
    disconnect,
    forceReconnect
  };
};

export default useRealtimeMetrics;

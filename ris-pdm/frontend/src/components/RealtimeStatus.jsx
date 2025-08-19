/**
 * Real-time Connection Status Indicator Component
 * Shows WebSocket connection status and provides manual reconnection controls
 */

import React, { useState } from 'react';
import { useWebSocketConnection } from '../hooks/useRealtimeMetrics';

const RealtimeStatus = ({ className = '', showDetails = false, showControls = false }) => {
  const { connected, stats, connect, disconnect, forceReconnect } = useWebSocketConnection();
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);

  const getStatusColor = () => {
    return connected ? 'text-green-600' : 'text-red-600';
  };

  const getStatusBg = () => {
    return connected ? 'bg-green-100' : 'bg-red-100';
  };

  const getStatusIcon = () => {
    if (connected) {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
          <span className="text-xs font-medium text-green-700">Live</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
          <span className="text-xs font-medium text-red-700">Offline</span>
        </div>
      );
    }
  };

  const handleReconnect = async () => {
    if (connected) {
      disconnect();
      setTimeout(() => {
        connect();
      }, 1000);
    } else {
      await connect();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Status Indicator */}
      <div 
        className={`inline-flex items-center px-2 py-1 rounded-md ${getStatusBg()} cursor-pointer transition-colors duration-200 hover:opacity-80`}
        onClick={() => showDetails && setShowDetailsPanel(!showDetailsPanel)}
        title={connected ? 'Real-time updates active' : 'Real-time updates unavailable'}
      >
        {getStatusIcon()}
        
        {showDetails && (
          <button className="ml-2 text-xs text-gray-500 hover:text-gray-700">
            ℹ️
          </button>
        )}
      </div>

      {/* Detailed Status Panel */}
      {showDetails && showDetailsPanel && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Real-time Status</h3>
              <button
                onClick={() => setShowDetailsPanel(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Connection Status */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Connection</span>
                <span className={`text-sm font-medium ${getStatusColor()}`}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              {stats.socketId && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Socket ID</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {stats.socketId.substring(0, 8)}...
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Server</span>
                <span className="text-xs text-gray-500">
                  {stats.serverUrl}
                </span>
              </div>
            </div>

            {/* Statistics */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Statistics</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Active Subscriptions</span>
                  <span className="text-xs font-medium text-gray-900">{stats.subscriptions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Connection Retries</span>
                  <span className="text-xs font-medium text-gray-900">{stats.retries}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            {showControls && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex space-x-2">
                  <button
                    onClick={handleReconnect}
                    disabled={!connected && stats.retries > 0}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {connected ? 'Reconnect' : 'Connect'}
                  </button>
                  
                  {connected && (
                    <button
                      onClick={disconnect}
                      className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Simple connection status dot for header/navbar
 */
export const RealtimeStatusDot = ({ className = '' }) => {
  const { connected } = useWebSocketConnection();
  
  return (
    <div 
      className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} ${className}`}
      title={connected ? 'Real-time updates active' : 'Real-time updates unavailable'}
    ></div>
  );
};

/**
 * Update timestamp indicator
 */
export const LastUpdateIndicator = ({ lastUpdate, className = '' }) => {
  const formatLastUpdate = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      Last updated: {formatLastUpdate(lastUpdate)}
    </div>
  );
};

export default RealtimeStatus;
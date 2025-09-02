# Real-time WebSocket Implementation

This document describes the real-time WebSocket integration implemented for the RIS Performance Dashboard, enabling live updates of Azure DevOps metrics without page refreshes.

## Overview

The implementation provides:
- **Real-time metric updates** via WebSocket connections
- **Fallback polling** when WebSocket is unavailable
- **Connection status indicators** and reconnection logic
- **Subscription management** for different metric types
- **Production-ready** architecture supporting 100+ concurrent users

## Architecture

### Backend Components

#### 1. WebSocket Server (`server.js`)
- Integrated Socket.IO server with Express
- CORS configuration for frontend connections
- Connection handling and room management
- Graceful shutdown with cleanup

#### 2. Real-time Service (`src/services/realtimeService.js`)
- **Event-driven architecture** using EventEmitter
- **Subscription management** for different metric types
- **Change detection** to avoid unnecessary broadcasts
- **Polling mechanism** to check for Azure DevOps data changes
- **Client tracking** and connection lifecycle management

Key Features:
- Configurable polling intervals (default: 30 seconds)
- Hash-based change detection for efficiency
- Support for multiple subscription types (dashboard, individual, workitems)
- Automatic cleanup of unused subscriptions
- Comprehensive logging and monitoring

### Frontend Components

#### 1. WebSocket Service (`src/services/websocketService.js`)
- **Singleton pattern** for global connection management
- **Automatic reconnection** with exponential backoff
- **Subscription management** with callback handling
- **Connection status monitoring**

Key Features:
- Support for websocket and polling transports
- Retry logic with maximum attempt limits
- Status listeners for UI updates
- Graceful fallback mechanisms

#### 2. useRealtimeMetrics Hook (`src/hooks/useRealtimeMetrics.js`)
- **Custom React hook** for easy integration
- **Automatic subscription management** based on dependencies
- **Fallback API calls** when WebSocket is unavailable
- **Loading and error state management**

#### 3. Real-time UI Components (`src/components/RealtimeStatus.jsx`)
- **Connection status indicators** (live/offline dots)
- **Detailed status panel** with statistics
- **Manual reconnection controls**
- **Last update timestamps**

## Usage

### Backend Setup

1. **Install Dependencies**:
```bash
cd backend
npm install socket.io
```

2. **Environment Configuration**:
Copy `.env.example` to `.env` and configure:
```env
REALTIME_POLLING_INTERVAL=30000
ENABLE_INCREMENTAL_UPDATES=true
MAX_WEBSOCKET_CLIENTS=100
ENABLE_CHANGE_DETECTION=true
```

3. **Start Server**:
```bash
npm run dev
```

### Frontend Setup

1. **Install Dependencies**:
```bash
cd frontend
npm install socket.io-client
```

2. **Environment Configuration**:
Copy `.env.example` to `.env.local`:
```env
VITE_WEBSOCKET_URL=http://localhost:3001
VITE_API_URL=http://localhost:3001
```

3. **Integration Example**:

```jsx
import { useRealtimeMetrics } from './hooks/useRealtimeMetrics';
import RealtimeStatus from './components/RealtimeStatus';

function Dashboard() {
  const { 
    data, 
    loading, 
    connected, 
    lastUpdate, 
    updateCount 
  } = useRealtimeMetrics('dashboard');

  return (
    <div>
      <RealtimeStatus showDetails={true} />
      {/* Your dashboard content */}
    </div>
  );
}
```

## WebSocket Events

### Client → Server Events

| Event | Description | Payload |
|-------|-------------|---------|
| `subscribe-metrics` | Subscribe to metric updates | `{ type, userId?, teamId? }` |
| `unsubscribe-metrics` | Unsubscribe from updates | `{ type, userId?, teamId? }` |
| `disconnect` | Client disconnection | - |

### Server → Client Events

| Event | Description | Payload |
|-------|-------------|---------|
| `connected` | Connection acknowledgment | `{ message, timestamp }` |
| `realtime-status` | Service status update | `{ connected, clientId, serverTime, ... }` |
| `metrics-update` | Real-time metric update | `{ type, data, timestamp, isInitial }` |

## Metric Types

### Dashboard Metrics (`'dashboard'` or `'overview'`)
- Team performance summary
- Work item completion rates
- Overall statistics

### Individual Metrics (`'individual'`)
- User-specific performance data
- Personal work item assignments
- Individual completion rates

### Work Items Metrics (`'workitems'`)
- Latest work items
- Type and state distributions
- Recent changes

## Configuration Options

### Backend Configuration

```javascript
// Real-time Service Configuration
{
  pollingIntervalMs: 30000,        // Polling frequency
  enableIncrementalUpdates: true,  // Enable incremental updates
  maxClients: 100,                 // Maximum WebSocket clients
  enableChangeDetection: true      // Enable hash-based change detection
}
```

### Frontend Configuration

```javascript
// useRealtimeMetrics Hook Options
{
  userId: 'user@example.com',      // For individual metrics
  teamId: 'team-id',               // For team-specific metrics
  enabled: true,                   // Enable/disable subscription
  pollingFallback: 30000           // Fallback polling interval
}
```

## Performance Considerations

### Backend Optimizations
- **Hash-based change detection** prevents unnecessary broadcasts
- **Subscription cleanup** removes unused connections
- **Rate limiting** on Azure DevOps API calls
- **Batch processing** for multiple work items
- **Memory-efficient** caching with TTL

### Frontend Optimizations
- **Singleton WebSocket connection** shared across components
- **Automatic subscription cleanup** on component unmount
- **Fallback polling** only when needed
- **Debounced reconnection** with exponential backoff

## Monitoring and Debugging

### Health Check Endpoint
GET `/health` includes real-time service statistics:

```json
{
  "status": "OK",
  "realtime": {
    "isMonitoring": true,
    "connectedClients": 5,
    "activeSubscriptions": 3,
    "pollingInterval": 30000
  }
}
```

### Client-side Statistics
Access via `websocketService.getStats()`:

```javascript
{
  "connected": true,
  "subscriptions": 2,
  "retries": 0,
  "serverUrl": "http://localhost:3001",
  "socketId": "abc123..."
}
```

### Logging
Both backend and frontend provide comprehensive logging:
- Connection events (connect/disconnect)
- Subscription management
- Data update broadcasts
- Error conditions
- Performance metrics

## Security Considerations

- **CORS configuration** restricts allowed origins
- **Authentication middleware** on API routes
- **Rate limiting** prevents abuse
- **Input validation** on subscription requests
- **Connection limits** prevent resource exhaustion

## Testing

### Manual Testing
1. Start backend server: `npm run dev`
2. Start frontend: `npm run dev`
3. Open browser developer tools → Network → WS
4. Observe WebSocket connection and real-time updates
5. Test reconnection by stopping/starting backend

### Integration Testing
- Connection establishment and cleanup
- Subscription management lifecycle
- Fallback behavior when WebSocket unavailable
- Data update propagation
- Error handling and recovery

## Deployment Considerations

### Production Configuration
- Set appropriate polling intervals for load
- Configure connection limits based on infrastructure
- Enable compression for WebSocket messages
- Set up monitoring and alerting
- Use clustering/load balancing for scale

### Infrastructure Requirements
- WebSocket-compatible proxy/load balancer
- Sticky sessions if using multiple instances
- Redis for shared session state (if clustering)
- Monitoring for connection counts and performance

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check CORS configuration
   - Verify server is running
   - Check firewall/proxy settings

2. **No Real-time Updates**
   - Verify Azure DevOps configuration
   - Check polling interval settings
   - Review server logs for errors

3. **High CPU Usage**
   - Reduce polling frequency
   - Enable change detection
   - Review subscription cleanup

4. **Memory Leaks**
   - Ensure proper cleanup on component unmount
   - Check for orphaned subscriptions
   - Monitor cache size and TTL

## Future Enhancements

- **Push notifications** for critical updates
- **Selective field updates** to reduce bandwidth
- **Real-time collaboration** features
- **Advanced filtering** and subscription options
- **Performance analytics** dashboard
- **WebSocket clustering** for horizontal scaling

---

**Implementation Status**: ✅ Complete  
**Testing Status**: ⚠️ Requires Integration Testing  
**Documentation**: ✅ Complete  
**Production Ready**: ⚠️ Pending Load Testing
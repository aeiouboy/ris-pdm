# RIS Performance Dashboard - API Documentation

**Version**: 1.0.0  
**Environment**: Production Ready  
**Last Updated**: 2025-09-01  

---

## Table of Contents

1. [Authentication](#authentication)
2. [Webhook Integration](#webhook-integration)
3. [Metrics API](#metrics-api)
4. [Configuration](#configuration)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

---

## Authentication

The RIS Performance Dashboard supports both Personal Access Token (PAT) and OAuth 2.0 authentication for Azure DevOps integration.

### OAuth 2.0 Authentication (Recommended for Production)

#### Get OAuth Status
```http
GET /auth/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "service": "AzureOAuthService",
    "status": "configured",
    "authentication": "not_authenticated",
    "tokenExpiry": null,
    "isExpired": null,
    "scopes": ["vso.work", "vso.project"],
    "timestamp": "2025-09-01T09:09:04.309Z"
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

#### Generate Authorization URL
```http
GET /auth/oauth/authorize?state=optional-state-parameter
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://app.vssps.visualstudio.com/oauth2/authorize?client_id=...",
    "state": "optional-state-parameter",
    "scopes": ["vso.work", "vso.project"]
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

#### Exchange Authorization Code for Token
```http
POST /auth/oauth/token
Content-Type: application/json

{
  "code": "authorization_code_from_callback",
  "state": "optional-state-parameter"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "scope": "vso.work vso.project"
  },
  "message": "Authentication successful",
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

#### Logout
```http
POST /auth/logout
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful",
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

---

## Webhook Integration

Real-time Azure DevOps webhook integration for live work item updates.

### Process Work Item Webhook
```http
POST /webhooks/azure/workitems
Content-Type: application/json
X-Hub-Signature-256: sha256=signature (optional)

{
  "eventType": "workitem.updated",
  "resource": {
    "id": 12345,
    "fields": {
      "System.Title": "Updated work item",
      "System.State": "Active",
      "System.AssignedTo": {
        "displayName": "John Doe",
        "uniqueName": "john.doe@company.com"
      }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventType": "workitem.updated",
  "eventId": "webhook-event-12345",
  "processingTime": "45ms",
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

### Get Webhook Status
```http
GET /webhooks/azure/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "service": "AzureDevOpsWebhookService",
    "status": "healthy",
    "statistics": {
      "eventsReceived": 1247,
      "eventsProcessed": 1247,
      "eventsFailed": 0,
      "successRate": "100%",
      "averageProcessingTime": "42ms",
      "queueSize": 0,
      "eventsByType": {
        "workitem.updated": 856,
        "workitem.created": 234,
        "workitem.deleted": 157
      }
    }
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

### Get Comprehensive Webhook Metrics
```http
GET /webhooks/azure/metrics?timeframe=24h
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timeframe": "24h",
    "summary": {
      "eventsReceived": 1247,
      "eventsProcessed": 1247,
      "eventsFailed": 0,
      "successRate": "100.00%",
      "averageProcessingTime": "42ms"
    },
    "performance": {
      "averageProcessingTime": "42ms",
      "minProcessingTime": "12ms",
      "maxProcessingTime": "234ms",
      "totalEventsProcessed": 1247,
      "eventsPerHour": 52
    },
    "reliability": {
      "uptime": 86387,
      "successRate": 100,
      "errorRate": 0
    },
    "systemHealth": {
      "status": "healthy",
      "uptime": 86387.123,
      "memoryUsage": {
        "rss": 58884096,
        "heapTotal": 44875776,
        "heapUsed": 41584232
      }
    }
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

### Get Webhook Alerts
```http
GET /webhooks/azure/alerts
```

**Response:**
```json
{
  "success": true,
  "data": {
    "configuration": {
      "successRateThreshold": 95,
      "processingTimeThreshold": 1000,
      "errorRateThreshold": 5,
      "queueSizeThreshold": 100
    },
    "activeAlerts": [],
    "alertHistory": [],
    "lastCheck": "2025-09-01T09:09:04.310Z",
    "systemStatus": "healthy"
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

### Configure Webhook Alerts
```http
POST /webhooks/azure/alerts/configure
Content-Type: application/json

{
  "successRateThreshold": 95,
  "processingTimeThreshold": 1000,
  "errorRateThreshold": 5,
  "queueSizeThreshold": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Alert configuration updated",
  "data": {
    "successRateThreshold": 95,
    "processingTimeThreshold": 1000,
    "errorRateThreshold": 5,
    "queueSizeThreshold": 100
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

### Test Webhook
```http
POST /webhooks/azure/test
Content-Type: application/json

{
  "eventType": "workitem.updated",
  "resource": {
    "id": 99999,
    "fields": {
      "System.Title": "Test Work Item"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test webhook processed",
  "result": {
    "success": true,
    "eventType": "workitem.updated",
    "processingTime": "23ms"
  },
  "testPayload": {
    "eventType": "workitem.updated",
    "workItemId": 99999,
    "title": "Test Work Item"
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

### Get Webhook Configuration
```http
GET /webhooks/azure/config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhookUrl": "https://your-domain.com/webhooks/azure/workitems",
    "supportedEvents": [
      "workitem.created",
      "workitem.updated", 
      "workitem.deleted",
      "workitem.restored",
      "workitem.commented"
    ],
    "configuration": {
      "signatureValidation": "enabled",
      "rateLimiting": {
        "windowMs": "1 minute",
        "maxRequests": 100
      }
    },
    "setupInstructions": {
      "step1": "Go to Azure DevOps Project Settings > Service hooks",
      "step2": "Create a new service hook subscription",
      "step3": "Select \"Web Hooks\" as the service",
      "step4": "Set URL to: https://your-domain.com/webhooks/azure/workitems",
      "step5": "Configure events: Work item created, updated, deleted, restored, commented",
      "step6": "Set secret token if signature validation is enabled",
      "step7": "Test the webhook to ensure it works"
    }
  },
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

---

## Metrics API

Performance metrics and KPI endpoints for dashboard visualization.

### Overview Metrics
```http
GET /api/metrics/overview
Authorization: Bearer <token>
```

### Detailed KPIs
```http
GET /api/metrics/kpis?period=sprint&productId=Product-Name&sprintId=current
Authorization: Bearer <token>
```

### Sprint Burndown
```http
GET /api/metrics/burndown?productId=Product-Name&sprintId=current
Authorization: Bearer <token>
```

### Velocity Trend
```http
GET /api/metrics/velocity-trend?period=sprint&range=6&productId=Product-Name
Authorization: Bearer <token>
```

### Task Distribution
```http
GET /api/metrics/task-distribution?period=sprint&productId=Product-Name&sprintId=current
Authorization: Bearer <token>
```

---

## Configuration

### Environment Variables

#### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | Database connection | `postgresql://user:pass@host:port/db` |
| `REDIS_URL` | Redis connection | `redis://user:pass@host:port` |
| `AZURE_DEVOPS_ORG` | Azure DevOps organization | `mycompany` |
| `AZURE_DEVOPS_PROJECT` | Azure DevOps project | `MyProject` |
| `JWT_SECRET` | JWT signing secret | `your-jwt-secret` |
| `ENCRYPTION_KEY` | Data encryption key | `your-encryption-key` |

#### OAuth Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_OAUTH_CLIENT_ID` | OAuth client ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_OAUTH_CLIENT_SECRET` | OAuth client secret | `your-client-secret` |
| `AZURE_OAUTH_REDIRECT_URI` | OAuth redirect URI | `https://your-domain.com/auth/callback` |
| `AZURE_OAUTH_SCOPES` | OAuth scopes | `vso.work,vso.project` |

#### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `CORS_ORIGIN` | CORS origins | `*` |
| `LOG_LEVEL` | Logging level | `info` |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit | `300` |
| `CACHE_TTL_WORK_ITEMS` | Cache TTL (seconds) | `300` |
| `AZURE_DEVOPS_WEBHOOK_SECRET` | Webhook signature secret | `null` |

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error category",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-09-01T09:09:04.310Z",
  "details": {
    "additionalInfo": "Additional error context"
  }
}
```

### HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| `200` | Success | Request processed successfully |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Service temporarily unavailable |

### Error Categories

- **Authentication Errors**: OAuth, token validation
- **Validation Errors**: Request parameter validation
- **Azure DevOps API Errors**: External API failures
- **Rate Limiting Errors**: Request throttling
- **Cache Errors**: Redis connection issues
- **Webhook Errors**: Webhook processing failures

---

## Rate Limiting

### Default Limits

| Endpoint Category | Window | Max Requests |
|-------------------|--------|--------------|
| Authentication | 15 minutes | 10 requests |
| Webhooks | 1 minute | 100 requests |
| General API | 1 minute | 300 requests |

### Rate Limit Headers

All responses include rate limiting headers:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1693574400
X-RateLimit-Used: 1
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests from this IP, please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": "60 seconds",
  "timestamp": "2025-09-01T09:09:04.310Z"
}
```

---

## Examples

### Complete OAuth Flow

```javascript
// 1. Get authorization URL
const authResponse = await fetch('/auth/oauth/authorize');
const { authorizationUrl } = await authResponse.json();

// 2. Redirect user to authorization URL
window.location.href = authorizationUrl;

// 3. Handle callback (server-side)
const tokenResponse = await fetch('/auth/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'authorization_code_from_callback',
    state: 'csrf_protection_state'
  })
});

const tokenData = await tokenResponse.json();
// User is now authenticated
```

### Webhook Setup

```bash
# 1. Get webhook configuration
curl -X GET "https://your-api.com/webhooks/azure/config"

# 2. Configure webhook in Azure DevOps using the provided URL
# URL: https://your-api.com/webhooks/azure/workitems

# 3. Test webhook
curl -X POST "https://your-api.com/webhooks/azure/test" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "workitem.updated",
    "resource": {
      "id": 12345,
      "fields": {
        "System.Title": "Test Work Item"
      }
    }
  }'
```

### Metrics Monitoring

```javascript
// Monitor webhook performance
const metricsResponse = await fetch('/webhooks/azure/metrics?timeframe=1h');
const metrics = await metricsResponse.json();

if (metrics.data.reliability.successRate < 95) {
  console.warn('Webhook success rate below threshold:', metrics.data.reliability.successRate);
}

// Check system health
const statusResponse = await fetch('/webhooks/azure/status');
const status = await statusResponse.json();

if (status.data.statistics.queueSize > 50) {
  console.warn('High webhook queue size:', status.data.statistics.queueSize);
}
```

---

## Health Checks

### System Health
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-09-01T09:09:04.310Z",
  "uptime": 86387.123,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "azureDevOps": "authenticated",
    "webhooks": "healthy"
  },
  "performance": {
    "status": "healthy",
    "memoryUsage": {
      "heapUsed": 41584232,
      "heapTotal": 44875776
    },
    "responseTime": "23ms"
  }
}
```

---

## Support

For technical support and API questions:

- **Documentation**: This API documentation
- **System Health**: Monitor `/health` endpoint
- **Webhook Status**: Monitor `/webhooks/azure/status` endpoint
- **Error Logs**: Check application logs for detailed error information

**API Version**: 1.0.0  
**Last Updated**: September 1, 2025  
**Status**: Production Ready ✅
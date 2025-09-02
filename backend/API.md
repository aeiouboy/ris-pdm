# RIS Performance Dashboard - API Documentation

Comprehensive API documentation for the RIS Performance Dashboard Backend with Azure DevOps integration.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Health & Status](#health--status)
  - [Authentication](#authentication-endpoints)
  - [Work Items](#work-items)
  - [Team Management](#team-management)
  - [Performance Metrics](#performance-metrics)
  - [Exports](#exports)
- [WebSocket API](#websocket-api)
- [SDKs & Examples](#sdks--examples)

## Overview

The RIS Performance Dashboard API provides programmatic access to Azure DevOps performance metrics, team analytics, and work item management. The API supports both REST endpoints and real-time WebSocket connections.

**API Version:** 1.0.0  
**Base URL:** `https://api.your-domain.com`  
**Authentication:** OAuth 2.0, Personal Access Token (PAT)  
**Data Format:** JSON  
**Rate Limits:** 100 requests per 15 minutes (unauthenticated), 1000 requests per hour (authenticated)

## Authentication

### OAuth 2.0 (Recommended)

The API uses OAuth 2.0 with PKCE for secure authentication with Azure DevOps.

#### 1. Authorization URL

```http
GET /auth/azure/login
```

**Response:**
```json
{
  "success": true,
  "authorizationUrl": "https://app.vssps.visualstudio.com/oauth2/authorize?client_id=...",
  "state": "random-state-string",
  "message": "Redirect user to authorizationUrl to begin OAuth flow"
}
```

#### 2. Handle OAuth Callback

```http
GET /auth/azure/callback?code=AUTH_CODE&state=STATE
```

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "user": {
    "id": "user_12345",
    "tokenExpiry": "2024-01-01T12:00:00.000Z"
  },
  "redirect": "/dashboard"
}
```

#### 3. Using Access Tokens

Include the user ID in request headers:

```http
X-User-Id: user_12345
```

### Personal Access Token (PAT)

For server-to-server authentication, configure PAT in environment variables. No additional headers required for PAT authentication.

## Base URLs

- **Production:** `https://api.your-domain.com`
- **Staging:** `https://staging-api.your-domain.com`  
- **Development:** `http://localhost:3002`

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "metadata": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_12345",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "projectId",
        "message": "Project ID is required"
      }
    ]
  },
  "metadata": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_12345"
  }
}
```

### Pagination

Paginated responses include pagination metadata:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "pages": 25,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Error Handling

### HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized  
- **403** - Forbidden
- **404** - Not Found
- **429** - Too Many Requests
- **500** - Internal Server Error
- **503** - Service Unavailable

### Error Codes

| Code | Description | Typical HTTP Status |
|------|-------------|-------------------|
| `VALIDATION_ERROR` | Request validation failed | 400 |
| `AUTHENTICATION_FAILED` | Invalid or expired authentication | 401 |
| `AUTHORIZATION_FAILED` | Insufficient permissions | 403 |
| `RESOURCE_NOT_FOUND` | Requested resource not found | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `AZURE_DEVOPS_ERROR` | Azure DevOps API error | 502 |
| `INTERNAL_ERROR` | Server internal error | 500 |

## Rate Limiting

Rate limits are enforced per IP address and per authenticated user:

- **Unauthenticated:** 100 requests per 15 minutes
- **Authenticated:** 1000 requests per hour
- **OAuth users:** 2000 requests per hour

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Used: 1
```

## API Endpoints

### Health & Status

#### Get API Health

```http
GET /health
```

**Description:** Check API health and service status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "azureDevOps": "healthy"
    },
    "uptime": 86400,
    "memory": {
      "used": "512MB",
      "total": "1GB"
    }
  }
}
```

#### Get Service Status

```http
GET /status
```

**Description:** Detailed service status and configuration information.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "service": "RIS Performance Dashboard API",
    "version": "1.0.0",
    "environment": "production",
    "azureDevOps": {
      "organization": "centralgroup",
      "project": "Product - Partner Management Platform",
      "authenticated": true,
      "lastSync": "2024-01-01T12:00:00.000Z"
    },
    "features": {
      "oauth": true,
      "websockets": true,
      "realTimeUpdates": true,
      "exports": true
    }
  }
}
```

### Authentication Endpoints

#### Refresh Token

```http
POST /auth/azure/refresh
```

**Description:** Refresh OAuth access token.

**Request Body:**
```json
{
  "userId": "user_12345"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "tokenExpiry": "2024-01-01T13:00:00.000Z"
}
```

#### Logout

```http
POST /auth/azure/logout
```

**Description:** Logout and revoke tokens.

**Request Body:**
```json
{
  "userId": "user_12345"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### Authentication Status

```http
GET /auth/azure/status?userId=user_12345
```

**Description:** Check authentication status for user.

**Query Parameters:**
- `userId` (required) - User identifier

**Response:**
```json
{
  "success": true,
  "authenticated": true,
  "tokenExpired": false,
  "tokenExpiry": "2024-01-01T13:00:00.000Z",
  "hasRefreshToken": true
}
```

### Work Items

#### Get Work Items

```http
GET /api/workitems
```

**Description:** Retrieve work items with filtering and pagination.

**Authentication:** Required

**Query Parameters:**
- `project` (optional) - Project name or ID
- `assignedTo` (optional) - Filter by assignee email
- `state` (optional) - Filter by work item state
- `iterationPath` (optional) - Filter by iteration
- `workItemType` (optional) - Filter by type (User Story, Bug, Task, etc.)
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 50, max: 200) - Items per page
- `sortBy` (optional, default: 'changedDate') - Sort field
- `sortOrder` (optional, default: 'desc') - Sort order (asc/desc)

**Example Request:**
```http
GET /api/workitems?assignedTo=user@company.com&state=Active&page=1&limit=25
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workItems": [
      {
        "id": 12345,
        "title": "Implement user authentication",
        "type": "User Story",
        "state": "Active",
        "assignedTo": {
          "displayName": "John Doe",
          "uniqueName": "john.doe@company.com",
          "imageUrl": "https://...",
          "id": "user-guid"
        },
        "iterationPath": "Sprint 1",
        "areaPath": "Product\\Frontend",
        "tags": ["authentication", "security"],
        "storyPoints": 8,
        "priority": 2,
        "createdDate": "2024-01-01T09:00:00.000Z",
        "changedDate": "2024-01-01T11:30:00.000Z",
        "url": "https://dev.azure.com/org/project/_workitems/edit/12345"
      }
    ],
    "summary": {
      "total": 150,
      "byState": {
        "New": 25,
        "Active": 75,
        "Resolved": 30,
        "Closed": 20
      },
      "byType": {
        "User Story": 60,
        "Task": 70,
        "Bug": 20
      }
    }
  },
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "pages": 6,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Get Work Item Details

```http
GET /api/workitems/:id
```

**Description:** Get detailed information for a specific work item.

**Authentication:** Required

**Path Parameters:**
- `id` (required) - Work item ID

**Response:**
```json
{
  "success": true,
  "data": {
    "workItem": {
      "id": 12345,
      "title": "Implement user authentication",
      "description": "Detailed description...",
      "type": "User Story",
      "state": "Active",
      "assignedTo": {
        "displayName": "John Doe",
        "uniqueName": "john.doe@company.com",
        "imageUrl": "https://...",
        "id": "user-guid"
      },
      "iterationPath": "Sprint 1",
      "areaPath": "Product\\Frontend",
      "tags": ["authentication", "security"],
      "storyPoints": 8,
      "priority": 2,
      "severity": null,
      "activity": "Development",
      "effort": 8,
      "originalEstimate": 16,
      "remainingWork": 8,
      "completedWork": 8,
      "createdDate": "2024-01-01T09:00:00.000Z",
      "changedDate": "2024-01-01T11:30:00.000Z",
      "closedDate": null,
      "createdBy": {
        "displayName": "Jane Smith",
        "uniqueName": "jane.smith@company.com",
        "id": "creator-guid"
      },
      "changedBy": {
        "displayName": "John Doe",
        "uniqueName": "john.doe@company.com",
        "id": "user-guid"
      },
      "url": "https://dev.azure.com/org/project/_workitems/edit/12345",
      "relations": [
        {
          "rel": "System.LinkTypes.Hierarchy-Forward",
          "url": "https://dev.azure.com/org/project/_apis/wit/workItems/12346",
          "attributes": {
            "isLocked": false,
            "name": "Child"
          }
        }
      ],
      "comments": [
        {
          "id": 98765,
          "text": "Work started on authentication module",
          "createdDate": "2024-01-01T10:00:00.000Z",
          "createdBy": {
            "displayName": "John Doe",
            "uniqueName": "john.doe@company.com"
          }
        }
      ]
    }
  }
}
```

#### Create Work Item

```http
POST /api/workitems
```

**Description:** Create a new work item.

**Authentication:** Required (OAuth with work_write scope)

**Request Body:**
```json
{
  "type": "User Story",
  "title": "New feature implementation",
  "description": "Detailed description of the feature",
  "assignedTo": "user@company.com",
  "areaPath": "Product\\Frontend",
  "iterationPath": "Sprint 2",
  "storyPoints": 5,
  "priority": 2,
  "tags": ["feature", "frontend"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workItem": {
      "id": 12346,
      "title": "New feature implementation",
      "type": "User Story",
      "state": "New",
      "url": "https://dev.azure.com/org/project/_workitems/edit/12346",
      "createdDate": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

#### Update Work Item

```http
PUT /api/workitems/:id
```

**Description:** Update an existing work item.

**Authentication:** Required (OAuth with work_write scope)

**Path Parameters:**
- `id` (required) - Work item ID

**Request Body:**
```json
{
  "title": "Updated feature implementation",
  "state": "Active",
  "assignedTo": "newuser@company.com",
  "storyPoints": 8,
  "tags": ["feature", "frontend", "updated"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workItem": {
      "id": 12346,
      "title": "Updated feature implementation",
      "state": "Active",
      "changedDate": "2024-01-01T12:30:00.000Z"
    }
  }
}
```

#### Delete Work Item

```http
DELETE /api/workitems/:id
```

**Description:** Delete (move to Removed state) a work item.

**Authentication:** Required (OAuth with work_write scope)

**Path Parameters:**
- `id` (required) - Work item ID

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Work item moved to Removed state",
    "workItemId": 12346,
    "deletedDate": "2024-01-01T12:45:00.000Z"
  }
}
```

#### Add Work Item Comment

```http
POST /api/workitems/:id/comments
```

**Description:** Add a comment to a work item.

**Authentication:** Required

**Path Parameters:**
- `id` (required) - Work item ID

**Request Body:**
```json
{
  "text": "This is a comment on the work item"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comment": {
      "id": 98766,
      "text": "This is a comment on the work item",
      "createdDate": "2024-01-01T12:50:00.000Z"
    }
  }
}
```

### Team Management

#### Get Team Members

```http
GET /api/teams/members
```

**Description:** Get team members and their basic information.

**Authentication:** Required

**Query Parameters:**
- `project` (optional) - Project name or ID
- `team` (optional) - Team name
- `includeInactive` (optional, default: false) - Include inactive members

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "user-guid",
        "displayName": "John Doe",
        "uniqueName": "john.doe@company.com",
        "emailAddress": "john.doe@company.com",
        "imageUrl": "https://...",
        "isActive": true,
        "lastAccessedDate": "2024-01-01T11:00:00.000Z"
      }
    ],
    "summary": {
      "total": 25,
      "active": 23,
      "inactive": 2
    }
  }
}
```

#### Get Team Capacity

```http
GET /api/teams/capacity
```

**Description:** Get team capacity information for iterations.

**Authentication:** Required

**Query Parameters:**
- `iterationPath` (required) - Iteration path
- `project` (optional) - Project name or ID

**Response:**
```json
{
  "success": true,
  "data": {
    "capacity": [
      {
        "teamMember": {
          "id": "user-guid",
          "displayName": "John Doe",
          "uniqueName": "john.doe@company.com"
        },
        "activities": [
          {
            "capacityPerDay": 6.0,
            "name": "Development"
          }
        ],
        "daysOff": [
          {
            "start": "2024-01-15T00:00:00.000Z",
            "end": "2024-01-16T00:00:00.000Z"
          }
        ]
      }
    ],
    "summary": {
      "totalCapacity": 150,
      "totalDaysOff": 5,
      "iterationDays": 10
    }
  }
}
```

### Performance Metrics

#### Get Team Performance

```http
GET /api/metrics/team-performance
```

**Description:** Get team performance metrics and analytics.

**Authentication:** Required

**Query Parameters:**
- `iterationPath` (optional) - Specific iteration
- `startDate` (optional) - Start date (ISO 8601)
- `endDate` (optional) - End date (ISO 8601)
- `teamMember` (optional) - Filter by team member
- `project` (optional) - Project name or ID

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "velocity": {
        "current": 45,
        "average": 42,
        "trend": "increasing"
      },
      "cycleTime": {
        "average": 5.2,
        "median": 4.8,
        "unit": "days"
      },
      "leadTime": {
        "average": 8.7,
        "median": 7.5,
        "unit": "days"
      },
      "throughput": {
        "workItemsCompleted": 23,
        "storyPointsCompleted": 45
      },
      "qualityMetrics": {
        "bugRate": 0.15,
        "defectDensity": 2.3,
        "reworkRate": 0.08
      }
    },
    "memberMetrics": [
      {
        "member": {
          "id": "user-guid",
          "displayName": "John Doe",
          "uniqueName": "john.doe@company.com"
        },
        "performance": {
          "storyPointsCompleted": 13,
          "workItemsCompleted": 5,
          "averageCycleTime": 4.2,
          "qualityScore": 0.92
        }
      }
    ],
    "trends": {
      "velocityHistory": [
        {
          "iteration": "Sprint 1",
          "velocity": 38,
          "date": "2023-12-15T00:00:00.000Z"
        },
        {
          "iteration": "Sprint 2", 
          "velocity": 42,
          "date": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  }
}
```

#### Get Individual Performance

```http
GET /api/metrics/individual-performance/:memberId
```

**Description:** Get detailed performance metrics for an individual team member.

**Authentication:** Required

**Path Parameters:**
- `memberId` (required) - Team member ID

**Query Parameters:**
- `startDate` (optional) - Start date (ISO 8601)
- `endDate` (optional) - End date (ISO 8601)
- `includeDetails` (optional, default: false) - Include detailed work item breakdown

**Response:**
```json
{
  "success": true,
  "data": {
    "member": {
      "id": "user-guid",
      "displayName": "John Doe",
      "uniqueName": "john.doe@company.com"
    },
    "performance": {
      "summary": {
        "totalWorkItems": 45,
        "totalStoryPoints": 120,
        "averageCycleTime": 4.2,
        "averageLeadTime": 7.8,
        "completionRate": 0.94
      },
      "productivity": {
        "workItemsPerSprint": 8.5,
        "storyPointsPerSprint": 22.5,
        "hoursLoggedPerDay": 6.8
      },
      "quality": {
        "bugCreationRate": 0.12,
        "bugFixRate": 0.95,
        "reworkRate": 0.06,
        "codeReviewScore": 4.2
      },
      "collaboration": {
        "peerReviewsGiven": 25,
        "peerReviewsReceived": 18,
        "knowledgeSharingScore": 3.8
      }
    },
    "trends": {
      "velocityTrend": "stable",
      "qualityTrend": "improving",
      "productivityTrend": "increasing"
    }
  }
}
```

### Exports

#### Export Work Items

```http
POST /api/exports/workitems
```

**Description:** Export work items to various formats.

**Authentication:** Required

**Request Body:**
```json
{
  "format": "excel",
  "filters": {
    "project": "Product - Partner Management Platform",
    "iterationPath": "Sprint 1",
    "assignedTo": "user@company.com",
    "state": "Active"
  },
  "fields": [
    "id",
    "title", 
    "type",
    "state",
    "assignedTo",
    "storyPoints",
    "createdDate"
  ],
  "includeHistory": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exportId": "export_12345",
    "status": "processing",
    "estimatedCompletion": "2024-01-01T12:05:00.000Z",
    "downloadUrl": null
  }
}
```

#### Get Export Status

```http
GET /api/exports/:exportId
```

**Description:** Check the status of an export job.

**Authentication:** Required

**Path Parameters:**
- `exportId` (required) - Export job ID

**Response:**
```json
{
  "success": true,
  "data": {
    "exportId": "export_12345",
    "status": "completed",
    "createdDate": "2024-01-01T12:00:00.000Z",
    "completedDate": "2024-01-01T12:03:00.000Z",
    "downloadUrl": "https://api.your-domain.com/exports/export_12345/download",
    "expiresAt": "2024-01-02T12:03:00.000Z",
    "fileSize": 1024000,
    "recordCount": 150
  }
}
```

#### Download Export

```http
GET /api/exports/:exportId/download
```

**Description:** Download completed export file.

**Authentication:** Required

**Path Parameters:**
- `exportId` (required) - Export job ID

**Response:** File download (Excel, CSV, or PDF)

## WebSocket API

### Connection

```javascript
const socket = io('wss://api.your-domain.com', {
  auth: {
    userId: 'user_12345'
  }
});
```

### Events

#### Subscribe to Work Item Updates

```javascript
socket.emit('subscribe', {
  type: 'workitems',
  filters: {
    assignedTo: 'user@company.com',
    project: 'Product - Partner Management Platform'
  }
});
```

#### Receive Work Item Updates

```javascript
socket.on('workitem:updated', (data) => {
  console.log('Work item updated:', data);
  // {
  //   workItemId: 12345,
  //   changes: {
  //     state: { from: 'Active', to: 'Resolved' }
  //   },
  //   changedBy: 'user@company.com',
  //   changedDate: '2024-01-01T12:00:00.000Z'
  // }
});
```

#### Subscribe to Performance Metrics

```javascript
socket.emit('subscribe', {
  type: 'metrics',
  filters: {
    team: 'Frontend Team'
  }
});

socket.on('metrics:updated', (data) => {
  console.log('Metrics updated:', data);
});
```

### WebSocket Events

| Event | Description | Data Format |
|-------|-------------|-------------|
| `workitem:created` | New work item created | `{ workItemId, title, assignedTo, ... }` |
| `workitem:updated` | Work item updated | `{ workItemId, changes, changedBy, ... }` |
| `workitem:deleted` | Work item deleted | `{ workItemId, deletedBy, ... }` |
| `metrics:updated` | Performance metrics updated | `{ team, metrics, timestamp }` |
| `team:member-added` | Team member added | `{ memberId, displayName, ... }` |
| `team:member-removed` | Team member removed | `{ memberId, displayName, ... }` |

## SDKs & Examples

### JavaScript/Node.js Example

```javascript
const fetch = require('node-fetch');

class RISApiClient {
  constructor(baseUrl, userId) {
    this.baseUrl = baseUrl;
    this.userId = userId;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async getWorkItems(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.makeRequest(`/api/workitems?${params}`);
  }

  async createWorkItem(workItem) {
    return this.makeRequest('/api/workitems', {
      method: 'POST',
      body: JSON.stringify(workItem)
    });
  }

  async getTeamPerformance(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.makeRequest(`/api/metrics/team-performance?${params}`);
  }
}

// Usage
const client = new RISApiClient('https://api.your-domain.com', 'user_12345');

// Get work items
client.getWorkItems({ assignedTo: 'user@company.com', state: 'Active' })
  .then(response => {
    console.log('Work items:', response.data.workItems);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

### Python Example

```python
import requests
import json

class RISApiClient:
    def __init__(self, base_url, user_id):
        self.base_url = base_url
        self.user_id = user_id
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-User-Id': user_id
        })
    
    def get_work_items(self, **filters):
        response = self.session.get(
            f"{self.base_url}/api/workitems",
            params=filters
        )
        response.raise_for_status()
        return response.json()
    
    def create_work_item(self, work_item):
        response = self.session.post(
            f"{self.base_url}/api/workitems",
            data=json.dumps(work_item)
        )
        response.raise_for_status()
        return response.json()
    
    def get_team_performance(self, **filters):
        response = self.session.get(
            f"{self.base_url}/api/metrics/team-performance",
            params=filters
        )
        response.raise_for_status()
        return response.json()

# Usage
client = RISApiClient('https://api.your-domain.com', 'user_12345')

# Get work items
try:
    work_items = client.get_work_items(
        assignedTo='user@company.com',
        state='Active'
    )
    print(f"Found {len(work_items['data']['workItems'])} work items")
except requests.RequestException as e:
    print(f"Error: {e}")
```

### cURL Examples

```bash
# Get work items
curl -X GET "https://api.your-domain.com/api/workitems?assignedTo=user@company.com&state=Active" \
  -H "X-User-Id: user_12345" \
  -H "Content-Type: application/json"

# Create work item
curl -X POST "https://api.your-domain.com/api/workitems" \
  -H "X-User-Id: user_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "User Story",
    "title": "New feature implementation",
    "assignedTo": "user@company.com",
    "storyPoints": 5
  }'

# Get team performance
curl -X GET "https://api.your-domain.com/api/metrics/team-performance" \
  -H "X-User-Id: user_12345" \
  -H "Content-Type: application/json"
```

## Support

- **Documentation:** [https://docs.your-domain.com](https://docs.your-domain.com)
- **API Issues:** [https://github.com/your-org/ris-dashboard/issues](https://github.com/your-org/ris-dashboard/issues)
- **Support Email:** api-support@your-domain.com

## Changelog

### Version 1.0.0
- Initial API release
- OAuth 2.0 authentication
- Work item CRUD operations
- Team performance metrics
- Real-time WebSocket updates
- Export functionality
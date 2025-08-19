# RIS Performance Dashboard Backend API - Complete Structure

## Project Overview

The Express.js backend API provides comprehensive performance metrics and work item management for the RIS Performance Dashboard, with full Azure AD authentication and Azure DevOps integration.

## API Endpoints Structure

### Base URL: `http://localhost:3001`

## 🔧 System Endpoints

### Health Check
```
GET /health
```
- **Description**: Server health status and uptime
- **Authentication**: None required
- **Response**: Server status, uptime, environment info

---

## 🏢 Products API (`/api/products`)

### Get All Products
```
GET /api/products?status=active&limit=50&offset=0
```
- **Authentication**: Required
- **Query Parameters**:
  - `status`: active, inactive, archived
  - `limit`: 1-100 (default: 50)
  - `offset`: 0+ (default: 0)
- **Response**: List of products with pagination

### Get Product by ID
```
GET /api/products/:productId
```
- **Authentication**: Required
- **Parameters**: `productId` (string, format: prod-xxx)
- **Response**: Detailed product information

### Get Product Metrics
```
GET /api/products/:productId/metrics?sprintId=sprint-123&startDate=2024-01-01&endDate=2024-01-31
```
- **Authentication**: Required
- **Parameters**: `productId`
- **Query Parameters**:
  - `sprintId`: Sprint identifier
  - `startDate`: ISO 8601 date
  - `endDate`: ISO 8601 date
- **Response**: Comprehensive product performance metrics

---

## 📊 Metrics API (`/api/metrics`)

### Performance Overview
```
GET /api/metrics/overview?period=sprint&startDate=2024-01-01&endDate=2024-01-31
```
- **Authentication**: Required
- **Query Parameters**:
  - `period`: sprint, month, quarter, year
  - `startDate`: ISO 8601 date (optional)
  - `endDate`: ISO 8601 date (optional)
- **Response**: High-level performance dashboard data
- **Features**: Cached for 5 minutes

### Product-Specific Metrics
```
GET /api/metrics/products/:productId?period=sprint&sprintId=sprint-123
```
- **Authentication**: Required
- **Parameters**: `productId`
- **Query Parameters**:
  - `period`: sprint, month, quarter, year
  - `sprintId`: Sprint identifier
- **Response**: Detailed product performance metrics

### Team Metrics
```
GET /api/metrics/teams/:teamId?period=sprint
```
- **Authentication**: Required
- **Parameters**: `teamId`
- **Query Parameters**:
  - `period`: sprint, month, quarter
- **Response**: Team-specific performance data

### Historical Trends
```
GET /api/metrics/trends?metric=velocity&period=sprint&range=6
```
- **Authentication**: Required
- **Query Parameters**:
  - `metric`: velocity, burndown, quality, productivity, satisfaction, delivery
  - `period`: sprint, month, quarter
  - `range`: 1-12 periods
- **Response**: Time series trend data

---

## 👥 Users API (`/api/users`)

### Current User Profile
```
GET /api/users/profile
```
- **Authentication**: Required
- **Response**: Current user profile with preferences and permissions

### All Users (Manager/Admin Only)
```
GET /api/users?team=Core%20Platform&role=Developer&status=active&limit=50&offset=0
```
- **Authentication**: Required (Manager/Admin roles)
- **Query Parameters**:
  - `team`: Team name filter
  - `role`: Role filter
  - `status`: active, inactive
  - `limit`: 1-100 (default: 50)
  - `offset`: 0+ (default: 0)
- **Response**: List of users with pagination

### User by ID
```
GET /api/users/:userId
```
- **Authentication**: Required (own profile or Manager/Admin)
- **Parameters**: `userId`
- **Response**: User profile information

### Individual Performance
```
GET /api/users/:userId/performance?period=sprint&startDate=2024-01-01&endDate=2024-01-31
```
- **Authentication**: Required (own data or Manager/Admin)
- **Parameters**: `userId`
- **Query Parameters**:
  - `period`: sprint, month, quarter, year
  - `startDate`: ISO 8601 date (optional)
  - `endDate`: ISO 8601 date (optional)
- **Response**: Individual performance metrics and goals

### Update Profile
```
PUT /api/users/profile
```
- **Authentication**: Required
- **Body**: User preferences and skills
- **Response**: Updated profile information

---

## 📋 Work Items API (`/api/workitems`)

### Get Work Items with Filtering
```
GET /api/workitems?assignedTo=user-1&state=Active&workItemType=Feature&iteration=Sprint%2024.3&area=RIS%20Core&priority=2&limit=50&offset=0
```
- **Authentication**: Required
- **Query Parameters**:
  - `assignedTo`: User ID filter
  - `state`: New, Active, Resolved, Closed, Removed
  - `workItemType`: Epic, Feature, User Story, Task, Bug
  - `iteration`: Sprint/iteration name
  - `area`: Area path filter
  - `priority`: 1-4 (1=highest)
  - `limit`: 1-200 (default: 50)
  - `offset`: 0+ (default: 0)
- **Response**: Filtered work items with pagination

### Get Specific Work Item
```
GET /api/workitems/:workItemId
```
- **Authentication**: Required
- **Parameters**: `workItemId` (integer)
- **Response**: Detailed work item with history, comments, attachments

### Get Available Iterations
```
GET /api/workitems/meta/iterations
```
- **Authentication**: Required
- **Response**: List of available sprints/iterations

### Get Area Paths
```
GET /api/workitems/meta/areas
```
- **Authentication**: Required
- **Response**: Hierarchical area path structure

### Update Work Item (Future)
```
PUT /api/workitems/:workItemId
```
- **Authentication**: Required
- **Status**: Not yet implemented (returns 501)

---

## 🔐 Authentication & Authorization

### Azure AD Integration
- **Token Type**: Bearer JWT tokens from Azure AD
- **Header Format**: `Authorization: Bearer <token>`
- **Token Validation**: Full Azure AD token validation
- **Development Mode**: Set `SKIP_AUTH=true` to bypass authentication

### Role-Based Access Control
- **Developer**: Basic access to own data and assigned work items
- **Manager**: Access to team data and user management
- **Admin**: Full system access and user management
- **ProductManager**: Product creation and management

### Protected Routes
All `/api/*` routes require authentication except:
- `GET /health` (public health check)

---

## 📝 Request/Response Format

### Standard Response Format
```json
{
  "data": {}, // Response payload
  "pagination": { // For paginated responses
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "path": "/api/endpoint",
  "method": "GET",
  "details": [] // Validation errors (when applicable)
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource not found
- `ACCESS_DENIED`: Insufficient permissions
- `AUTHENTICATION_FAILED`: Invalid/missing authentication
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `AZURE_DEVOPS_ERROR`: Azure DevOps API error
- `INTERNAL_ERROR`: Server error

---

## 🛡️ Security Features

### Security Middleware Stack
1. **Helmet**: Security headers (XSS, MIME sniffing protection)
2. **CORS**: Configurable cross-origin resource sharing
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **Request Size Limits**: 10MB payload limit
5. **Compression**: Response compression for performance

### Input Validation
- **Joi Schemas**: Comprehensive request validation
- **Express Validator**: Parameter and query validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Prevention**: Input sanitization

---

## ⚡ Performance Features

### Caching Strategy
- **Work Items**: 5-minute cache TTL
- **Iterations**: 1-hour cache TTL
- **Area Paths**: 1-hour cache TTL
- **Team Data**: 30-minute cache TTL

### Rate Limiting
- **Global**: 100 requests per 15 minutes
- **Azure API**: 300 requests per minute
- **Per-User**: Tracked by IP address

---

## 🔧 Development & Testing

### Development Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure .env file
npm run dev
```

### Testing
```bash
npm test              # Run test suite
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Environment Configuration
```env
# Required for Azure integration
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_DEVOPS_ORG=your_organization
AZURE_DEVOPS_PROJECT=your_project
AZURE_DEVOPS_PAT=your_personal_access_token

# Development settings
NODE_ENV=development
SKIP_AUTH=true  # For development without Azure AD
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

---

## 📊 Mock Data Coverage

The API currently includes comprehensive mock data for:
- **Products**: 2 sample products with team information
- **Metrics**: Performance data, trends, KPIs
- **Users**: 3 sample users with different roles
- **Work Items**: 3 detailed work items with comments and history
- **Teams**: Team structure and performance data
- **Iterations**: Sprint information and metadata

This mock data enables full frontend development and testing without requiring live Azure DevOps connectivity.

---

## 🚀 Production Considerations

### Deployment Checklist
- [ ] Configure production database
- [ ] Set up Azure AD application
- [ ] Configure Azure DevOps integration
- [ ] Enable SSL/TLS termination
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up backup strategies
- [ ] Configure reverse proxy (nginx/Apache)

### Monitoring & Observability
- **Winston Logging**: Structured JSON logs
- **Health Checks**: Built-in health monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Request timing and throughput

This backend API provides a complete foundation for the RIS Performance Dashboard with enterprise-grade security, performance, and maintainability features.
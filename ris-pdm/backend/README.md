# RIS Performance Dashboard Backend API

A RESTful API backend for the RIS Performance Dashboard built with Express.js, providing comprehensive performance metrics and work item management integrated with Azure DevOps.

## Features

- **RESTful API** with comprehensive endpoints for products, metrics, users, and work items
- **Azure AD Integration** for secure authentication and authorization
- **Azure DevOps Integration** for work item management and sprint data
- **Role-based Access Control** with support for different user roles
- **Request Validation** using Joi schemas and express-validator
- **Error Handling** with detailed error responses and logging
- **Rate Limiting** to prevent API abuse
- **Caching** for improved performance
- **Comprehensive Logging** with Winston
- **Security Middleware** including Helmet, CORS, and compression

## Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- Azure AD application registration
- Azure DevOps organization with PAT (Personal Access Token)

## Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Azure AD Configuration
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id

# Azure DevOps Configuration
AZURE_DEVOPS_ORG=your_organization
AZURE_DEVOPS_PROJECT=your_project
AZURE_DEVOPS_PAT=your_personal_access_token

# Other Configuration
CORS_ORIGIN=http://localhost:3000
SKIP_AUTH=true  # Set to true for development without Azure AD
```

## Development

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## API Documentation

### Authentication

All API endpoints (except `/health`) require authentication via Azure AD Bearer tokens:

```http
Authorization: Bearer <your_azure_ad_token>
```

For development, set `SKIP_AUTH=true` in your `.env` file to bypass authentication.

### Base URL

```
http://localhost:3001/api
```

### Endpoints

#### Health Check
- `GET /health` - Server health status

#### Products
- `GET /api/products` - Get all products
- `GET /api/products/:productId` - Get product by ID
- `GET /api/products/:productId/metrics` - Get product metrics

#### Metrics
- `GET /api/metrics/overview` - Get performance overview
- `GET /api/metrics/products/:productId` - Get product-specific metrics
- `GET /api/metrics/teams/:teamId` - Get team metrics
- `GET /api/metrics/trends` - Get historical trends

#### Users
- `GET /api/users/profile` - Get current user profile
- `GET /api/users` - Get all users (Manager/Admin only)
- `GET /api/users/:userId` - Get user by ID
- `GET /api/users/:userId/performance` - Get individual performance
- `PUT /api/users/profile` - Update user profile

#### Work Items
- `GET /api/workitems` - Get work items with filtering
- `GET /api/workitems/:workItemId` - Get specific work item
- `GET /api/workitems/meta/iterations` - Get available iterations
- `GET /api/workitems/meta/areas` - Get area paths

### Query Parameters

Most endpoints support query parameters for filtering and pagination:

- `limit` - Number of items to return (1-200, default: 50)
- `offset` - Number of items to skip (default: 0)
- `period` - Time period: sprint, month, quarter, year
- `startDate` - Start date (ISO 8601 format)
- `endDate` - End date (ISO 8601 format)

### Response Format

All API responses follow a consistent format:

```json
{
  "data": {}, // Response data
  "pagination": { // For paginated responses
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### Error Responses

Error responses include detailed information:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "path": "/api/endpoint",
  "method": "GET"
}
```

## Security

### Authentication & Authorization

- **Azure AD Integration**: Secure token-based authentication
- **Role-based Access Control**: Different permissions for Admin, Manager, Developer roles
- **Token Validation**: Proper JWT token validation with Azure AD

### Security Middleware

- **Helmet**: Security headers for XSS protection, content type sniffing prevention
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Request Size Limits**: Protection against large payload attacks

## Logging

The application uses Winston for comprehensive logging:

- **Console Logging**: Colorized output for development
- **File Logging**: Separate files for errors and combined logs
- **Request Logging**: Morgan middleware for HTTP request logging
- **Structured Logging**: JSON format for production environments

Log files are stored in the `logs/` directory:
- `error.log` - Error-level logs only
- `combined.log` - All log levels

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database connection
3. Set up proper Azure AD application
4. Configure Azure DevOps integration
5. Set up monitoring and alerting
6. Enable SSL/TLS termination
7. Configure reverse proxy (nginx/Apache)

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3001 |
| `NODE_ENV` | Environment | No | development |
| `AZURE_CLIENT_ID` | Azure AD client ID | Yes | - |
| `AZURE_CLIENT_SECRET` | Azure AD client secret | Yes | - |
| `AZURE_TENANT_ID` | Azure AD tenant ID | Yes | - |
| `AZURE_DEVOPS_ORG` | Azure DevOps organization | Yes | - |
| `AZURE_DEVOPS_PROJECT` | Azure DevOps project | Yes | - |
| `AZURE_DEVOPS_PAT` | Personal access token | Yes | - |
| `CORS_ORIGIN` | Allowed CORS origin | No | http://localhost:3000 |
| `SKIP_AUTH` | Skip authentication (dev only) | No | false |
| `LOG_LEVEL` | Logging level | No | info |
| `CACHE_TTL` | Cache TTL in seconds | No | 300 |

## Architecture

```
backend/
├── config/          # Configuration files
├── controllers/     # Route controllers (future)
├── middleware/      # Express middleware
├── models/          # Data models (future)
├── routes/          # API route definitions
├── utils/           # Utility functions
├── logs/            # Log files
├── server.js        # Main application entry point
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

## Contributing

1. Follow the existing code style and patterns
2. Add appropriate validation for new endpoints
3. Include error handling for all new functionality
4. Add logging for important operations
5. Update documentation for new features
6. Write tests for new functionality

## License

MIT License - see LICENSE file for details
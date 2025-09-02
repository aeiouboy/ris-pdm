# RIS Performance Dashboard - Production Deployment Guide

Complete guide for deploying the RIS Performance Dashboard Backend with Azure DevOps integration.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Azure AD Application Setup](#azure-ad-application-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Redis Configuration](#redis-configuration)
- [Security Configuration](#security-configuration)
- [Deployment Options](#deployment-options)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services

- **Node.js** 18+ with npm 8+
- **Redis** 6+ for caching and sessions
- **Supabase** or PostgreSQL database
- **Azure DevOps** organization with appropriate permissions
- **Azure Active Directory** for OAuth 2.0 authentication

### Required Permissions

- **Azure DevOps**: Work items (read/write), Projects (read), Analytics (read)
- **Azure AD**: Application registration and configuration permissions
- **Database**: Read/write access to application schema
- **Redis**: Full access for caching and session management

## Azure AD Application Setup

### 1. Create Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory
2. Navigate to **App registrations** → **New registration**
3. Configure application:
   ```
   Name: RIS Performance Dashboard
   Supported account types: Accounts in this organizational directory only
   Redirect URI: Web - https://your-domain.com/auth/azure/callback
   ```

### 2. Configure Authentication

1. In your app registration, go to **Authentication**
2. Add additional redirect URIs if needed:
   ```
   Production: https://your-domain.com/auth/azure/callback
   Staging: https://staging.your-domain.com/auth/azure/callback
   Development: http://localhost:3002/auth/azure/callback
   ```
3. Configure **Implicit grant and hybrid flows**: Enable **ID tokens**
4. Set **Supported account types**: Single tenant (recommended)

### 3. Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Azure DevOps** (or Visual Studio Team Services)
3. Add required permissions:
   ```
   Delegated permissions:
   - user_impersonation (Access Azure DevOps Services)
   - vso.work_write (Work items - read & write)
   - vso.project (Project and team - read)
   - vso.profile (User profile - read)
   - vso.analytics (Analytics - read)
   ```
4. **Grant admin consent** for the organization

### 4. Create Client Secret

1. Go to **Certificates & secrets** → **Client secrets** → **New client secret**
2. Add description: "RIS Dashboard Backend"
3. Set expiration: 24 months (recommended)
4. **Copy the secret value immediately** - you won't be able to see it again

### 5. Configure Token Configuration (Optional)

1. Go to **Token configuration** → **Add optional claim**
2. Select **ID** and **Access** tokens
3. Add claims: `email`, `name`, `preferred_username`

## Environment Configuration

### 1. Production Environment Setup

```bash
# Copy production template
cp config/production.env.example .env.production

# Edit configuration
nano .env.production
```

### 2. Required Environment Variables

**Azure DevOps Configuration:**
```bash
AZURE_DEVOPS_ORG=your-organization-name
AZURE_DEVOPS_PROJECT=Your Project Name
AZURE_DEVOPS_PAT=your-personal-access-token  # Fallback authentication
```

**OAuth 2.0 Configuration:**
```bash
AZURE_OAUTH_CLIENT_ID=your-azure-ad-app-client-id
AZURE_OAUTH_CLIENT_SECRET=your-azure-ad-app-client-secret
AZURE_OAUTH_REDIRECT_URI=https://your-domain.com/auth/azure/callback
```

**Security Configuration:**
```bash
SESSION_SECRET=your-super-secure-session-secret-at-least-32-characters-long
JWT_SECRET=your-jwt-secret-key-for-token-signing
```

### 3. Database Configuration

**Supabase Setup:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 4. Redis Configuration

```bash
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password
REDIS_KEY_PREFIX=ris:prod:
```

## Database Setup

### 1. Supabase Database Schema

Create required tables and functions:

```sql
-- Create performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  work_item_id INTEGER NOT NULL,
  team_member_id VARCHAR(255) NOT NULL,
  iteration_path VARCHAR(500),
  story_points DECIMAL(5,2),
  completed_date TIMESTAMP,
  cycle_time_hours DECIMAL(10,2),
  lead_time_hours DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_metrics_work_item 
ON performance_metrics(work_item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_metrics_team_member 
ON performance_metrics(team_member_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perf_metrics_iteration 
ON performance_metrics(iteration_path);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (customize based on your needs)
CREATE POLICY "Users can view performance metrics" 
ON performance_metrics FOR SELECT 
USING (auth.role() = 'authenticated');
```

### 2. Database Migration

```bash
# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

## Redis Configuration

### 1. Redis Instance Setup

**Production Redis Configuration:**
```redis
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 2. Redis Security

```bash
# Set Redis password
CONFIG SET requirepass "your-strong-redis-password"

# Disable dangerous commands
CONFIG SET rename-command FLUSHALL ""
CONFIG SET rename-command FLUSHDB ""
CONFIG SET rename-command CONFIG "CONFIG_RENAMED"
```

### 3. Connection Testing

```bash
# Test Redis connection
redis-cli -h your-redis-host -p 6379 -a your-password ping
```

## Security Configuration

### 1. SSL/TLS Certificate

```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# Or configure your load balancer SSL termination
```

### 2. Firewall Rules

```bash
# Allow only necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 6379/tcp  # Redis (internal only)
```

### 3. Security Headers

Configure in your reverse proxy (Nginx example):

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=63072000" always;
add_header Content-Security-Policy "default-src 'self'" always;
```

## Deployment Options

### Option 1: Docker Deployment

#### 1. Build Docker Image

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 nodejs

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["npm", "start"]
```

#### 2. Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass "${REDIS_PASSWORD}"
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
```

#### 3. Deploy with Docker

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app
```

### Option 2: PM2 Deployment

#### 1. Install PM2

```bash
npm install -g pm2
```

#### 2. PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ris-dashboard-backend',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    env_file: '.env.production',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    min_uptime: '10s',
    max_restarts: 10
  }]
};
```

#### 3. Deploy with PM2

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Option 3: Kubernetes Deployment

#### 1. Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ris-dashboard-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ris-dashboard-backend
  template:
    metadata:
      labels:
        app: ris-dashboard-backend
    spec:
      containers:
      - name: backend
        image: your-registry/ris-dashboard-backend:latest
        ports:
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - configMapRef:
            name: ris-config
        - secretRef:
            name: ris-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 10
```

#### 2. Deploy to Kubernetes

```bash
# Apply configurations
kubectl apply -f k8s/

# Check deployment status
kubectl rollout status deployment/ris-dashboard-backend
```

## Monitoring & Logging

### 1. Application Monitoring

**Health Check Endpoint:**
```javascript
// healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3002,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const healthCheck = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  process.exit(res.statusCode === 200 ? 0 : 1);
});

healthCheck.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

healthCheck.on('timeout', () => {
  console.error('Health check timeout');
  process.exit(1);
});

healthCheck.end();
```

### 2. Logging Configuration

**Winston Logger Setup:**
```javascript
// utils/logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ris-dashboard-backend' },
  transports: [
    new DailyRotateFile({
      filename: process.env.LOG_FILE_PATH || './logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d'
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;
```

### 3. Metrics Collection

Install and configure metrics:

```bash
npm install prom-client

# Add to your app
const promClient = require('prom-client');
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });
```

## OAuth Authentication Flow

### 1. User Authentication Process

1. User visits `/auth/azure/login`
2. Application redirects to Azure AD authorization endpoint
3. User authenticates with Azure AD
4. Azure AD redirects back with authorization code
5. Application exchanges code for access token
6. Access token used for Azure DevOps API calls

### 2. Token Management

- **Access tokens** expire every 1 hour
- **Refresh tokens** used for automatic renewal
- Tokens stored securely (encrypted in production)
- Automatic token refresh before expiration

### 3. Testing OAuth Flow

```bash
# Test authorization URL generation
curl -X GET http://localhost:3002/auth/azure/login

# Test token status
curl -X GET "http://localhost:3002/auth/azure/status?userId=test-user"
```

## Performance Optimization

### 1. Caching Strategy

- **Work items**: 5-minute cache
- **Team members**: 30-minute cache  
- **Iterations**: 30-minute cache
- **Metrics**: 5-minute cache

### 2. Database Optimization

```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_work_items_assignee ON work_items(assigned_to);
CREATE INDEX CONCURRENTLY idx_work_items_iteration ON work_items(iteration_path);
CREATE INDEX CONCURRENTLY idx_work_items_state ON work_items(state);
```

### 3. API Rate Limiting

- **Azure DevOps**: 180 requests/minute
- **Application**: 100 requests/15 minutes per IP
- **Authenticated users**: 1000 requests/hour

## Troubleshooting

### Common Issues

#### 1. OAuth Authentication Fails

**Symptoms:**
- Users can't log in
- "Invalid client" errors
- Token exchange failures

**Solutions:**
```bash
# Check Azure AD app configuration
# Verify redirect URIs match exactly
# Ensure client secret hasn't expired
# Check API permissions are granted

# Debug OAuth flow
curl -v -X POST https://app.vssps.visualstudio.com/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&grant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI"
```

#### 2. Azure DevOps API Errors

**Symptoms:**
- 401 Unauthorized errors
- 403 Forbidden errors
- Rate limit exceeded

**Solutions:**
```bash
# Test PAT token
curl -u ":YOUR_PAT" https://dev.azure.com/ORG/_apis/projects

# Check token permissions
curl -H "Authorization: Bearer YOUR_OAUTH_TOKEN" \
  https://dev.azure.com/ORG/_apis/projects

# Monitor rate limits
grep "rate limit" /var/log/ris-dashboard/app.log
```

#### 3. Database Connection Issues

**Solutions:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT NOW();"

# Check connection pool
curl http://localhost:3002/health
```

#### 4. Redis Connection Issues

**Solutions:**
```bash
# Test Redis connection
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping

# Check Redis memory usage
redis-cli -h $REDIS_HOST info memory
```

### Debugging Commands

```bash
# View application logs
tail -f /var/log/ris-dashboard/app.log | jq .

# Monitor system resources
htop
df -h
free -m

# Check network connectivity
netstat -tulnp | grep :3002
ss -tulnp | grep :3002

# Test API endpoints
curl -H "Content-Type: application/json" \
  http://localhost:3002/health

# Monitor database queries
tail -f /var/log/postgresql/postgresql-*.log
```

### Performance Monitoring

```bash
# Application metrics
curl http://localhost:3002/metrics

# System performance
iostat -x 1
vmstat 1
sar -u 1

# Memory usage
ps aux --sort=-%mem | head -20
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review logs for errors and performance issues
2. **Monthly**: Update dependencies and security patches
3. **Quarterly**: Review and rotate secrets (OAuth client secret, JWT secret)
4. **As needed**: Scale resources based on usage patterns

### Support Contacts

- **Technical Issues**: Your development team
- **Azure DevOps**: Your Azure DevOps administrator
- **Infrastructure**: Your DevOps/Platform team

### Documentation Updates

Keep this deployment guide updated with:
- Environment changes
- New features and configurations
- Security updates and requirements
- Performance optimizations and scaling decisions
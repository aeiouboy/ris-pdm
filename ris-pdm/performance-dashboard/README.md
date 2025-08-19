# Performance Dashboard - Database Schema Implementation

## Overview

This is the database schema implementation for the RIS Performance Dashboard project, designed to track and analyze team performance metrics from Azure DevOps.

## Database Architecture

### Tables

#### 1. `performance_metrics`
Stores aggregated performance metrics by product and sprint.

**Key Features:**
- Product and sprint-based metrics
- DORA metrics (velocity, cycle time, deployment frequency, etc.)
- Team satisfaction scores
- Automatic timestamp management

#### 2. `individual_performance`
Tracks individual team member performance metrics.

**Key Features:**
- User-specific performance tracking
- Quality and productivity scores
- Collaboration metrics
- Sprint-based data

#### 3. `work_items_cache`
Caches Azure DevOps work items for fast queries and historical tracking.

**Key Features:**
- Complete Azure DevOps data synchronization
- JSONB storage for flexible data
- Calculated cycle and lead times
- Comprehensive indexing

### Views

- `v_latest_individual_performance` - Latest performance metrics per user
- `v_active_work_items` - Currently active work items with metrics
- `v_completed_work_items` - Completed items with performance calculations

## Setup Instructions

### Prerequisites

- Node.js 16+ 
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose (recommended)

### Quick Start with Docker

1. **Clone and setup:**
```bash
cd performance-dashboard
cp backend/.env.example backend/.env
# Edit .env with your configuration
```

2. **Start all services:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

3. **Run migrations:**
```bash
docker-compose exec backend npm run migrate:setup
```

4. **Access services:**
- Backend API: http://localhost:3001
- Frontend: http://localhost:3000
- pgAdmin: http://localhost:5050 (admin@dashboard.local / admin)
- RedisInsight: http://localhost:8001

### Manual Setup

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Setup environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Setup databases:**
```bash
# PostgreSQL
createdb performance_dashboard

# Start Redis
redis-server
```

4. **Run migrations:**
```bash
npm run migrate:setup
```

## Migration Commands

```bash
# Run all pending migrations
npm run migrate:up

# Check migration status  
npm run migrate:status

# Reset database and run migrations
npm run migrate:reset

# Run seed data (test data)
npm run migrate:seed

# Check database health
npm run db:health
```

## Database Configuration

### PostgreSQL Settings

```javascript
{
  host: 'localhost',
  port: 5432,
  database: 'performance_dashboard',
  user: 'postgres',
  password: 'password',
  // Connection pool settings
  max: 20,           // Maximum connections
  min: 5,            // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
}
```

### Redis Configuration

```javascript
{
  host: 'localhost',
  port: 6379,
  db: 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3
}
```

## Performance Optimizations

### Indexes Created

- **Performance Metrics:** Product/sprint lookups, date-based queries
- **Individual Performance:** User/sprint combinations, score-based sorting  
- **Work Items:** Assignee, iteration, state, and composite indexes
- **Specialized:** GIN indexes for JSONB and arrays, partial indexes for active items

### Caching Strategy

- **Redis TTL:** 5 minutes for real-time data, 1 hour for historical
- **Query Patterns:** Cached by product+sprint+date combinations
- **Invalidation:** Pattern-based cache clearing on data updates

## API Usage Examples

### Database Service

```javascript
const { databaseService } = require('./src/config/database');

// Initialize connections
await databaseService.initialize();

// Execute queries
const metrics = await databaseService.query(
  'SELECT * FROM performance_metrics WHERE product_id = $1',
  ['PRODUCT_A']
);

// Use transactions
await databaseService.transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
});

// Cache operations
await databaseService.setCache('key', data, 300); // 5 min TTL
const cached = await databaseService.getCache('key');
```

### Sample Queries

```sql
-- Get team velocity trends
SELECT 
  sprint_id,
  velocity,
  story_points_completed,
  story_points_committed,
  (story_points_completed::float / story_points_committed * 100) as completion_rate
FROM performance_metrics 
WHERE product_id = 'PRODUCT_A'
ORDER BY metric_date DESC;

-- Individual performance summary
SELECT 
  user_display_name,
  AVG(productivity_score) as avg_productivity,
  AVG(quality_score) as avg_quality,
  SUM(story_points_delivered) as total_points
FROM individual_performance 
WHERE sprint_end_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY user_email, user_display_name
ORDER BY avg_productivity DESC;

-- Active work items by team member
SELECT 
  assignee_display_name,
  COUNT(*) as active_items,
  SUM(story_points) as total_points,
  AVG(EXTRACT(days FROM NOW() - created_date)) as avg_age_days
FROM work_items_cache 
WHERE state NOT IN ('Closed', 'Done', 'Resolved')
GROUP BY assignee_email, assignee_display_name
ORDER BY total_points DESC;
```

## Data Models

### Performance Metrics Schema

```sql
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    sprint_id VARCHAR(100) NOT NULL,
    metric_date DATE NOT NULL,
    velocity INTEGER,
    bugs_created INTEGER DEFAULT 0,
    bugs_resolved INTEGER DEFAULT 0,
    story_points_completed INTEGER DEFAULT 0,
    story_points_committed INTEGER DEFAULT 0,
    team_satisfaction DECIMAL(3,2),
    cycle_time_avg DECIMAL(5,2),
    lead_time_avg DECIMAL(5,2),
    deployment_frequency INTEGER DEFAULT 0,
    change_failure_rate DECIMAL(5,2),
    recovery_time_avg DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Testing

### Seed Data

The system includes comprehensive test data:
- 3 test products (TEST_PRODUCT_A, B, C)
- 4 sprints of historical data
- 12+ team members with realistic metrics
- 12+ work items with various states

### Running Tests

```bash
# Load test data
npm run migrate:seed

# Run API tests (when available)
npm test

# Check data integrity
npm run db:health
```

## Monitoring & Maintenance

### Health Checks

```javascript
// Check all connections
const health = await databaseService.healthCheck();
// Returns: { postgresql: true, redis: true, timestamp: "..." }
```

### Performance Monitoring

- Query logging (configurable via `LOG_QUERIES=true`)
- Connection pool monitoring
- Cache hit/miss ratios
- Automatic retry mechanisms

### Backup Strategy

```bash
# Database backup
pg_dump performance_dashboard > backup.sql

# Redis backup  
redis-cli BGSAVE
```

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Check database credentials in `.env`
   - Verify PostgreSQL/Redis are running
   - Check network connectivity

2. **Migration Failures**
   - Run `npm run migrate:status` to check state
   - Use `npm run migrate:reset` for fresh start
   - Check logs for specific errors

3. **Cache Issues**
   - Verify Redis connection
   - Clear cache: `redis-cli FLUSHDB`
   - Check Redis memory usage

### Debug Mode

```bash
# Enable detailed logging
LOG_LEVEL=debug LOG_QUERIES=true npm run dev

# Check connection status
npm run db:health
```

## Contributing

### Adding New Migrations

1. Create new file: `migrations/00X_description.sql`
2. Follow naming convention: `{version}_{description}.sql`
3. Include rollback scripts in comments
4. Test with `npm run migrate:up`

### Schema Changes

1. Always use migrations for schema changes
2. Include proper indexes for new columns
3. Update seed data if needed
4. Document breaking changes

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | performance_dashboard |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | password |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `CACHE_TTL_SECONDS` | Cache TTL | 300 |
| `LOG_QUERIES` | Enable query logging | false |

## License

MIT License - See LICENSE file for details.

---

**Generated for RIS Performance Dashboard Project**  
*Database Schema Version: 1.0*  
*Last Updated: July 22, 2025*
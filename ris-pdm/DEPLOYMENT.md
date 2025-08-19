# RIS Performance Dashboard - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the RIS Performance Dashboard to production environments using Docker containers and cloud platforms.

## Architecture

The application consists of:
- **Frontend**: React.js application served by Nginx
- **Backend**: Node.js API server with real-time features
- **Database**: PostgreSQL for persistent data
- **Cache**: Redis for session storage and caching
- **Monitoring**: Prometheus, Grafana, and Loki stack

## Prerequisites

### Required Software
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- Azure CLI or AWS CLI (for cloud deployment)

### Required Resources
- **Minimum**: 4 CPU cores, 8GB RAM, 50GB storage
- **Recommended**: 8 CPU cores, 16GB RAM, 100GB SSD storage
- **Production**: Auto-scaling group with load balancer

## Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd ris-pdm
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.production.example .env.production

# Edit configuration
nano .env.production
```

Required environment variables:
```env
# Azure DevOps Configuration
AZURE_DEVOPS_ORG=your-organization
AZURE_DEVOPS_PROJECT=your-project
AZURE_DEVOPS_PAT=your-personal-access-token

# Database Configuration
POSTGRES_DB=ris_dashboard
POSTGRES_USER=ris_user
POSTGRES_PASSWORD=secure_password_here

# Redis Configuration
REDIS_PASSWORD=secure_redis_password

# SSL Configuration (for production)
DOMAIN=ris-dashboard.com
EMAIL=admin@ris-dashboard.com
```

### 3. Setup SSL Certificates
```bash
# For production with Let's Encrypt
./security/ssl-setup.sh prod

# For development with self-signed certificates
./security/ssl-setup.sh dev
```

### 4. Deploy Application
```bash
# Production deployment
docker-compose -f docker-compose.yml up -d

# With monitoring stack
docker-compose -f docker-compose.yml --profile monitoring up -d

# Development deployment
docker-compose -f docker-compose.dev.yml up -d
```

## Deployment Options

### Option 1: Docker Compose (Recommended for single server)

#### Production Deployment
```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend frontend
```

#### With Database
```bash
# Start with database
docker-compose -f docker-compose.yml -f database/docker-compose.db.yml up -d

# Run database migrations
docker-compose --profile migrate up db-migrate

# Start backup service
docker-compose --profile with-backup up -d db-backup
```

### Option 2: Azure App Service

#### Deploy using Azure CLI
```bash
# Login to Azure
az login

# Create resource group
az group create --name ris-dashboard-rg --location "East US"

# Deploy infrastructure
az deployment group create \
  --resource-group ris-dashboard-rg \
  --template-file deploy/azure/app-service.bicep \
  --parameters @deploy/azure/parameters.json
```

#### Using GitHub Actions
1. Fork the repository
2. Add secrets to GitHub repository:
   - `AZURE_WEBAPP_PUBLISH_PROFILE_PRODUCTION`
   - `AZURE_WEBAPP_PUBLISH_PROFILE_STAGING`
3. Push to `main` branch to deploy to production
4. Push to `develop` branch to deploy to staging

### Option 3: AWS ECS Fargate

#### Deploy using CloudFormation
```bash
# Deploy infrastructure
aws cloudformation create-stack \
  --stack-name ris-dashboard \
  --template-body file://deploy/aws/ecs-fargate.yml \
  --parameters ParameterKey=VpcId,ParameterValue=vpc-12345 \
              ParameterKey=SubnetIds,ParameterValue="subnet-12345,subnet-67890" \
              ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:region:account:certificate/cert-id

# Check deployment status
aws cloudformation describe-stacks --stack-name ris-dashboard
```

### Option 4: Kubernetes

#### Deploy to Kubernetes cluster
```bash
# Create namespace
kubectl apply -f deploy/k8s/namespace.yaml

# Apply configurations
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/secrets.yaml

# Deploy services
kubectl apply -f deploy/k8s/redis.yaml
kubectl apply -f deploy/k8s/backend.yaml
kubectl apply -f deploy/k8s/frontend.yaml
kubectl apply -f deploy/k8s/ingress.yaml

# Check deployment status
kubectl get pods -n ris-dashboard
kubectl get services -n ris-dashboard
```

## Configuration

### Environment Variables

#### Backend Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | development | ✓ |
| `PORT` | Server port | 3001 | ✓ |
| `AZURE_DEVOPS_ORG` | Azure DevOps organization | - | ✓ |
| `AZURE_DEVOPS_PROJECT` | Azure DevOps project | - | ✓ |
| `AZURE_DEVOPS_PAT` | Personal access token | - | ✓ |
| `DATABASE_URL` | PostgreSQL connection string | - | ✓ |
| `REDIS_URL` | Redis connection string | - | ✓ |
| `CORS_ORIGIN` | Allowed CORS origins | localhost | ✓ |

#### Frontend Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_BASE_URL` | Backend API URL | http://localhost:3001 | ✓ |
| `VITE_WS_URL` | WebSocket URL | ws://localhost:3001 | ✓ |

### SSL/TLS Configuration

#### Production Setup with Let's Encrypt
```bash
# Generate certificates
./security/ssl-setup.sh prod

# Verify certificates
./security/ssl-setup.sh verify

# Setup auto-renewal
crontab -e
# Add: 0 */12 * * * /path/to/project/scripts/renew-ssl.sh
```

#### Development Setup
```bash
# Generate self-signed certificates
./security/ssl-setup.sh dev
```

## Monitoring and Logging

### Enable Monitoring Stack
```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Access monitoring interfaces
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090
# Loki: http://localhost:3100
```

### Log Management
```bash
# View application logs
docker-compose logs -f backend frontend

# View system logs
docker-compose logs -f nginx redis

# Access log files
docker-compose exec backend tail -f /app/logs/combined.log
```

### Health Checks
```bash
# Check service health
curl http://localhost/health
curl http://localhost:3001/health

# Check individual services
docker-compose ps
docker-compose exec backend curl http://localhost:3001/health
```

## Database Management

### Backup and Restore
```bash
# Manual backup
docker-compose exec db-backup /scripts/backup-scheduler.sh backup

# Restore from backup
docker-compose exec db-backup /scripts/backup-scheduler.sh restore /backups/backup_file.sql.gz

# List available backups
docker-compose exec db-backup /scripts/backup-scheduler.sh list
```

### Migrations
```bash
# Run migrations
docker-compose --profile migrate up db-migrate

# Check migration status
docker-compose exec backend npm run migrate:status
```

## Security

### Security Checklist
- [ ] SSL/TLS certificates configured
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] Redis password set
- [ ] Network policies applied
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Audit logging enabled

### Security Hardening
```bash
# Apply security policies (Kubernetes)
kubectl apply -f security/security-policy.yml

# Enable firewall rules
# Configure your firewall to allow only:
# - Port 80 (HTTP - redirects to HTTPS)
# - Port 443 (HTTPS)
# - Port 22 (SSH - from specific IPs only)
```

## Performance Optimization

### Scaling Guidelines

#### Horizontal Scaling
```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Kubernetes auto-scaling
kubectl autoscale deployment backend --cpu-percent=70 --min=3 --max=10
```

#### Resource Limits
```yaml
# Docker Compose resource limits
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
    reservations:
      memory: 512M
      cpus: '0.25'
```

### Cache Configuration
```bash
# Optimize Redis configuration
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
docker-compose exec redis redis-cli CONFIG SET maxmemory 256mb
```

## Troubleshooting

### Common Issues

#### Backend Service Won't Start
```bash
# Check logs
docker-compose logs backend

# Common causes:
# 1. Invalid Azure DevOps credentials
# 2. Database connection failure
# 3. Redis connection failure
# 4. Port conflicts
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready

# Test connection
docker-compose exec backend npm run test:db

# Reset database
docker-compose down -v
docker-compose up -d
```

#### SSL Certificate Issues
```bash
# Verify certificates
./security/ssl-setup.sh verify

# Regenerate certificates
./security/ssl-setup.sh prod

# Check nginx configuration
docker-compose exec nginx nginx -t
```

### Log Analysis
```bash
# Search for errors
docker-compose logs backend | grep ERROR

# Monitor real-time logs
docker-compose logs -f --tail=100 backend

# Export logs for analysis
docker-compose logs backend > backend.log
```

## Backup and Recovery

### Automated Backups
- Database backups run daily at 2 AM UTC
- Retention period: 30 days
- Backup location: `/backups` volume
- Notification: Slack/Email on failure

### Disaster Recovery
1. **Data Loss**: Restore from latest backup
2. **Service Outage**: Failover to backup region
3. **Complete Failure**: Rebuild from infrastructure code

### Recovery Procedures
```bash
# 1. Stop services
docker-compose down

# 2. Restore database
docker-compose --profile migrate up db-migrate
./database/scripts/backup-scheduler.sh restore /backups/latest.sql.gz

# 3. Restart services
docker-compose up -d

# 4. Verify operation
curl http://localhost/health
```

## Maintenance

### Regular Maintenance Tasks
- [ ] Update Docker images monthly
- [ ] Rotate credentials quarterly
- [ ] Review logs weekly
- [ ] Update dependencies monthly
- [ ] Security scan weekly
- [ ] Performance review monthly

### Update Procedures
```bash
# 1. Backup current state
docker-compose exec db-backup /scripts/backup-scheduler.sh backup

# 2. Pull latest images
docker-compose pull

# 3. Rolling update
docker-compose up -d --force-recreate --no-deps backend
docker-compose up -d --force-recreate --no-deps frontend

# 4. Verify health
curl http://localhost/health
```

## Support

### Getting Help
- **Documentation**: Check this guide and README files
- **Logs**: Review application and system logs
- **Health Checks**: Verify all services are healthy
- **Monitoring**: Check Grafana dashboards for metrics

### Escalation
1. Check application logs and health endpoints
2. Review monitoring dashboards
3. Consult troubleshooting section
4. Contact development team with logs and error details

---

## Appendix

### Useful Commands
```bash
# View all containers
docker-compose ps

# View container resource usage
docker stats

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# View container logs
docker-compose logs -f SERVICE_NAME

# Restart specific service
docker-compose restart SERVICE_NAME

# Update and restart all services
docker-compose pull && docker-compose up -d
```

### Port Reference
| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Frontend | 80 | HTTP | Web interface |
| Frontend | 443 | HTTPS | Secure web interface |
| Backend | 3001 | HTTP | API server |
| Database | 5432 | TCP | PostgreSQL |
| Redis | 6379 | TCP | Cache server |
| Prometheus | 9090 | HTTP | Metrics collection |
| Grafana | 3000 | HTTP | Monitoring dashboard |

For additional help, refer to the project's README.md and API documentation.
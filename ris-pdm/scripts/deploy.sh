#!/bin/bash

# RIS Performance Dashboard Deployment Script
# This script automates the deployment process

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_DIR}/.env.production"
DEPLOYMENT_TYPE="${1:-docker-compose}"
ENVIRONMENT="${2:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to setup environment
setup_environment() {
    log_info "Setting up environment for $ENVIRONMENT..."
    
    # Copy environment file if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "${PROJECT_DIR}/.env.${ENVIRONMENT}" ]; then
            cp "${PROJECT_DIR}/.env.${ENVIRONMENT}" "$ENV_FILE"
            log_info "Copied .env.${ENVIRONMENT} to .env.production"
        else
            log_warning "Environment file not found. Please create $ENV_FILE"
            return 1
        fi
    fi
    
    # Source environment file
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
        log_success "Environment variables loaded"
    else
        log_error "Environment file $ENV_FILE not found"
        return 1
    fi
}

# Function to setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        if [ -n "$DOMAIN" ]; then
            "${PROJECT_DIR}/security/ssl-setup.sh" prod
            log_success "Production SSL certificates configured"
        else
            log_warning "DOMAIN not set, skipping SSL setup"
        fi
    else
        "${PROJECT_DIR}/security/ssl-setup.sh" dev
        log_success "Development SSL certificates configured"
    fi
}

# Function to create required directories
create_directories() {
    log_info "Creating required directories..."
    
    mkdir -p "${PROJECT_DIR}/data/postgres"
    mkdir -p "${PROJECT_DIR}/data/redis"
    mkdir -p "${PROJECT_DIR}/logs"
    mkdir -p "${PROJECT_DIR}/database/backups"
    
    # Set proper permissions
    chmod 755 "${PROJECT_DIR}/data"
    chmod 755 "${PROJECT_DIR}/logs"
    
    log_success "Directories created"
}

# Function to deploy with Docker Compose
deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest images
    log_info "Pulling latest Docker images..."
    docker-compose pull
    
    # Start database first
    log_info "Starting database services..."
    docker-compose -f docker-compose.yml -f database/docker-compose.db.yml up -d postgres redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker-compose exec -T postgres pg_isready -U "${POSTGRES_USER:-ris_user}" -d "${POSTGRES_DB:-ris_dashboard}" &> /dev/null; then
            break
        fi
        sleep 2
        ((timeout--))
    done
    
    if [ $timeout -eq 0 ]; then
        log_error "Database failed to start within timeout"
        return 1
    fi
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose --profile migrate up db-migrate
    
    # Start application services
    log_info "Starting application services..."
    docker-compose up -d
    
    # Start monitoring if requested
    if [ "$WITH_MONITORING" = "true" ]; then
        log_info "Starting monitoring stack..."
        docker-compose --profile monitoring up -d
    fi
    
    # Start backup service if requested
    if [ "$WITH_BACKUP" = "true" ]; then
        log_info "Starting backup service..."
        docker-compose --profile with-backup up -d
    fi
    
    log_success "Docker Compose deployment completed"
}

# Function to deploy to Kubernetes
deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Apply Kubernetes manifests
    log_info "Applying Kubernetes manifests..."
    kubectl apply -f deploy/k8s/namespace.yaml
    kubectl apply -f deploy/k8s/configmap.yaml
    kubectl apply -f deploy/k8s/secrets.yaml
    kubectl apply -f deploy/k8s/redis.yaml
    kubectl apply -f deploy/k8s/backend.yaml
    kubectl apply -f deploy/k8s/frontend.yaml
    kubectl apply -f deploy/k8s/ingress.yaml
    
    # Wait for deployments
    log_info "Waiting for deployments to be ready..."
    kubectl rollout status deployment/backend -n ris-dashboard --timeout=300s
    kubectl rollout status deployment/frontend -n ris-dashboard --timeout=300s
    
    log_success "Kubernetes deployment completed"
}

# Function to deploy to Azure
deploy_azure() {
    log_info "Deploying to Azure App Service..."
    
    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed or not in PATH"
        return 1
    fi
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure. Please run 'az login'"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Deploy infrastructure
    log_info "Deploying Azure infrastructure..."
    az deployment group create \
        --resource-group "${AZURE_RESOURCE_GROUP:-ris-dashboard-rg}" \
        --template-file deploy/azure/app-service.bicep \
        --parameters @deploy/azure/parameters.json
    
    log_success "Azure deployment completed"
}

# Function to deploy to AWS
deploy_aws() {
    log_info "Deploying to AWS ECS..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # Deploy CloudFormation stack
    log_info "Deploying AWS infrastructure..."
    aws cloudformation create-stack \
        --stack-name "${AWS_STACK_NAME:-ris-dashboard}" \
        --template-body file://deploy/aws/ecs-fargate.yml \
        --parameters file://deploy/aws/parameters.json \
        --capabilities CAPABILITY_IAM
    
    log_success "AWS deployment completed"
}

# Function to verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            # Check if containers are running
            if docker-compose ps | grep -q "Up"; then
                log_success "Containers are running"
            else
                log_error "Some containers are not running"
                docker-compose ps
                return 1
            fi
            
            # Health check
            sleep 30  # Wait for services to fully start
            if curl -f http://localhost/health &> /dev/null; then
                log_success "Health check passed"
            else
                log_error "Health check failed"
                return 1
            fi
            ;;
        "kubernetes")
            # Check if pods are ready
            if kubectl get pods -n ris-dashboard | grep -q "Running"; then
                log_success "Pods are running"
            else
                log_error "Some pods are not running"
                kubectl get pods -n ris-dashboard
                return 1
            fi
            ;;
        *)
            log_info "Manual verification required for $DEPLOYMENT_TYPE"
            ;;
    esac
}

# Function to display deployment information
show_deployment_info() {
    log_info "Deployment Information:"
    echo "=========================="
    echo "Environment: $ENVIRONMENT"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    echo "Project Directory: $PROJECT_DIR"
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            echo ""
            echo "Services:"
            docker-compose ps
            echo ""
            echo "Access URLs:"
            echo "  Frontend: http://localhost (or https://localhost if SSL enabled)"
            echo "  Backend API: http://localhost:3001"
            echo "  Backend Health: http://localhost/health"
            if [ "$WITH_MONITORING" = "true" ]; then
                echo "  Grafana: http://localhost:3000"
                echo "  Prometheus: http://localhost:9090"
            fi
            ;;
        "kubernetes")
            echo ""
            echo "Kubernetes Resources:"
            kubectl get all -n ris-dashboard
            echo ""
            echo "Access via Ingress controller or LoadBalancer"
            ;;
    esac
    
    echo ""
    echo "Logs:"
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            echo "  docker-compose logs -f [service_name]"
            ;;
        "kubernetes")
            echo "  kubectl logs -f deployment/backend -n ris-dashboard"
            echo "  kubectl logs -f deployment/frontend -n ris-dashboard"
            ;;
    esac
}

# Function to cleanup on error
cleanup_on_error() {
    log_error "Deployment failed. Cleaning up..."
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            docker-compose down || true
            ;;
        "kubernetes")
            kubectl delete namespace ris-dashboard || true
            ;;
    esac
}

# Main deployment function
main() {
    log_info "Starting RIS Performance Dashboard deployment..."
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    log_info "Environment: $ENVIRONMENT"
    
    # Trap errors
    trap cleanup_on_error ERR
    
    # Run deployment steps
    check_prerequisites
    setup_environment
    create_directories
    
    if [ "$SKIP_SSL" != "true" ]; then
        setup_ssl
    fi
    
    case $DEPLOYMENT_TYPE in
        "docker-compose"|"compose")
            deploy_docker_compose
            ;;
        "kubernetes"|"k8s")
            deploy_kubernetes
            ;;
        "azure")
            deploy_azure
            ;;
        "aws")
            deploy_aws
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            log_info "Supported types: docker-compose, kubernetes, azure, aws"
            exit 1
            ;;
    esac
    
    verify_deployment
    show_deployment_info
    
    log_success "Deployment completed successfully!"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [DEPLOYMENT_TYPE] [ENVIRONMENT] [OPTIONS]

DEPLOYMENT_TYPE:
  docker-compose  Deploy using Docker Compose (default)
  kubernetes      Deploy to Kubernetes cluster
  azure           Deploy to Azure App Service
  aws             Deploy to AWS ECS

ENVIRONMENT:
  development     Development environment
  staging         Staging environment  
  production      Production environment (default)

OPTIONS:
  --with-monitoring   Enable monitoring stack (Grafana, Prometheus)
  --with-backup      Enable automated database backups
  --skip-ssl         Skip SSL certificate setup
  --help             Show this help message

Examples:
  $0                                    # Docker Compose production deployment
  $0 docker-compose development        # Docker Compose development
  $0 kubernetes production             # Kubernetes production
  $0 azure production --with-monitoring # Azure with monitoring

Environment Variables:
  WITH_MONITORING=true    Enable monitoring stack
  WITH_BACKUP=true       Enable backup service
  SKIP_SSL=true          Skip SSL setup
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-monitoring)
            export WITH_MONITORING=true
            shift
            ;;
        --with-backup)
            export WITH_BACKUP=true
            shift
            ;;
        --skip-ssl)
            export SKIP_SSL=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            if [ -z "$DEPLOYMENT_TYPE" ] || [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
                DEPLOYMENT_TYPE="$1"
            elif [ -z "$ENVIRONMENT" ] || [ "$ENVIRONMENT" = "production" ]; then
                ENVIRONMENT="$1"
            fi
            shift
            ;;
    esac
done

# Run main function
main "$@"
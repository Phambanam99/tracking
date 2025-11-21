#!/bin/bash
# Production Deployment Script for Linux/Mac
# This script helps deploy the tracking application to production

set -e

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE="${ENV_FILE:-.env.production.local}"
PROJECT_NAME="tracking-prod"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
echo -e "${BLUE}ℹ️ $1${NC}"
}

success() {
echo -e "${GREEN}✅ $1${NC}"
}

error() {
echo -e "${RED}❌ $1${NC}"
}

warning() {
echo -e "${YELLOW}⚠️ $1${NC}"
}

# Check if Docker is running
check_docker() {
if ! docker version &> /dev/null; then
error "Docker is not running. Please start Docker."
exit 1
fi
}

# Check if env file exists
check_env_file() {
if [ ! -f "$ENV_FILE" ]; then
error "Environment file '$ENV_FILE' not found!"

if [ -f ".env.production" ]; then
info "Creating from template..."
cp .env.production "$ENV_FILE"
success "Created $ENV_FILE from template"
warning "Please edit $ENV_FILE with your production values before deploying!"
exit 1
else
error "Template .env.production not found!"
exit 1
fi
fi
}

# Validate environment configuration
validate_config() {
info "Validating environment configuration..."

local warnings=0

# Check for default/insecure values
if grep -q "JWT_SECRET=your-super-secret" "$ENV_FILE"; then
warning "JWT_SECRET is using default value - MUST be changed!"
((warnings++))
fi

if grep -q "REDIS_PASSWORD=changeme" "$ENV_FILE"; then
warning "REDIS_PASSWORD is using default value - should be changed!"
((warnings++))
fi

if grep -q "POSTGRES_PASSWORD=Phamnam99" "$ENV_FILE"; then
warning "Using development database password - verify this is correct!"
((warnings++))
fi

if [ $warnings -gt 0 ]; then
echo ""
read -p "Continue anyway? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
info "Deployment cancelled. Please update $ENV_FILE"
exit 1
fi
fi
}

# Build Docker images
build_images() {
info "Building Docker images..."

docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" build --no-cache

success "Docker images built successfully"
}

# Start services
start_services() {
info "Starting production services..."

docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "$PROJECT_NAME" up -d

success "Services started successfully"

info "Waiting for services to be healthy..."
sleep 10

show_status

echo ""
success "🎉 Deployment complete!"
info "Backend API: http://localhost:3001"
info "Frontend: http://localhost:4000"
echo ""
info "View logs: ./deploy-production.sh logs"
}

# Stop services
stop_services() {
info "Stopping production services..."

docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down

success "Services stopped successfully"
}

# Restart services
restart_services() {
info "Restarting production services..."

docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" restart

success "Services restarted successfully"
}

# Show logs
show_logs() {
info "Showing service logs (Ctrl+C to exit)..."

docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f --tail=100
}

# Show status
show_status() {
info "Service status:"
echo ""

docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps

echo ""
info "Health checks:"

# Check backend
if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
success "Backend: Healthy"
else
error "Backend: Unhealthy or not responding"
fi

# Check frontend
if curl -sf http://localhost:4000 > /dev/null 2>&1; then
success "Frontend: Healthy"
else
error "Frontend: Unhealthy or not responding"
fi
}

# Update deployment
update_deployment() {
info "Updating deployment..."

# Pull latest code
info "Pulling latest code from git..."
git pull || warning "Git pull failed or no changes"

# Rebuild and restart
build_images
stop_services
start_services
}

# Show usage
usage() {
echo "Usage: $0 [command]"
echo ""
echo "Commands:"
echo " build - Build Docker images"
echo " start - Build and start services (default)"
echo " stop - Stop all services"
echo " restart - Restart services"
echo " logs - Show service logs"
echo " status - Show service status"
echo " update - Pull code, rebuild, and restart"
echo " help - Show this help message"
echo ""
echo "Environment:"
echo " ENV_FILE - Path to environment file (default: .env.production.local)"
echo ""
echo "Examples:"
echo " $0 start"
echo " ENV_FILE=.env.prod $0 start"
echo " $0 logs"
}

# Main execution
main() {
echo -e "${BLUE}🚀 Tracking Application - Production Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Parse command
COMMAND="${1:-start}"

# Pre-flight checks
check_docker

if [ "$COMMAND" != "help" ] && [ "$COMMAND" != "logs" ] && [ "$COMMAND" != "status" ]; then
check_env_file
validate_config
fi

# Execute command
case "$COMMAND" in
build)
build_images
;;
start)
build_images
start_services
;;
stop)
stop_services
;;
restart)
restart_services
;;
logs)
show_logs
;;
status)
show_status
;;
update)
update_deployment
;;
help)
usage
;;
*)
error "Unknown command: $COMMAND"
echo ""
usage
exit 1
;;
esac
}

# Run main
main "$@"
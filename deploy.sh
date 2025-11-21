#!/bin/bash

# Production Deployment Script for Tracking Application
# This script handles the complete deployment process

set -e # Exit on error

echo "🚀 Starting production deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
echo -e "${RED}❌ Error: .env.prod file not found!${NC}"
echo -e "${YELLOW}Please copy .env.prod.example to .env.prod and configure it${NC}"
exit 1
fi

# Load environment variables
export $(cat .env.prod | grep -v '^#' | xargs)

echo -e "${GREEN}✓ Environment variables loaded${NC}"

# Create necessary directories
echo "📁 Creating data directories..."
mkdir -p data/postgres data/redis data/uploads data/logs backups
chmod 755 data/postgres data/redis data/uploads data/logs backups

echo -e "${GREEN}✓ Directories created${NC}"

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

echo -e "${GREEN}✓ Containers stopped${NC}"

# Build images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo -e "${GREEN}✓ Images built${NC}"

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✓ Services started${NC}"

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

echo -e "${GREEN}✓ Migrations completed${NC}"

# Optional: Run database seed (uncomment if needed)
# echo "🌱 Seeding database..."
# docker-compose -f docker-compose.prod.yml exec -T backend npm run seed

# Show status
echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.prod.yml ps

# Show logs
echo ""
echo "📝 Recent Logs (last 50 lines):"
docker-compose -f docker-compose.prod.yml logs --tail=50

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "🌐 Application URLs:"
echo " Frontend: http://localhost:${FRONTEND_PORT:-4000}"
echo " Backend API: http://localhost:${BACKEND_PORT:-3001}"
echo " API Docs: http://localhost:${BACKEND_PORT:-3001}/api"
echo ""
echo "📊 Monitoring:"
echo " View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo " Check status: docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "🛑 To stop:"
echo " docker-compose -f docker-compose.prod.yml down"
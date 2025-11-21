#!/bin/bash

# Script to deploy tracking application in production

set -e

echo "🚀 Starting Tracking System Production Deployment..."

# Create necessary directories
echo "📁 Creating data directories..."
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p data/uploads
mkdir -p data/logs
mkdir -p data/nginx-logs
mkdir -p nginx/ssl
mkdir -p nginx/certbot

# Check if .env.production file exists for backend
if [ ! -f backend/.env.production ]; then
    echo "⚠️  backend/.env.production file not found!"
    echo "Creating from backend/.env..."
    cp backend/.env backend/.env.production
    echo "⚠️  Please review and update backend/.env.production for production settings"
fi

# Build and start services
echo "🏗️  Building Docker images..."
docker compose -f docker-compose.prod.yml build

echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 15

# Check service health
echo "🔍 Checking service health..."
docker compose -f docker-compose.prod.yml ps

# Run database migrations
echo "📊 Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
docker compose -f docker-compose.prod.yml exec -T backend npx prisma generate

echo "✅ Deployment complete!"
echo ""
echo "📍 Your application is now running:"
echo "   - Application: http://localhost"
echo "   - API: http://localhost/api"
echo "   - Swagger Docs: http://localhost/api/docs"
echo "   - WebSocket: ws://localhost/socket.io (namespace: /tracking)"
echo ""
echo "📝 Useful commands:"
echo "   - View logs: docker compose -f docker-compose.prod.yml logs -f"
echo "   - View specific service: docker compose -f docker-compose.prod.yml logs -f nginx"
echo "   - Stop services: docker compose -f docker-compose.prod.yml down"
echo "   - Restart: docker compose -f docker-compose.prod.yml restart"
echo "   - Rebuild: docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "🔐 Security reminder:"
echo "   - Change default passwords in .env files"
echo "   - Setup SSL certificate with: ./setup-ssl.sh yourdomain.com"
echo ""

# Production Deployment Script for Tracking Application (Windows)
# This script handles the complete deployment process on Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting production deployment..." -ForegroundColor Green

# Check if .env.prod exists
if (-not (Test-Path .env.prod)) {
    Write-Host "❌ Error: .env.prod file not found!" -ForegroundColor Red
    Write-Host "Please copy .env.prod.example to .env.prod and configure it" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Environment file found" -ForegroundColor Green

# Create necessary directories
Write-Host "📁 Creating data directories..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path data\postgres, data\redis, data\uploads, data\logs, backups | Out-Null

Write-Host "✓ Directories created" -ForegroundColor Green

# Stop existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml down

Write-Host "✓ Containers stopped" -ForegroundColor Green

# Build images
Write-Host "🔨 Building Docker images..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml build --no-cache

Write-Host "✓ Images built" -ForegroundColor Green

# Start services
Write-Host "🚀 Starting services..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml up -d

Write-Host "✓ Services started" -ForegroundColor Green

# Wait for database to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Run database migrations
Write-Host "🔄 Running database migrations..." -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

Write-Host "✓ Migrations completed" -ForegroundColor Green

# Optional: Run database seed (uncomment if needed)
# Write-Host "🌱 Seeding database..." -ForegroundColor Cyan
# docker-compose -f docker-compose.prod.yml exec -T backend npm run seed

# Show status
Write-Host ""
Write-Host "📊 Container Status:" -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml ps

# Show logs
Write-Host ""
Write-Host "📝 Recent Logs (last 50 lines):" -ForegroundColor Cyan
docker-compose -f docker-compose.prod.yml logs --tail=50

Write-Host ""
Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Application URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:4000"
Write-Host "   Backend API: http://localhost:3001"
Write-Host "   API Docs: http://localhost:3001/api"
Write-Host ""
Write-Host "📊 Monitoring:" -ForegroundColor Cyan
Write-Host "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
Write-Host "   Check status: docker-compose -f docker-compose.prod.yml ps"
Write-Host ""
Write-Host "🛑 To stop:" -ForegroundColor Cyan
Write-Host "   docker-compose -f docker-compose.prod.yml down"

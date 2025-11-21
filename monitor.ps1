# Docker Monitoring Script
# Displays real-time status of all Docker services

$ErrorActionPreference = "Stop"

Write-Host "=== Tracking Application Status ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker ps > $null 2>&1
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    exit 1
}

# Container status
Write-Host "📦 Container Status:" -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml ps
Write-Host ""

# Health checks
Write-Host "💚 Health Checks:" -ForegroundColor Yellow

# Backend health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Backend: Healthy" -ForegroundColor Green
        $json = $response.Content | ConvertFrom-Json
        Write-Host "    - Uptime: $([math]::Round($json.uptime, 2))s" -ForegroundColor Gray
        Write-Host "    - Database: $($json.database)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ Backend: Unhealthy" -ForegroundColor Red
}

# Frontend health
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Frontend: Healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Frontend: Unhealthy" -ForegroundColor Red
}

# Database health
try {
    $result = docker exec tracking-postgis-prod pg_isready -U admin 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Database: Healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Database: Unhealthy" -ForegroundColor Red
}

# Redis health
try {
    $result = docker exec tracking-redis-prod redis-cli -a changeme ping 2>&1
    if ($result -eq "PONG") {
        Write-Host "  ✓ Redis: Healthy" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Redis: Unhealthy" -ForegroundColor Red
}

Write-Host ""

# Resource usage
Write-Host "📊 Resource Usage:" -ForegroundColor Yellow
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | Select-Object -First 10

Write-Host ""

# Disk usage
Write-Host "💾 Disk Usage:" -ForegroundColor Yellow
$pgSize = (Get-ChildItem -Path "data\postgres" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
$redisSize = (Get-ChildItem -Path "data\redis" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
$uploadsSize = (Get-ChildItem -Path "data\uploads" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
$backupsSize = (Get-ChildItem -Path "backups" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host "  PostgreSQL: $([math]::Round($pgSize, 2)) MB" -ForegroundColor Gray
Write-Host "  Redis: $([math]::Round($redisSize, 2)) MB" -ForegroundColor Gray
Write-Host "  Uploads: $([math]::Round($uploadsSize, 2)) MB" -ForegroundColor Gray
Write-Host "  Backups: $([math]::Round($backupsSize, 2)) MB" -ForegroundColor Gray

Write-Host ""
Write-Host "🔄 Last updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

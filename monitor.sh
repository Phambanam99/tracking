#!/bin/bash

# Docker Monitoring Script
# Displays real-time status of all Docker services

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== Tracking Application Status ===${NC}"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
echo -e "${RED}❌ Docker is not running!${NC}"
exit 1
fi

# Container status
echo -e "${YELLOW}📦 Container Status:${NC}"
docker-compose -f docker-compose.prod.yml ps
echo ""

# Health checks
echo -e "${YELLOW}💚 Health Checks:${NC}"

# Backend health
if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
echo -e "${GREEN} ✓ Backend: Healthy${NC}"
UPTIME=$(curl -s http://localhost:3001/api/health | grep -o '"uptime":[^,]*' | cut -d':' -f2)
DB_STATUS=$(curl -s http://localhost:3001/api/health | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
echo -e "${GRAY} - Uptime: ${UPTIME}s${NC}"
echo -e "${GRAY} - Database: ${DB_STATUS}${NC}"
else
echo -e "${RED} ✗ Backend: Unhealthy${NC}"
fi

# Frontend health
if curl -s -f http://localhost:4000 > /dev/null 2>&1; then
echo -e "${GREEN} ✓ Frontend: Healthy${NC}"
else
echo -e "${RED} ✗ Frontend: Unhealthy${NC}"
fi

# Database health
if docker exec tracking-postgis-prod pg_isready -U admin > /dev/null 2>&1; then
echo -e "${GREEN} ✓ Database: Healthy${NC}"
else
echo -e "${RED} ✗ Database: Unhealthy${NC}"
fi

# Redis health
if docker exec tracking-redis-prod redis-cli -a changeme ping 2>&1 | grep -q "PONG"; then
echo -e "${GREEN} ✓ Redis: Healthy${NC}"
else
echo -e "${RED} ✗ Redis: Unhealthy${NC}"
fi

echo ""

# Resource usage
echo -e "${YELLOW}📊 Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | head -10

echo ""

# Disk usage
echo -e "${YELLOW}💾 Disk Usage:${NC}"
if [ -d "data/postgres" ]; then
PG_SIZE=$(du -sh data/postgres 2>/dev/null | cut -f1)
echo -e "${GRAY} PostgreSQL: ${PG_SIZE}${NC}"
fi
if [ -d "data/redis" ]; then
REDIS_SIZE=$(du -sh data/redis 2>/dev/null | cut -f1)
echo -e "${GRAY} Redis: ${REDIS_SIZE}${NC}"
fi
if [ -d "data/uploads" ]; then
UPLOADS_SIZE=$(du -sh data/uploads 2>/dev/null | cut -f1)
echo -e "${GRAY} Uploads: ${UPLOADS_SIZE}${NC}"
fi
if [ -d "backups" ]; then
BACKUPS_SIZE=$(du -sh backups 2>/dev/null | cut -f1)
echo -e "${GRAY} Backups: ${BACKUPS_SIZE}${NC}"
fi

echo ""
echo -e "${GRAY}🔄 Last updated: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
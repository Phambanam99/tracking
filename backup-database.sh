#!/bin/bash

# Database Backup Script for Production
# Run this script to create a backup of your PostgreSQL database

set -e

# Load environment variables
if [ -f .env.prod ]; then
export $(cat .env.prod | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
CONTAINER_NAME="tracking-postgis-prod"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting database backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
docker exec -t ${CONTAINER_NAME} pg_dump -U ${POSTGRES_USER:-admin} -d ${POSTGRES_DB:-tracking} > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
echo -e "${GREEN}✓ Backup created successfully: ${BACKUP_FILE}${NC}"

# Compress the backup
echo -e "${YELLOW}Compressing backup...${NC}"
gzip ${BACKUP_FILE}
echo -e "${GREEN}✓ Backup compressed: ${BACKUP_FILE}.gz${NC}"

# Show backup size
BACKUP_SIZE=$(du -h ${BACKUP_FILE}.gz | cut -f1)
echo -e "${GREEN}Backup size: ${BACKUP_SIZE}${NC}"

# Clean up old backups (keep last 7 days)
echo -e "${YELLOW}Cleaning up old backups...${NC}"
find ${BACKUP_DIR} -name "backup_*.sql.gz" -mtime +7 -delete
echo -e "${GREEN}✓ Old backups cleaned up${NC}"
else
echo -e "${RED}✗ Backup failed!${NC}"
exit 1
fi

echo -e "${GREEN}Backup completed successfully!${NC}"
#!/bin/bash

# Database Backup Script
# Usage: ./backup-database.sh

set -e

# Configuration
DB_NAME="tracking"
DB_USER="postgres"
DB_HOST="localhost"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🗄️ Starting database backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Backing up database: $DB_NAME"
pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}✅ Backup successful${NC}"
echo "File: $BACKUP_FILE"
echo "Size: $SIZE"

# Clean old backups
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Cleaned backups older than $RETENTION_DAYS days"
else
echo -e "${RED}❌ Backup failed${NC}"
exit 1
fi


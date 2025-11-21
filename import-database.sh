#!/bin/bash

# Script to import production database backup

set -e

BACKUP_FILE="production-backups/production_20251121_142820.sql.gz"

echo "🗄️  Database Import Script"
echo "=========================="
echo ""

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "📁 Found backup file: $BACKUP_FILE"
echo "   Size: $(du -h $BACKUP_FILE | cut -f1)"
echo ""

# Check if database container is running
if ! docker ps | grep -q tracking-postgis-prod; then
    echo "⚠️  Database container not running. Starting services..."
    docker compose -f docker-compose.prod.yml up -d db
    echo "⏳ Waiting for database to be ready..."
    sleep 10
fi

echo "🔍 Checking database connection..."
docker compose -f docker-compose.prod.yml exec -T db pg_isready -U admin -d tracking || {
    echo "❌ Database not ready. Please check docker logs"
    exit 1
}

echo "✅ Database is ready"
echo ""

# Confirm before import
read -p "⚠️  This will DROP and recreate the database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Import cancelled"
    exit 0
fi

echo ""
echo "🗑️  Dropping existing database..."
docker compose -f docker-compose.prod.yml exec -T db psql -U admin -d postgres -c "DROP DATABASE IF EXISTS tracking;"

echo "🏗️  Creating fresh database..."
docker compose -f docker-compose.prod.yml exec -T db psql -U admin -d postgres -c "CREATE DATABASE tracking;"

echo "📥 Importing data from backup..."
echo "   This may take several minutes depending on the size..."
gunzip -c "$BACKUP_FILE" | docker compose -f docker-compose.prod.yml exec -T db psql -U admin -d tracking

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Import completed successfully!"
    echo ""
    echo "📊 Database statistics:"
    docker compose -f docker-compose.prod.yml exec -T db psql -U admin -d tracking -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            n_live_tup AS rows
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10;
    "
    echo ""
    echo "🔄 Next steps:"
    echo "   1. Run migrations: docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy"
    echo "   2. Restart backend: docker compose -f docker-compose.prod.yml restart backend"
else
    echo ""
    echo "❌ Import failed! Check the logs above for errors"
    exit 1
fi

# Database Backup Script for Production (Windows)
# Run this script to create a backup of your PostgreSQL database

$ErrorActionPreference = "Stop"

# Load environment variables
if (Test-Path .env.prod) {
    Get-Content .env.prod | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
}

# Configuration
$BACKUP_DIR = ".\backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\backup_$TIMESTAMP.sql"
$CONTAINER_NAME = "tracking-postgis-prod"
$POSTGRES_USER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "admin" }
$POSTGRES_DB = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "tracking" }

Write-Host "Starting database backup..." -ForegroundColor Green

# Create backup directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

# Create backup
Write-Host "Creating backup..." -ForegroundColor Yellow
docker exec -t $CONTAINER_NAME pg_dump -U $POSTGRES_USER -d $POSTGRES_DB | Out-File -FilePath $BACKUP_FILE -Encoding ASCII

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backup created successfully: $BACKUP_FILE" -ForegroundColor Green
    
    # Compress the backup
    Write-Host "Compressing backup..." -ForegroundColor Yellow
    Compress-Archive -Path $BACKUP_FILE -DestinationPath "$BACKUP_FILE.zip" -Force
    Remove-Item $BACKUP_FILE
    Write-Host "✓ Backup compressed: $BACKUP_FILE.zip" -ForegroundColor Green
    
    # Show backup size
    $BACKUP_SIZE = (Get-Item "$BACKUP_FILE.zip").Length / 1MB
    Write-Host "Backup size: $([math]::Round($BACKUP_SIZE, 2)) MB" -ForegroundColor Green
    
    # Clean up old backups (keep last 7 days)
    Write-Host "Cleaning up old backups..." -ForegroundColor Yellow
    Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.zip" | 
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | 
        Remove-Item
    Write-Host "✓ Old backups cleaned up" -ForegroundColor Green
} else {
    Write-Host "✗ Backup failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Backup completed successfully!" -ForegroundColor Green

# Production Deployment Guide

## 📋 Prerequisites

1. **Docker & Docker Compose**: Ensure Docker Desktop or Docker Engine is installed

   - Docker version 20.10 or higher
   - Docker Compose version 2.0 or higher

2. **System Requirements**:
   - Minimum 4GB RAM
   - 20GB free disk space
   - Open ports: 3001 (backend), 4000 (frontend), 5432 (PostgreSQL), 6379 (Redis)

## 🚀 Deployment Steps

### 1. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.prod.example .env.prod

# Edit .env.prod with your production values
# IMPORTANT: Change all passwords and secrets!
```

**Critical settings to update:**

- `POSTGRES_PASSWORD`: Strong database password
- `REDIS_PASSWORD`: Strong Redis password
- `JWT_SECRET`: Minimum 32 characters, cryptographically secure
- `CORS_ORIGIN`: Your production domain
- `NEXT_PUBLIC_API_URL`: Your production API URL
- `NEXT_PUBLIC_WS_URL`: Your production WebSocket URL

### 2. Deploy Using Script

**On Linux/Mac:**

```bash
chmod +x deploy.sh
./deploy.sh
```

**On Windows (PowerShell):**

```powershell
.\deploy.ps1
```

### 3. Manual Deployment (Alternative)

```bash
# Create data directories
mkdir -p data/postgres data/redis data/uploads data/logs backups

# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Optional: Seed initial data
docker-compose -f docker-compose.prod.yml exec backend npm run seed
```

## 📊 Monitoring & Management

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Check Service Status

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Stop Services

```bash
docker-compose -f docker-compose.prod.yml down
```

### Stop and Remove All Data (⚠️ DESTRUCTIVE)

```bash
docker-compose -f docker-compose.prod.yml down -v
```

## 💾 Backup & Recovery

### Create Backup

**Linux/Mac:**

```bash
chmod +x backup-database.sh
./backup-database.sh
```

**Windows:**

```powershell
.\backup-database.ps1
```

Backups are stored in `./backups` directory with automatic 7-day retention.

### Restore Backup

**Linux/Mac:**

```bash
# Extract backup
gunzip backups/backup_YYYYMMDD_HHMMSS.sql.gz

# Restore
docker exec -i tracking-postgis-prod psql -U admin -d tracking < backups/backup_YYYYMMDD_HHMMSS.sql
```

**Windows:**

```powershell
# Extract backup
Expand-Archive backups/backup_YYYYMMDD_HHMMSS.sql.zip

# Restore
Get-Content backups/backup_YYYYMMDD_HHMMSS.sql | docker exec -i tracking-postgis-prod psql -U admin -d tracking
```

## 🔒 Security Best Practices

1. **Change Default Passwords**: Never use default passwords in production
2. **Use Strong Secrets**: Generate JWT_SECRET with cryptographically secure methods
3. **Enable HTTPS**: Use reverse proxy (nginx/traefik) with SSL certificates
4. **Firewall Rules**: Restrict database and Redis ports to localhost only
5. **Regular Updates**: Keep Docker images and dependencies updated
6. **Backup Strategy**: Automate daily backups with off-site storage
7. **Log Monitoring**: Set up centralized logging (ELK stack, CloudWatch, etc.)

## 🌐 Production URLs

After deployment, access your application at:

- **Frontend**: http://localhost:4000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check database health
docker-compose -f docker-compose.prod.yml exec db pg_isready -U admin

# View database logs
docker-compose -f docker-compose.prod.yml logs db
```

### Backend Not Starting

```bash
# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Verify environment variables
docker-compose -f docker-compose.prod.yml exec backend env

# Rebuild backend
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### Redis Connection Issues

```bash
# Check Redis health
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a YOUR_PASSWORD ping

# View Redis logs
docker-compose -f docker-compose.prod.yml logs redis
```

### Performance Issues

```bash
# Check resource usage
docker stats

# View database connections
docker-compose -f docker-compose.prod.yml exec db psql -U admin -d tracking -c "SELECT count(*) FROM pg_stat_activity;"
```

## 📈 Scaling Considerations

1. **Database**: Consider managed PostgreSQL (AWS RDS, Azure Database, etc.)
2. **Redis**: Use Redis Cluster for high availability
3. **Backend**: Scale horizontally with load balancer
4. **Frontend**: Use CDN for static assets
5. **Monitoring**: Implement Prometheus + Grafana for metrics

## 🔄 Updates & Migrations

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Run new migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

## 📦 Data Persistence

All persistent data is stored in the `./data` directory:

- `data/postgres`: PostgreSQL database files
- `data/redis`: Redis persistence files
- `data/uploads`: User uploaded files
- `data/logs`: Application logs

**Backup these directories regularly!**

## 🆘 Support

For issues and questions:

1. Check application logs
2. Review Docker container status
3. Verify environment variables
4. Consult troubleshooting section above

## ⚠️ Important Notes

- Never commit `.env.prod` to version control
- Keep regular backups before major updates
- Test migrations in staging environment first
- Monitor disk space usage regularly
- Set up alerts for service failures

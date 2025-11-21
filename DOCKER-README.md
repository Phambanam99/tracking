# Production Docker Setup - README

## 📁 Project Structure

```
tracking/
├── docker-compose.prod.yml      # Production Docker Compose configuration
├── .env.prod.example            # Example environment variables
├── .env.prod                    # Your production environment (not in git)
├── deploy.sh                    # Linux/Mac deployment script
├── deploy.ps1                   # Windows deployment script
├── backup-database.sh           # Linux/Mac backup script
├── backup-database.ps1          # Windows backup script
├── monitor.sh                   # Linux/Mac monitoring script
├── monitor.ps1                  # Windows monitoring script
├── DEPLOYMENT.md                # Full deployment guide
├── QUICKSTART.md                # Quick start guide
├── backend/
│   ├── Dockerfile               # Backend production Dockerfile
│   ├── .dockerignore            # Backend Docker ignore rules
│   └── ...
├── frontend/
│   ├── Dockerfile               # Frontend production Dockerfile
│   ├── .dockerignore            # Frontend Docker ignore rules
│   └── ...
├── data/                        # Persistent data (not in git)
│   ├── postgres/                # PostgreSQL data
│   ├── redis/                   # Redis data
│   ├── uploads/                 # Uploaded files
│   └── logs/                    # Application logs
└── backups/                     # Database backups (not in git)
```

## 🎯 What's Included

### 1. **Production Docker Compose** (`docker-compose.prod.yml`)

- PostgreSQL 16 with PostGIS extension
- Redis 7 with persistence
- NestJS Backend with health checks
- Next.js Frontend (standalone build)
- Proper networking and volume management
- Health checks for all services
- Resource limits and logging

### 2. **Dockerfiles**

- **Backend**: Multi-stage build, optimized for production
- **Frontend**: Standalone Next.js build, minimal image size
- Both use non-root users for security
- Includes health checks and signal handling

### 3. **Deployment Scripts**

- **deploy.sh / deploy.ps1**: Automated deployment
- Handles directory creation, image building, service startup
- Runs database migrations automatically
- Shows service status and logs

### 4. **Backup Scripts**

- **backup-database.sh / backup-database.ps1**: Database backups
- Automatic compression
- 7-day retention policy
- Timestamped backup files

### 5. **Monitoring Scripts**

- **monitor.sh / monitor.ps1**: Real-time monitoring
- Container health status
- Resource usage (CPU, Memory, Network)
- Disk usage tracking
- Service availability checks

### 6. **Environment Configuration**

- `.env.prod.example`: Template with all required variables
- Secure defaults for production
- CORS configuration
- JWT settings
- Database and Redis credentials

## 🚀 Quick Start

### Option 1: Automated Deployment

**Windows:**

```powershell
# 1. Configure environment
cp .env.prod.example .env.prod
# Edit .env.prod with your values

# 2. Deploy
.\deploy.ps1

# 3. Monitor
.\monitor.ps1
```

**Linux/Mac:**

```bash
# 1. Configure environment
cp .env.prod.example .env.prod
# Edit .env.prod with your values

# 2. Deploy
chmod +x deploy.sh monitor.sh backup-database.sh
./deploy.sh

# 3. Monitor
./monitor.sh
```

### Option 2: Manual Deployment

```bash
# 1. Create directories
mkdir -p data/postgres data/redis data/uploads data/logs backups

# 2. Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# 4. Check status
docker-compose -f docker-compose.prod.yml ps
```

## 🔐 Security Features

1. **Non-root containers**: All services run as non-root users
2. **Environment isolation**: Separate production environment file
3. **Health checks**: Automatic health monitoring
4. **Secure secrets**: Configurable passwords and JWT secrets
5. **CORS protection**: Configurable allowed origins
6. **Network isolation**: Custom Docker network
7. **Rate limiting**: Configured in backend

## 📊 Data Persistence

All data is stored in the `data/` directory:

- **PostgreSQL** (`data/postgres/`): All database data
- **Redis** (`data/redis/`): Cache and session data
- **Uploads** (`data/uploads/`): User-uploaded files
- **Logs** (`data/logs/`): Application logs

**Important**: These directories are bind-mounted, so data persists even when containers are removed.

## 🛠️ Common Operations

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Restart Services

```bash
# All services
docker-compose -f docker-compose.prod.yml restart

# Specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Stop Services

```bash
docker-compose -f docker-compose.prod.yml down
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Run new migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Database Backup

```bash
# Windows
.\backup-database.ps1

# Linux/Mac
./backup-database.sh
```

### Database Restore

```bash
# Windows
Expand-Archive backups/backup_YYYYMMDD_HHMMSS.sql.zip
Get-Content backups/backup_YYYYMMDD_HHMMSS.sql | docker exec -i tracking-postgis-prod psql -U admin -d tracking

# Linux/Mac
gunzip backups/backup_YYYYMMDD_HHMMSS.sql.gz
docker exec -i tracking-postgis-prod psql -U admin -d tracking < backups/backup_YYYYMMDD_HHMMSS.sql
```

## 🔍 Monitoring

### Real-time Monitoring

```bash
# Windows
.\monitor.ps1

# Linux/Mac
./monitor.sh
```

### Resource Usage

```bash
docker stats
```

### Service Status

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Health Checks

```bash
# Backend
curl http://localhost:3001/api/health

# Frontend
curl http://localhost:4000

# Database
docker exec tracking-postgis-prod pg_isready -U admin

# Redis
docker exec tracking-redis-prod redis-cli -a YOUR_PASSWORD ping
```

## 🌐 Access Points

After deployment:

- **Frontend**: http://localhost:4000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs
- **Health Check**: http://localhost:3001/api/health

## 📖 Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Complete deployment guide
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## ⚠️ Important Notes

1. **Never commit `.env.prod`** - It contains sensitive credentials
2. **Backup regularly** - Use the provided backup scripts
3. **Monitor disk space** - Database and uploads can grow large
4. **Update regularly** - Keep Docker images and dependencies updated
5. **Use HTTPS in production** - Set up a reverse proxy (nginx/traefik)
6. **Change default passwords** - Before deploying to production

## 🆘 Troubleshooting

### Containers won't start

```bash
# Check Docker daemon
docker ps

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Remove and recreate
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d --build
```

### Port conflicts

Edit `.env.prod` and change port numbers:

```bash
FRONTEND_PORT=4001
BACKEND_PORT=3002
```

### Database connection issues

```bash
# Check database health
docker exec tracking-postgis-prod pg_isready -U admin

# Check database logs
docker-compose -f docker-compose.prod.yml logs db

# Restart database
docker-compose -f docker-compose.prod.yml restart db
```

### Performance issues

```bash
# Check resource usage
docker stats

# Check database connections
docker exec tracking-postgis-prod psql -U admin -d tracking -c "SELECT count(*) FROM pg_stat_activity;"

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

## 📝 License

This setup is part of the Tracking application project.

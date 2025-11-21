# Production Deployment Guide - Using Existing Database

## 📋 Prerequisites

- Docker and Docker Compose installed
- Existing PostgreSQL database with tracking data
- Database accessible from Docker containers

## 🚀 Quick Start

### 1. Configure Environment Variables

```bash
# Copy the production environment template
cp .env.production .env.production.local

# Edit .env.production.local with your actual values
# IMPORTANT: Update these values!
```

**Critical configurations to update:**

```env
# If database is on host machine
DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public

# If database is on external server
DATABASE_URL=postgresql://admin:Phamnam99@YOUR_DB_HOST:5432/tracking?schema=public

# Security (MUST CHANGE!)
JWT_SECRET=your-super-secret-minimum-32-characters-long
REDIS_PASSWORD=your-strong-redis-password

# URLs (Update to your domain)
NEXT_PUBLIC_API_URL=http://your-domain.com:3001
NEXT_PUBLIC_WS_URL=ws://your-domain.com:3001
CORS_ORIGIN=http://your-domain.com:4000
```

### 2. Build and Deploy

```bash
# Build the Docker images
docker-compose -f docker-compose.production.yml --env-file .env.production.local build

# Start the services
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### 3. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Test backend health
curl http://localhost:3001/api/health

# Test frontend
curl http://localhost:4000
```

## 🔧 Database Connection Scenarios

### Scenario 1: Database on Host Machine (Windows/Mac)

Update `.env.production.local`:

```env
DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public
DIRECT_DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public
```

### Scenario 2: Database on External Server

Update `.env.production.local`:

```env
DATABASE_URL=postgresql://admin:Phamnam99@192.168.1.100:5432/tracking?schema=public
DIRECT_DATABASE_URL=postgresql://admin:Phamnam99@192.168.1.100:5432/tracking?schema=public
```

### Scenario 3: Database in Docker Network

If you want to include the database in Docker:

```bash
# Use docker-compose.prod.yml instead (includes database)
docker-compose -f docker-compose.prod.yml --env-file .env.production.local up -d
```

## 📊 Data Persistence

The following data is persisted in Docker volumes:

- **Redis data**: `redis_data_prod`
- **Uploaded files**: `backend_uploads`
- **Application logs**: `backend_logs`

Your existing database data remains untouched.

## 🔐 Security Checklist

- [ ] Changed JWT_SECRET to a strong random string (min 32 chars)
- [ ] Changed REDIS_PASSWORD to a strong password
- [ ] Updated CORS_ORIGIN to your actual domain
- [ ] Configured firewall rules for ports 3001, 4000
- [ ] Database credentials are secure and not exposed
- [ ] SSL/TLS enabled for production (use reverse proxy)

## 🛠️ Useful Commands

### Start services

```bash
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d
```

### Stop services

```bash
docker-compose -f docker-compose.production.yml down
```

### Restart a service

```bash
docker-compose -f docker-compose.production.yml restart backend
docker-compose -f docker-compose.production.yml restart frontend
```

### View logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f frontend
```

### Update application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d --build
```

### Scale services (if needed)

```bash
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d --scale backend=2
```

## 🔍 Troubleshooting

### Backend can't connect to database

**Error**: `Connection refused` or `ECONNREFUSED`

**Solution**:

1. Check database is running: `docker ps` or `netstat -an | findstr 5432`
2. Verify DATABASE_URL uses correct host:
   - Host machine: `host.docker.internal`
   - External: actual IP address
3. Check firewall allows connection
4. Verify database credentials

### Backend health check failing

```bash
# Check backend logs
docker-compose -f docker-compose.production.yml logs backend

# Check if backend is running
docker exec -it tracking-backend-prod sh
wget -O- http://localhost:3001/api/health
```

### Frontend can't connect to backend

**Error**: Network error or CORS error

**Solution**:

1. Verify NEXT_PUBLIC_API_URL is correct
2. Check CORS_ORIGIN includes frontend URL
3. Ensure backend is healthy: `curl http://localhost:3001/api/health`

### Data migration needed

If you need to run Prisma migrations:

```bash
# Access backend container
docker exec -it tracking-backend-prod sh

# Run migrations
npx prisma migrate deploy

# Or generate Prisma client
npx prisma generate
```

## 🌐 Reverse Proxy Setup (Recommended)

For production, use Nginx or Traefik as reverse proxy:

### Example Nginx Configuration

```nginx
# /etc/nginx/sites-available/tracking
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 📈 Monitoring

### Check resource usage

```bash
docker stats
```

### View container health

```bash
docker-compose -f docker-compose.production.yml ps
```

### Backup logs

```bash
docker-compose -f docker-compose.production.yml logs > logs_$(date +%Y%m%d_%H%M%S).txt
```

## 🔄 Backup Strategy

Your existing database backup strategy continues to work.

For application data:

```bash
# Backup Redis data
docker run --rm -v tracking_redis_data_prod:/data -v $(pwd)/backups:/backup alpine tar czf /backup/redis_$(date +%Y%m%d).tar.gz /data

# Backup uploaded files
docker run --rm -v tracking_backend_uploads:/data -v $(pwd)/backups:/backup alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz /data
```

## 📞 Support

For issues:

1. Check logs: `docker-compose -f docker-compose.production.yml logs`
2. Verify environment variables
3. Test database connectivity
4. Check firewall and network settings

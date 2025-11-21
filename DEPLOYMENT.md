# Production Deployment Guide

## Cấu trúc Nginx

Project đã được cấu hình với Nginx reverse proxy để:
- Routing traffic đến frontend và backend
- SSL/TLS termination
- Rate limiting
- Caching static files
- WebSocket support

## Cách deploy

### 1. Chuẩn bị

```bash
# Tạo các thư mục cần thiết
mkdir -p data/{postgres,redis,uploads,logs,nginx-logs}
mkdir -p nginx/{ssl,certbot}

# Phân quyền
chmod +x deploy.sh
chmod +x setup-ssl.sh
```

### 2. Cấu hình Environment

Chỉnh sửa file `.env` ở root:

```env
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=tracking

# Redis
REDIS_PASSWORD=<strong-password>

# JWT
JWT_SECRET=<generate-with-openssl-rand-base64-32>

# Domain (nếu có)
CORS_ORIGIN=https://yourdomain.com
```

### 3. Deploy

```bash
# Build và start tất cả services
./deploy.sh
```

Services sẽ chạy:
- **Nginx**: ports 80, 443
- **Backend**: internal port 3001 (qua Nginx)
- **Frontend**: internal port 4000 (qua Nginx)
- **PostgreSQL**: port 5432
- **Redis**: port 6379

### 4. Setup SSL (Production)

```bash
# Với domain thật
./setup-ssl.sh yourdomain.com

# Hoặc tự generate self-signed certificate (development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# Enable SSL trong nginx config
sed -i 's/# ssl_certificate/ssl_certificate/g' nginx/conf.d/default.conf
docker compose -f docker-compose.prod.yml restart nginx
```

## Truy cập

- **Frontend**: http://localhost hoặc https://yourdomain.com
- **API**: http://localhost/api
- **Swagger**: http://localhost/api/docs
- **WebSocket**: ws://localhost/socket.io

## Quản lý

### View logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Restart services
```bash
# All
docker compose -f docker-compose.prod.yml restart

# Specific
docker compose -f docker-compose.prod.yml restart nginx
```

### Stop
```bash
docker compose -f docker-compose.prod.yml down
```

### Database backup
```bash
# Backup
docker exec tracking-postgis-prod pg_dump -U admin -d tracking > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i tracking-postgis-prod psql -U admin -d tracking < backup_20250121.sql
```

### Update application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

## Nginx Configuration

### Rate Limiting
- API: 10 requests/second
- Login: 5 requests/minute

### Caching
- Static files: 1 year
- Next.js static: 1 year

### Security Headers
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy

## Monitoring

### Health checks
```bash
curl http://localhost/health
curl http://localhost/api/health
```

### Resource usage
```bash
docker stats
```

## Troubleshooting

### Nginx không start
```bash
# Check config
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# View logs
docker compose -f docker-compose.prod.yml logs nginx
```

### WebSocket không connect
- Kiểm tra CORS_ORIGIN trong .env
- Kiểm tra Nginx WebSocket config
- Check browser console

### Database connection failed
```bash
# Check database status
docker compose -f docker-compose.prod.yml ps db

# Check logs
docker compose -f docker-compose.prod.yml logs db
```

## Production Checklist

- [ ] Đổi tất cả password mặc định
- [ ] Generate JWT secret mới
- [ ] Setup SSL certificate
- [ ] Configure firewall
- [ ] Setup database backup cron job
- [ ] Configure monitoring/alerting
- [ ] Update CORS_ORIGIN với domain thật
- [ ] Review và adjust rate limits
- [ ] Setup log rotation
- [ ] Test disaster recovery procedure

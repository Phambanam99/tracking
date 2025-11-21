# Nginx Production Deployment Guide

## 📋 Tổng quan

Hệ thống Tracking được deploy với Nginx làm reverse proxy cho:

### Architecture
```
Client (Browser)
    ↓
Nginx :80/:443
    ├─→ /api/*          → Backend :3001 (NestJS API)
    ├─→ /socket.io/*    → Backend :3001 (Socket.IO WebSocket)
    ├─→ /uploads/*      → Backend :3001 (Static files)
    └─→ /*              → Frontend :4000 (Next.js)
```

### Endpoints cụ thể từ codebase:

#### API Endpoints (/api)
- **Auth**: `/api/auth/login`, `/api/auth/register`
- **Vessels**: `/api/vessels/*`
- **Aircraft**: `/api/aircrafts/*`
- **Tracking**: `/api/tracking/*`
- **Regions**: `/api/regions/*`
- **Weather**: `/api/weather/*`
- **AIS**: `/api/ais/*`
- **Admin**: `/api/admin/*`
- **Users**: `/api/users/*`
- **Metrics**: `/api/metrics/*`
- **Health**: `/api/health`

#### WebSocket
- **Namespace**: `/tracking`
- **Events**:
  - `aircraftPositionUpdate`
  - `vesselPositionUpdate`
  - `regionAlert`
  - `newAircraft`, `newVessel`
  - `connectionCount`
  - `configUpdate`

#### Static Files
- `/uploads/*` - User uploaded images (aircraft/vessel)
- `/_next/static/*` - Next.js bundled assets
- `/icons/*` - Public icons

## 🚀 Deploy Production

### 1. Chuẩn bị

```bash
# Tạo thư mục cần thiết
mkdir -p data/{postgres,redis,uploads,logs,nginx-logs}
mkdir -p nginx/{ssl,certbot}

# Phân quyền
chmod +x deploy.sh setup-ssl.sh
```

### 2. Cấu hình Environment

File quan trọng:
- `backend/.env.production` - Backend config (đã tạo từ codebase)
- `.env` - Docker Compose variables (optional)

### 3. Deploy

```bash
# Deploy toàn bộ stack
./deploy.sh
```

Services chạy:
- **Nginx**: ports 80, 443 (public)
- **Backend**: port 3001 (internal only)
- **Frontend**: port 4000 (internal only)
- **PostgreSQL**: port 5432 (internal)
- **Redis**: port 6379 (internal)

### 4. Setup SSL (Optional cho Production)

```bash
# Với domain thật
./setup-ssl.sh yourdomain.com

# Uncomment HTTPS block trong nginx/conf.d/default.conf
```

## 🔧 Cấu hình Nginx

### Rate Limiting
- **API**: 10 req/s với burst 20
- **Login/Register**: 5 req/minute với burst 3

### Caching
- **Uploads**: 30 days
- **Next.js static**: 1 year (immutable)
- **Icons**: 7 days
- **Static assets**: 7 days

### WebSocket
- **Long timeout**: 7 days cho persistent connections
- **No buffering**: Real-time data
- **Upgrade headers**: Auto-configured

## 📊 Monitoring

### Health Checks
```bash
# Nginx health
curl http://localhost/health

# Backend health
curl http://localhost/api/health

# AIS health
curl http://localhost/api/ais/health

# ADSB health
curl http://localhost/api/aircrafts/adsb/health
```

### Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Nginx access/error logs
docker compose -f docker-compose.prod.yml logs -f nginx
tail -f data/nginx-logs/access.log
tail -f data/nginx-logs/error.log

# Backend logs
docker compose -f docker-compose.prod.yml logs -f backend

# Frontend logs
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Stats
```bash
# Container resource usage
docker stats

# Nginx test config
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload Nginx (without downtime)
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 🔄 Update & Maintenance

### Update Code
```bash
# Pull latest
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
```

### Restart Services
```bash
# All services
docker compose -f docker-compose.prod.yml restart

# Specific service
docker compose -f docker-compose.prod.yml restart nginx
docker compose -f docker-compose.prod.yml restart backend
```

### Database Backup
```bash
# Backup
docker exec tracking-postgis-prod pg_dump -U admin -d tracking -F c > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore
docker exec -i tracking-postgis-prod pg_restore -U admin -d tracking -c < backup_20250121_120000.dump
```

## 🐛 Troubleshooting

### WebSocket không connect
```bash
# Check backend logs
docker compose -f docker-compose.prod.yml logs backend | grep WebSocket

# Check frontend browser console for:
# [websocket] connecting to http://localhost/tracking

# Verify CORS in backend/.env.production:
# FRONTEND_ORIGIN=http://localhost
```

### API 502 Bad Gateway
```bash
# Check backend health
docker compose -f docker-compose.prod.yml ps backend

# Check backend logs
docker compose -f docker-compose.prod.yml logs backend

# Check network
docker network inspect tracking-network
```

### Uploads không hiển thị
```bash
# Check uploads mount
docker compose -f docker-compose.prod.yml exec backend ls -la uploads/

# Check Nginx proxy for /uploads
docker compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Rate limiting quá chặt
Edit `nginx/nginx.conf`:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;  # Tăng từ 10r/s
```

Restart:
```bash
docker compose -f docker-compose.prod.yml restart nginx
```

## 📝 Production Checklist

- [ ] Review `backend/.env.production` - đảm bảo JWT_SECRET đủ mạnh
- [ ] Review CORS settings - `FRONTEND_ORIGIN` và `ALLOWED_ORIGINS`
- [ ] Setup SSL certificate cho domain
- [ ] Configure firewall (chỉ mở ports 80, 443)
- [ ] Setup database backup cron job
- [ ] Configure log rotation
- [ ] Test WebSocket connection
- [ ] Test file uploads
- [ ] Test API rate limiting
- [ ] Monitor resource usage
- [ ] Setup monitoring/alerting (optional)

## 🔐 Security Notes

### Headers được set bởi Nginx:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer-when-downgrade`

### API Version Header:
- Backend yêu cầu: `X-API-Version: 1.0.0`
- Nginx tự động thêm cho tất cả `/api/*` requests

### WebSocket CORS:
- Backend gateway cho phép: `http://localhost:4000`, `http://localhost:4001`
- Production cần update trong `backend/src/events/events.gateway.ts`

## 📚 References

- Backend main: `backend/src/main.ts`
- WebSocket Gateway: `backend/src/events/events.gateway.ts`
- Frontend WebSocket: `frontend/src/services/websocket.ts`
- All Controllers: `backend/src/**/*.controller.ts`

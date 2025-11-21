# Production Deployment Files

Bộ file này giúp deploy ứng dụng tracking lên production kết nối với database hiện có.

## 📁 Files

- **docker-compose.production.yml** - Docker Compose config cho production (chỉ app + Redis, kết nối DB ngoài)
- **.env.production** - Template cấu hình (commit vào git)
- **.env.production.local** - Cấu hình thực tế (KHÔNG commit, tự tạo từ template)
- **deploy-production.ps1** - Script deploy tự động cho Windows
- **deploy-production.sh** - Script deploy tự động cho Linux/Mac
- **DEPLOY_QUICK_START.md** - Hướng dẫn nhanh
- **PRODUCTION_DEPLOYMENT.md** - Hướng dẫn chi tiết

## 🚀 Triển khai nhanh

### 1. Tạo file cấu hình

```powershell
# Windows
Copy-Item .env.production .env.production.local
notepad .env.production.local
```

```bash
# Linux/Mac
cp .env.production .env.production.local
nano .env.production.local
```

### 2. Sửa cấu hình quan trọng

Trong `.env.production.local`:

```env
# Database hiện có (trên host machine)
DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public

# Security - PHẢI ĐỔI!
JWT_SECRET=your-strong-secret-minimum-32-characters
REDIS_PASSWORD=your-strong-redis-password

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
CORS_ORIGIN=http://localhost:4000
```

### 3. Deploy

**Windows:**

```powershell
.\deploy-production.ps1 -Action start
```

**Linux/Mac:**

```bash
chmod +x deploy-production.sh
./deploy-production.sh start
```

**Hoặc thủ công:**

```bash
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d --build
```

## ✅ Kiểm tra

```powershell
# Status
docker-compose -f docker-compose.production.yml ps

# Logs
docker-compose -f docker-compose.production.yml logs -f

# Health
curl http://localhost:3001/api/health
curl http://localhost:4000
```

## 🔧 Các lệnh thường dùng

### Với script (Windows)

```powershell
.\deploy-production.ps1 -Action start   # Deploy
.\deploy-production.ps1 -Action stop    # Dừng
.\deploy-production.ps1 -Action restart # Khởi động lại
.\deploy-production.ps1 -Action logs    # Xem logs
.\deploy-production.ps1 -Action status  # Kiểm tra status
.\deploy-production.ps1 -Action update  # Update code + redeploy
```

### Với script (Linux/Mac)

```bash
./deploy-production.sh start
./deploy-production.sh stop
./deploy-production.sh restart
./deploy-production.sh logs
./deploy-production.sh status
./deploy-production.sh update
```

### Thủ công

```bash
# Start
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d

# Stop
docker-compose -f docker-compose.production.yml down

# Rebuild
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d --build

# Logs
docker-compose -f docker-compose.production.yml logs -f

# Status
docker-compose -f docker-compose.production.yml ps
```

## 📊 Services

| Service  | Port | Description                     |
| -------- | ---- | ------------------------------- |
| Frontend | 4000 | Next.js web app                 |
| Backend  | 3001 | NestJS API                      |
| Redis    | 6379 | Cache & message queue           |
| Database | 5432 | PostgreSQL (existing, external) |

## 🔐 Bảo mật

**Checklist trước khi deploy:**

- [ ] Đổi `JWT_SECRET` (min 32 ký tự)
- [ ] Đổi `REDIS_PASSWORD`
- [ ] Kiểm tra `DATABASE_URL` đúng
- [ ] Cấu hình `CORS_ORIGIN` chính xác
- [ ] Backup database trước
- [ ] Test ở local trước

## 🌐 URLs

Sau khi deploy thành công:

- Frontend: http://localhost:4000
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/api/health

## 📝 Lưu ý

1. **Database không bị thay đổi** - Ứng dụng chỉ kết nối, không run migration
2. **.env.production.local không được commit** - Chứa credentials thật
3. **Redis data được persist** - Volume `redis_data_prod`
4. **Uploads được persist** - Volume `backend_uploads`
5. **Logs được persist** - Volume `backend_logs`

## 🔍 Troubleshooting

### Backend không kết nối database

Kiểm tra DATABASE_URL:

- Host machine: `host.docker.internal`
- External server: IP thực tế
- Docker network: tên service

### Port conflict

Đổi port trong `.env.production.local`:

```env
BACKEND_PORT=3002
FRONTEND_PORT=4001
REDIS_PORT=6380
```

### Xem logs chi tiết

```bash
# Backend
docker logs tracking-backend-prod -f

# Frontend
docker logs tracking-frontend-prod -f

# Redis
docker logs tracking-redis-prod -f
```

## 📚 Tài liệu

- [DEPLOY_QUICK_START.md](./DEPLOY_QUICK_START.md) - Hướng dẫn nhanh
- [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) - Hướng dẫn đầy đủ
- [DOCKER-README.md](./DOCKER-README.md) - Docker development guide

## 🆘 Support

Nếu gặp vấn đề:

1. Kiểm tra logs
2. Verify environment variables
3. Test database connectivity
4. Check firewall settings
5. Review PRODUCTION_DEPLOYMENT.md

---

**Tóm tắt:** Setup này deploy frontend + backend + Redis trong Docker, kết nối với database PostgreSQL hiện có. Data không bị mất, chỉ deploy ứng dụng.

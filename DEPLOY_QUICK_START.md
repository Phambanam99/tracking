# 🚀 Quick Deployment Guide - Production with Existing Database

## Triển khai nhanh (5 phút)

### Bước 1: Chuẩn bị môi trường

```powershell
# Copy file cấu hình
Copy-Item .env.production .env.production.local

# Chỉnh sửa .env.production.local
notepad .env.production.local
```

**Cấu hình quan trọng cần thay đổi:**

```env
# Kết nối database hiện có (database đang chạy trên máy host)
DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public
DIRECT_DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public

# Bảo mật - PHẢI ĐỔI!
JWT_SECRET=dat-mot-chuoi-bi-mat-dai-it-nhat-32-ky-tu-o-day
REDIS_PASSWORD=mat-khau-redis-manh

# URLs công khai
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
CORS_ORIGIN=http://localhost:4000
```

### Bước 2: Deploy

```powershell
# Chạy script deploy tự động
.\deploy-production.ps1 -Action start
```

Hoặc thủ công:

```powershell
# Build và start
docker-compose -f docker-compose.production.yml --env-file .env.production.local up -d --build

# Xem logs
docker-compose -f docker-compose.production.yml logs -f
```

### Bước 3: Kiểm tra

```powershell
# Kiểm tra services đang chạy
docker-compose -f docker-compose.production.yml ps

# Test backend
curl http://localhost:3001/api/health

# Test frontend
Start-Process http://localhost:4000
```

## ✅ Thành công!

- 🌐 Frontend: http://localhost:4000
- 🔧 Backend API: http://localhost:3001
- 📊 Database: Sử dụng database hiện có (không thay đổi)

---

## 🛠️ Các lệnh thường dùng

### Xem logs

```powershell
.\deploy-production.ps1 -Action logs
```

### Dừng services

```powershell
.\deploy-production.ps1 -Action stop
```

### Khởi động lại

```powershell
.\deploy-production.ps1 -Action restart
```

### Kiểm tra trạng thái

```powershell
.\deploy-production.ps1 -Action status
```

### Cập nhật code mới

```powershell
.\deploy-production.ps1 -Action update
```

---

## 🔍 Xử lý sự cố

### Backend không kết nối được database

**Lỗi**: `Connection refused` hoặc `ECONNREFUSED`

**Giải pháp**:

1. Kiểm tra database đang chạy:

   ```powershell
   netstat -an | findstr 5432
   ```

2. Nếu database trong Docker, dùng:

   ```env
   DATABASE_URL=postgresql://admin:Phamnam99@host.docker.internal:5432/tracking?schema=public
   ```

3. Nếu database trên máy khác, dùng IP thực:
   ```env
   DATABASE_URL=postgresql://admin:Phamnam99@192.168.1.100:5432/tracking?schema=public
   ```

### Kiểm tra logs chi tiết

```powershell
# Backend logs
docker logs tracking-backend-prod --tail 100 -f

# Frontend logs
docker logs tracking-frontend-prod --tail 100 -f

# Redis logs
docker logs tracking-redis-prod --tail 100 -f
```

### Reset hoàn toàn

```powershell
# Dừng và xóa containers
docker-compose -f docker-compose.production.yml down

# Xóa volumes (CHÚ Ý: Mất data Redis và uploads!)
docker-compose -f docker-compose.production.yml down -v

# Deploy lại từ đầu
.\deploy-production.ps1 -Action start
```

---

## 📝 Lưu ý quan trọng

1. **Database hiện có không bị ảnh hưởng** - Ứng dụng chỉ kết nối đến database, không thay đổi dữ liệu
2. **Không chạy migration tự động** - Database schema đã sẵn
3. **JWT_SECRET phải thay đổi** trong production
4. **REDIS_PASSWORD nên thay đổi** để bảo mật
5. **Backup database** trước khi deploy lần đầu

---

## 🔐 Bảo mật Production

Checklist bảo mật:

- [ ] Đổi JWT_SECRET thành chuỗi random dài (min 32 ký tự)
- [ ] Đổi REDIS_PASSWORD
- [ ] Cấu hình CORS_ORIGIN chính xác
- [ ] Cấu hình firewall cho ports 3001, 4000
- [ ] Sử dụng HTTPS với reverse proxy (Nginx/Traefik)
- [ ] Backup database thường xuyên
- [ ] Monitor logs và resources

---

## 📊 Monitoring

### Resource usage

```powershell
docker stats
```

### Health status

```powershell
docker-compose -f docker-compose.production.yml ps
```

### System info

```powershell
docker system df
```

---

Xem chi tiết trong [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)

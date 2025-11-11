# 🎯 CÁCH BẮT ĐẦU SỬ DỤNG VESSEL ENRICHMENT

## ⚡ 3 BƯỚC ĐƠN GIẢN

### Bước 1: Stop Server (Nếu Đang Chạy)

```bash
# Nhấn Ctrl+C trong terminal đang chạy backend
```

### Bước 2: Chạy Migration

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

**Lưu ý Windows:** Nếu gặp lỗi permission với `prisma generate`, hãy:

1. Đóng hoàn toàn VS Code
2. Mở lại VS Code
3. Chạy lại command

### Bước 3: Restart Server

```bash
npm run start:dev
```

## ✅ XEM KẾT QUẢ

### Trong Console Log

Sau khi server khởi động, bạn sẽ thấy:

```
[VesselEnrichmentService] Initialized vessel enrichment with data source: VesselFinder
[VesselEnrichmentService] ⚠️ Using ONLY VesselFinder with conservative rate limiting (2 req/min) to avoid IP blocking
[VesselEnrichmentSchedulerService] Vessel enrichment scheduler initialized and enabled
```

### Trong Database (Sau 5-10 phút)

```sql
-- Xem tàu đã được enriched
SELECT mmsi, "vesselName", "vesselType", flag, "enrichedAt"
FROM vessels
WHERE "enrichedAt" IS NOT NULL
ORDER BY "enrichedAt" DESC;
```

### Qua API (Cần login trước)

```bash
# 1. Login để lấy token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 2. Xem stats (thay YOUR_TOKEN bằng token từ bước 1)
curl http://localhost:3000/vessel-enrichment/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 THEO DÕI

### Cách 1: Xem Console

Để terminal chạy và theo dõi logs real-time

### Cách 2: Xem Database

```sql
-- Mỗi 5 phút chạy lại query này
SELECT
  COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) as "Đã enriched",
  COUNT(*) as "Tổng số",
  ROUND(COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) * 100.0 / COUNT(*), 1) as "Phần trăm %"
FROM vessels;
```

### Cách 3: Dùng Test Script

```bash
# Set JWT token
export JWT_TOKEN="your-token-here"

# Run test
node test-vessel-enrichment.js
```

## 🚀 TĂNG TỐC (Optional)

### Queue Tất Cả Tàu Ngay

```bash
curl -X POST http://localhost:3000/vessel-enrichment/queue/unenriched \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Process Nhiều Hơn

```bash
curl -X POST "http://localhost:3000/vessel-enrichment/queue/process?maxItems=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ❓ TROUBLESHOOTING

### "Migration failed" or "Schema error"

```bash
# Option 1: Reset và migrate lại (CHỈ dev environment)
npx prisma migrate reset
npx prisma migrate dev

# Option 2: Push trực tiếp
npx prisma db push
```

### "Permission denied" khi prisma generate

```bash
# Đóng VS Code hoàn toàn
# Mở terminal mới
cd backend
npx prisma generate
```

### Không thấy log VesselEnrichment

```bash
# Check .env
cat .env | grep VESSEL_ENRICHMENT_ENABLED

# Nếu không có, thêm vào
echo "VESSEL_ENRICHMENT_ENABLED=true" >> .env

# Restart server
npm run start:dev
```

### Scheduler không chạy

```bash
# Enable qua API
curl -X POST http://localhost:3000/vessel-enrichment/scheduler/enable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📖 ĐỌC THÊM

- `README_VESSEL_ENRICHMENT_VI.md` - Hướng dẫn đầy đủ bằng Tiếng Việt
- `VESSEL_ENRICHMENT_GUIDE.md` - Chi tiết technical
- `DEPLOYMENT_STEPS_ENRICHMENT.md` - Deployment guide

## 🎉 XONG!

Hệ thống sẽ tự động:

- ⏱️ Mỗi 5 phút: Xử lý 10 tàu
- ⏱️ Mỗi giờ: Tìm tàu mới chưa có thông tin
- ⏱️ Mỗi 6 giờ: Retry các tàu thất bại
- ⏱️ Mỗi ngày: Cleanup dữ liệu cũ

**KHÔNG CẦN LÀM GÌ THÊM!** Chỉ cần để server chạy 🚀

---

### 💡 Tip: Kiểm Tra Nhanh

```bash
# Xem có bao nhiêu tàu đã được enriched
echo "SELECT COUNT(*) FROM vessels WHERE enrichedAt IS NOT NULL;" | psql YOUR_DATABASE_URL
```

Số này sẽ tăng dần theo thời gian! 📈

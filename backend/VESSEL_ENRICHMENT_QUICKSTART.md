# 🚀 Vessel Enrichment - Quick Start

## Bắt Đầu Trong 5 Phút

### 1. Chạy Migration

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 2. Cấu Hình (Optional)

```bash
# File .env
VESSEL_ENRICHMENT_ENABLED=true
```

### 3. Khởi Động Server

```bash
npm run start:dev
```

✅ **Xong!** Hệ thống đã chạy và tự động bổ sung thông tin tàu thuyền.

## Kiểm Tra Hoạt Động

### Xem Thống Kê

```bash
curl -X GET http://localhost:3000/vessel-enrichment/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Enrich 1 Tàu Ngay

```bash
curl -X POST http://localhost:3000/vessel-enrichment/enrich/412440890 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Queue Tất Cả Tàu Chưa Có Thông Tin

```bash
curl -X POST http://localhost:3000/vessel-enrichment/queue/unenriched \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Scheduler Tự Động Chạy

Không cần làm gì thêm! Hệ thống tự động:

- ⏱️ Mỗi 5 phút: Process 10 vessels
- ⏱️ Mỗi giờ: Queue vessels mới
- ⏱️ Mỗi 6 giờ: Retry failed items
- ⏱️ Mỗi ngày 3h sáng: Cleanup

## Xem Log

```bash
# Linux/Mac
tail -f logs/app.log | grep VesselEnrichment

# Windows PowerShell
Get-Content logs/app.log -Wait | Select-String "VesselEnrichment"

# Hoặc xem trong console khi chạy dev
npm run start:dev
```

## Tài Liệu Đầy Đủ

Xem `VESSEL_ENRICHMENT_GUIDE.md` để biết thêm chi tiết.

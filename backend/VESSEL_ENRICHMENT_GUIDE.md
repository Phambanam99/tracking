# Vessel Enrichment System - Hướng Dẫn Đầy Đủ

## 📖 Tổng Quan

Hệ thống Vessel Enrichment tự động bổ sung thông tin tàu thuyền từ các nguồn dữ liệu công khai, chạy 24/7 để đảm bảo database luôn có đầy đủ thông tin về tàu thuyền.

## 🎯 Tính Năng

### ✅ Tự động bổ sung thông tin

- Tên tàu (Vessel Name)
- Loại tàu (Vessel Type)
- Cờ quốc gia (Flag)
- IMO number
- Call Sign
- Kích thước (Length, Width, Draught)
- Thông tin chủ sở hữu (Owner, Operator, Manager)
- Năm đóng tàu (Year Built)
- Trọng tải (Gross Tonnage, Deadweight)
- Cảng nhà (Home Port)
- Đích đến (Destination)
- ETA (Estimated Time of Arrival)

### ✅ Hệ thống Queue thông minh

- Priority queue (ưu tiên tàu quan trọng)
- Retry logic (thử lại khi thất bại)
- Rate limiting (tôn trọng giới hạn API)
- Xử lý song song với giới hạn

### ✅ Scheduled Tasks (Chạy 24/7)

- **Mỗi 5 phút**: Xử lý queue (10 vessels)
- **Mỗi giờ**: Tìm và queue các tàu chưa có thông tin
- **Mỗi 6 giờ**: Retry các tàu thất bại
- **Mỗi ngày lúc 3 giờ sáng**: Cleanup queue cũ

### ✅ Monitoring & Logging

- Thống kê real-time
- Lịch sử enrichment cho từng tàu
- Tracking thành công/thất bại
- Performance metrics

## 🚀 Cài Đặt

### Bước 1: Chạy Migration

```bash
cd backend
npx prisma migrate dev
```

Migration sẽ tạo:

- Các trường mới trong bảng `vessels`
- Bảng `vessel_enrichment_queue`
- Bảng `vessel_enrichment_log`
- Indexes cần thiết

### Bước 2: Cấu hình Environment Variables

```bash
# Trong file .env
VESSEL_ENRICHMENT_ENABLED=true

# Optional: API keys cho data sources
APRS_FI_API_KEY=your-key-here
```

### Bước 3: Khởi động Backend

```bash
npm run start:dev
```

Hệ thống sẽ tự động:

1. Khởi động scheduler
2. Queue các tàu chưa có thông tin
3. Bắt đầu enrichment

## 📊 Nguồn Dữ Liệu

### 1. VesselFinder (Priority 1)

- **Miễn phí**: Có
- **Rate Limit**: 10 requests/phút
- **Dữ liệu**: Đầy đủ thông tin tàu
- **Cấu hình**: Không cần API key

### 2. MyShipTracking (Priority 2)

- **Miễn phí**: Có
- **Rate Limit**: 10 requests/phút
- **Dữ liệu**: Thông tin cơ bản và vị trí
- **Cấu hình**: Không cần API key

### 3. APRS.fi (Priority 3)

- **Miễn phí**: Có (cần đăng ký)
- **Rate Limit**: Theo tier
- **Dữ liệu**: Thông tin AIS cơ bản
- **Cấu hình**: Cần API key tại https://aprs.fi

## 🔧 Sử Dụng API

### Authentication

Tất cả endpoints yêu cầu JWT token với role `ADMIN` hoặc `OPERATOR`.

```bash
# Header
Authorization: Bearer <your-jwt-token>
```

### 1. Xem Thống Kê

```bash
GET /vessel-enrichment/stats

# Response
{
  "enrichment": {
    "totalVessels": 1000,
    "enrichedVessels": 750,
    "enrichmentPercentage": 75,
    "pendingQueue": 50,
    "last24Hours": {
      "attempts": 100,
      "successes": 95,
      "failures": 5,
      "successRate": 95,
      "avgDuration": 1234
    }
  },
  "queue": {
    "pending": 50,
    "processing": 0,
    "completed": 900,
    "failed": 10,
    "total": 960
  },
  "scheduler": {
    "enabled": true,
    "uptime": 86400
  }
}
```

### 2. Enrich Tàu Ngay Lập Tức

```bash
POST /vessel-enrichment/enrich/:mmsi

# Ví dụ
POST /vessel-enrichment/enrich/412440890

# Response
{
  "success": true,
  "mmsi": "412440890",
  "source": "VesselFinder",
  "fieldsUpdated": ["vesselName", "vesselType", "flag", "imo", "length"],
  "duration": 1234
}
```

### 3. Thêm Vào Queue

```bash
POST /vessel-enrichment/queue
Content-Type: application/json

# Thêm 1 tàu
{
  "mmsi": "412440890",
  "priority": 1
}

# Thêm nhiều tàu
{
  "mmsiList": ["412440890", "412440891", "412440892"],
  "priority": 0
}
```

### 4. Queue Tất Cả Tàu Chưa Có Thông Tin

```bash
POST /vessel-enrichment/queue/unenriched?limit=1000

# Response
{
  "message": "Queued 250 unenriched vessels",
  "count": 250
}
```

### 5. Xử Lý Queue Thủ Công

```bash
POST /vessel-enrichment/queue/process?maxItems=20

# Response
{
  "message": "Processed 20 items from queue",
  "count": 20
}
```

### 6. Retry Các Tàu Thất Bại

```bash
POST /vessel-enrichment/queue/retry-failed

# Response
{
  "message": "Reset 10 failed items for retry",
  "count": 10
}
```

### 7. Xem Lịch Sử Enrichment

```bash
GET /vessel-enrichment/history/:mmsi?limit=20

# Ví dụ
GET /vessel-enrichment/history/412440890

# Response
{
  "mmsi": "412440890",
  "history": [
    {
      "id": 1,
      "mmsi": "412440890",
      "source": "VesselFinder",
      "success": true,
      "fieldsUpdated": ["vesselName", "vesselType"],
      "duration": 1234,
      "createdAt": "2025-11-10T10:00:00Z"
    }
  ]
}
```

### 8. Bật/Tắt Scheduler

```bash
# Tắt
POST /vessel-enrichment/scheduler/disable

# Bật
POST /vessel-enrichment/scheduler/enable

# Xem trạng thái
GET /vessel-enrichment/scheduler/status
```

## 🎛️ Quản Lý Hệ Thống

### Kiểm Tra Logs

```bash
# Theo dõi logs real-time
tail -f logs/app.log | grep "VesselEnrichment"
```

### Monitoring

Hệ thống tự động log:

- ✅ Mỗi vessel được enriched
- ⚠️ Warnings khi data source không available
- ❌ Errors khi enrichment thất bại
- 📊 Statistics mỗi giờ

### Database Queries Hữu Ích

```sql
-- Xem tàu đã được enriched
SELECT
  mmsi, vesselName, vesselType, flag,
  enrichedAt, enrichmentSource, dataQualityScore
FROM vessels
WHERE enrichedAt IS NOT NULL
ORDER BY enrichedAt DESC
LIMIT 20;

-- Xem tàu chưa có thông tin
SELECT mmsi, vesselName, createdAt
FROM vessels
WHERE enrichedAt IS NULL
ORDER BY createdAt DESC
LIMIT 20;

-- Thống kê enrichment
SELECT
  enrichmentSource,
  COUNT(*) as total,
  AVG(dataQualityScore) as avg_quality
FROM vessels
WHERE enrichedAt IS NOT NULL
GROUP BY enrichmentSource;

-- Xem queue hiện tại
SELECT status, COUNT(*) as count
FROM vessel_enrichment_queue
GROUP BY status;

-- Enrichment log (24h gần nhất)
SELECT
  DATE_TRUNC('hour', "createdAt") as hour,
  COUNT(*) as attempts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
  AVG(duration) as avg_duration
FROM vessel_enrichment_log
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

## ⚙️ Tùy Chỉnh

### Thay Đổi Tần Suất Xử Lý

Chỉnh sửa trong `vessel-enrichment-scheduler.service.ts`:

```typescript
// Thay đổi từ 5 phút thành 10 phút
@Cron('*/10 * * * *')  // Thay vì */5
async processQueue() { ... }
```

### Thay Đổi Số Lượng Xử Lý

```typescript
// Trong schedulerService
const processed = await this.queueService.processQueue(20); // Thay vì 10
```

### Thêm Data Source Mới

1. Tạo class implements `VesselDataSource`
2. Thêm vào `dataSources` array trong `vessel-enrichment.service.ts`

```typescript
// Ví dụ
export class MyNewDataSource implements VesselDataSource {
  name = 'MySource';
  priority = 4;
  rateLimit = 10;

  async fetchByMmsi(mmsi: string): Promise<VesselEnrichmentData | null> {
    // Implementation
  }

  async isAvailable(): Promise<boolean> {
    // Check availability
  }
}

// Thêm vào service
this.dataSources = [
  new VesselFinderScraper(),
  new MyShipTrackingScraper(),
  new AprsFiScraper(),
  new MyNewDataSource(), // <-- Thêm vào đây
];
```

## 🐛 Troubleshooting

### Scheduler Không Chạy

```bash
# Check logs
tail -f logs/app.log | grep "VesselEnrichmentScheduler"

# Verify environment variable
echo $VESSEL_ENRICHMENT_ENABLED

# Force enable via API
POST /vessel-enrichment/scheduler/enable
```

### Enrichment Chậm

```bash
# Xem queue stats
GET /vessel-enrichment/queue/stats

# Process thủ công với số lượng lớn hơn
POST /vessel-enrichment/queue/process?maxItems=50
```

### Nhiều Failed Items

```bash
# Xem failed items
SELECT * FROM vessel_enrichment_queue WHERE status = 'failed';

# Xem lỗi
SELECT error, COUNT(*) FROM vessel_enrichment_queue
WHERE status = 'failed'
GROUP BY error;

# Retry
POST /vessel-enrichment/queue/retry-failed
```

### Data Source Không Available

```bash
# Test connectivity
curl -I https://www.vesselfinder.com
curl -I https://www.myshiptracking.com

# Check logs để xem source nào available
grep "Data source" logs/app.log
```

## 📈 Best Practices

### 1. Giám Sát Định Kỳ

- Kiểm tra stats hàng ngày
- Theo dõi success rate
- Review failed items

### 2. Quản Lý Queue

- Cleanup queue 1 tuần 1 lần
- Retry failed items định kỳ
- Ưu tiên tàu quan trọng với priority cao

### 3. Tối Ưu Performance

- Điều chỉnh batch size phù hợp
- Cân bằng giữa tốc độ và rate limits
- Monitor database performance

### 4. Backup & Recovery

```bash
# Backup enrichment data
pg_dump -t vessels -t vessel_enrichment_* > enrichment_backup.sql

# Restore
psql < enrichment_backup.sql
```

## 🔒 Security

- Tất cả endpoints yêu cầu authentication
- Chỉ ADMIN và OPERATOR được phép truy cập
- Rate limiting để tránh abuse
- Respect data source terms of service

## 📞 Support

Nếu gặp vấn đề:

1. Check logs: `logs/app.log`
2. Xem stats: `GET /vessel-enrichment/stats`
3. Review documentation này
4. Contact system administrator

## 🎉 Kết Quả Mong Đợi

Sau khi hệ thống chạy 24/7:

- ✅ 80-90% vessels có đầy đủ thông tin cơ bản
- ✅ Tự động cập nhật thông tin mới
- ✅ Tự động retry các tàu thất bại
- ✅ Continuous improvement của data quality

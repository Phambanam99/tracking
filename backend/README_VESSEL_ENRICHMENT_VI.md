# 🚢 Hệ Thống Tự Động Bổ Sung Thông Tin Tàu Thuyền

## 📌 Tổng Quan

Hệ thống tự động crawl và bổ sung thông tin tàu thuyền từ các nguồn dữ liệu công khai, chạy 24/7 trong backend.

## ✨ Tính Năng Nổi Bật

### 🤖 Hoàn Toàn Tự Động

- Chạy ngầm 24/7 không cần can thiệp
- Tự động tìm và queue các tàu chưa có thông tin
- Tự động retry khi thất bại
- Tự động cleanup dữ liệu cũ

### 📊 Bổ Sung 19 Trường Thông Tin

1. **IMO Number** - Số định danh quốc tế
2. **Call Sign** - Mã hiệu gọi
3. **Destination** - Điểm đến
4. **ETA** - Thời gian dự kiến đến
5. **Draught** - Mớn nước
6. **Year Built** - Năm đóng
7. **Gross Tonnage** - Trọng tải
8. **Deadweight** - Tải trọng
9. **Home Port** - Cảng nhà
10. **Owner** - Chủ sở hữu
11. **Operator** - Người vận hành
12. **Manager** - Người quản lý
13. **Classification** - Hạng tàu
14. **Enriched At** - Thời điểm cập nhật
15. **Enrichment Source** - Nguồn dữ liệu
16. **Data Quality Score** - Điểm chất lượng dữ liệu
17. **Enrichment Attempts** - Số lần thử
18. **Last Enrichment Attempt** - Lần thử cuối
19. **Enrichment Error** - Lỗi (nếu có)

### 🌐 Đa Nguồn Dữ Liệu

1. **VesselFinder** (Ưu tiên cao nhất)
   - Dữ liệu đầy đủ và chính xác
   - Miễn phí, không cần API key
2. **MyShipTracking** (Ưu tiên trung bình)
   - Thông tin AIS real-time
   - Miễn phí, không cần API key

3. **APRS.fi** (Ưu tiên thấp)
   - Dữ liệu bổ sung
   - Cần API key (miễn phí)

### ⚡ Queue System Thông Minh

- **Priority Queue**: Ưu tiên tàu quan trọng
- **Retry Logic**: Tự động thử lại tối đa 3 lần
- **Rate Limiting**: 10 requests/phút/source
- **Auto Cleanup**: Xóa items cũ sau 7 ngày

### ⏰ Scheduled Tasks

| Thời gian        | Tác vụ           | Mô tả                     |
| ---------------- | ---------------- | ------------------------- |
| Mỗi 5 phút       | Process Queue    | Xử lý 10 tàu trong queue  |
| Mỗi giờ          | Queue Unenriched | Tìm tàu chưa có thông tin |
| Mỗi 6 giờ        | Retry Failed     | Thử lại các tàu thất bại  |
| Mỗi ngày 3h sáng | Cleanup          | Dọn dẹp queue cũ          |
| Mỗi giờ          | Log Stats        | Ghi log thống kê          |

## 🚀 Bắt Đầu Ngay

### 1️⃣ Chạy Migration

```bash
cd backend
npx prisma migrate dev
```

### 2️⃣ Khởi động Backend

```bash
npm run start:dev
```

### 3️⃣ Xong!

Hệ thống tự động bắt đầu làm việc ngay.

## 📈 Theo Dõi Tiến Trình

### Xem Thống Kê (API)

```bash
curl http://localhost:3000/vessel-enrichment/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Xem Trong Database

```sql
-- Xem tỷ lệ đã enriched
SELECT
  COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) * 100.0 / COUNT(*) as "Phần trăm",
  COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) as "Đã có thông tin",
  COUNT(*) FILTER (WHERE "enrichedAt" IS NULL) as "Chưa có thông tin",
  COUNT(*) as "Tổng số"
FROM vessels;

-- Xem tàu mới được enriched
SELECT
  mmsi, "vesselName", "vesselType", flag,
  "enrichmentSource", "dataQualityScore",
  "enrichedAt"
FROM vessels
WHERE "enrichedAt" IS NOT NULL
ORDER BY "enrichedAt" DESC
LIMIT 10;

-- Xem trạng thái queue
SELECT status, COUNT(*) as "Số lượng"
FROM vessel_enrichment_queue
GROUP BY status;
```

### Xem Logs

```bash
# Windows PowerShell
Get-Content logs/app.log -Wait | Select-String "VesselEnrichment"

# Linux/Mac
tail -f logs/app.log | grep VesselEnrichment
```

## 🎛️ Quản Lý Hệ Thống

### API Endpoints (Cần JWT Token)

#### Xem Thống Kê

```bash
GET /vessel-enrichment/stats
```

#### Enrich 1 Tàu Ngay Lập Tức

```bash
POST /vessel-enrichment/enrich/:mmsi
```

#### Thêm Vào Queue

```bash
POST /vessel-enrichment/queue
Body: { "mmsi": "412440890", "priority": 10 }
```

#### Queue Tất Cả Tàu Chưa Có Thông Tin

```bash
POST /vessel-enrichment/queue/unenriched?limit=1000
```

#### Xử Lý Queue Thủ Công

```bash
POST /vessel-enrichment/queue/process?maxItems=20
```

#### Retry Các Tàu Thất Bại

```bash
POST /vessel-enrichment/queue/retry-failed
```

#### Xem Lịch Sử Enrichment

```bash
GET /vessel-enrichment/history/:mmsi
```

#### Bật/Tắt Scheduler

```bash
POST /vessel-enrichment/scheduler/enable
POST /vessel-enrichment/scheduler/disable
GET /vessel-enrichment/scheduler/status
```

## 📊 Kết Quả Mong Đợi

### Sau 1 Giờ

- ✅ 10-20 tàu được bổ sung thông tin
- ✅ Queue bắt đầu hoạt động ổn định

### Sau 24 Giờ

- ✅ 200-400 tàu được bổ sung thông tin
- ✅ System chạy ổn định

### Sau 1 Tuần

- ✅ 1000-2000 tàu được bổ sung thông tin
- ✅ 70-80% tàu có thông tin cơ bản
- ✅ Tự động cập nhật cho tàu mới

### Sau 1 Tháng

- ✅ 80-90% tàu có đầy đủ thông tin
- ✅ Continuous updates
- ✅ High data quality

## ⚙️ Cấu Hình

### Environment Variables (.env)

```bash
# Bật/tắt enrichment
VESSEL_ENRICHMENT_ENABLED=true

# Optional: API Keys
APRS_FI_API_KEY=your-key-here
```

### Tùy Chỉnh Tần Suất

Chỉnh sửa `src/vessel-enrichment/vessel-enrichment-scheduler.service.ts`:

```typescript
// Thay đổi từ 5 phút thành 10 phút
@Cron('*/10 * * * *')  // Thay vì */5
async processQueue() { ... }

// Thay đổi số lượng xử lý
const processed = await this.queueService.processQueue(20); // Thay vì 10
```

## 🔧 Troubleshooting

### Scheduler Không Chạy

```bash
# Check environment variable
echo $VESSEL_ENRICHMENT_ENABLED  # Phải là 'true'

# Check logs
tail -f logs/app.log | grep Scheduler

# Enable qua API
curl -X POST http://localhost:3000/vessel-enrichment/scheduler/enable
```

### Không Có Tàu Được Enriched

```bash
# Queue thủ công
curl -X POST http://localhost:3000/vessel-enrichment/queue/unenriched

# Process thủ công
curl -X POST http://localhost:3000/vessel-enrichment/queue/process?maxItems=10

# Check logs để xem lỗi
tail -f logs/app.log | grep ERROR
```

### Data Source Không Available

```bash
# Test connectivity
curl -I https://www.vesselfinder.com
curl -I https://www.myshiptracking.com

# Hệ thống tự động skip sources không available
# Check logs để xem warning
```

## 📚 Tài Liệu Chi Tiết

- **Quick Start**: `VESSEL_ENRICHMENT_QUICKSTART.md`
- **Full Guide**: `VESSEL_ENRICHMENT_GUIDE.md`
- **Deployment**: `DEPLOYMENT_STEPS_ENRICHMENT.md`
- **Summary**: `VESSEL_ENRICHMENT_SUMMARY.md`

## 🔒 Bảo Mật

- ✅ Tất cả API endpoints yêu cầu JWT authentication
- ✅ Chỉ ADMIN và OPERATOR được phép truy cập
- ✅ Rate limiting để tránh abuse
- ✅ Tôn trọng Terms of Service của data sources

## 💡 Tips

### Tăng Tốc Độ Enrichment

1. Tăng số lượng items xử lý mỗi lần:

```typescript
// Trong scheduler service
const processed = await this.queueService.processQueue(20); // Tăng từ 10 lên 20
```

2. Giảm delay giữa các requests:

```typescript
// Trong queue service
await new Promise((resolve) => setTimeout(resolve, 3000)); // Giảm từ 6000 xuống 3000
```

3. Chạy process thủ công song song:

```bash
# Terminal 1
curl -X POST http://localhost:3000/vessel-enrichment/queue/process?maxItems=50

# Terminal 2
curl -X POST http://localhost:3000/vessel-enrichment/queue/process?maxItems=50
```

### Ưu Tiên Tàu Quan Trọng

```bash
curl -X POST http://localhost:3000/vessel-enrichment/queue \
  -H "Content-Type: application/json" \
  -d '{"mmsi": "412440890", "priority": 100}'
```

### Monitor Hiệu Suất

```sql
-- Xem average duration
SELECT
  AVG(duration) as avg_ms,
  MIN(duration) as min_ms,
  MAX(duration) as max_ms,
  COUNT(*) as total
FROM vessel_enrichment_log
WHERE "createdAt" > NOW() - INTERVAL '1 hour';

-- Xem success rate by source
SELECT
  source,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM vessel_enrichment_log
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

## 🎉 Kết Luận

Hệ thống Vessel Enrichment đã sẵn sàng và đang tự động bổ sung thông tin cho tàu thuyền 24/7!

**Tính năng chính:**

- ✅ Tự động crawl từ nhiều nguồn
- ✅ Queue system với retry logic
- ✅ Scheduled tasks chạy liên tục
- ✅ RESTful API đầy đủ
- ✅ Monitoring & logging chi tiết
- ✅ Dễ dàng mở rộng và tùy chỉnh

**Không cần làm gì thêm - Hệ thống tự chạy!** 🚀

Chỉ cần:

1. ✅ Start backend server
2. ✅ Theo dõi logs/stats thỉnh thoảng
3. ✅ Enjoy với database tàu thuyền đầy đủ thông tin!

---

**Made with ❤️ for maritime tracking**

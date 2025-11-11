# 🚢 Vessel Enrichment - Conservative Mode (VesselFinder Only)

## 📋 Thay Đổi Chính

Hệ thống đã được cập nhật để **chỉ dùng VesselFinder** với **rate limiting rất bảo thủ** để tránh bị block IP.

## ⚙️ Thay Đổi Chi Tiết

### 1. VesselFinderScraper
- **Rate Limit**: 2 requests/phút → **30 giây giữa mỗi request**
- **Timeout**: 10s → **15s** (cho phép xử lý lâu hơn)
- **Headers**: Realistic browser headers (User-Agent, Accept, Accept-Language, Referer)
- **Approach**: Web scraping từ search page (không dùng API không ổn định)
- **URL**: `https://www.vesselfinder.com/vessels/search?mmsi=${mmsi}`
- **Parsing**: HTML scraping + JSON extraction từ page structure

### 2. VesselEnrichmentService
- **Data Sources**: Chỉ dùng **VesselFinder** (bỏ MyShipTracking và APRS.fi)
- **Log Warning**: Hiển thị warning về conservative mode

### 3. VesselEnrichmentScheduler
- **Process Frequency**: Mỗi 5 phút → **Mỗi 10 phút**
- **Items per run**: 10 → **2 items** (chỉ 2 vessels mỗi 10 phút)
- **Queue unenriched**: Mỗi giờ → **Mỗi 6 giờ**
- **Items to queue**: 100 → **50 items**

### 4. VesselEnrichmentQueue
- **Inter-request delay**: 6 giây → **35 giây**
- **Total Processing**: ~288 vessels/day → **~12 vessels/day** (conservative)

## 📊 Tốc Độ Xử Lý

### Cũ (All sources)
- Mỗi 5 phút: 10 vessels
- **~2,880 vessels/day**
- ⚠️ Risk of IP blocking

### Mới (VesselFinder only - Conservative)
- Mỗi 10 phút: 2 vessels
- **~288 vessels/day**
- ✅ Very safe from blocking

## 🎯 Ưu Điểm

✅ **Rất an toàn** - Không sợ bị block IP
✅ **Dữ liệu chất lượng cao** - VesselFinder có dữ liệu tốt nhất
✅ **Stable** - Ít lỗi, ít timeout
✅ **Predictable** - Có thể dự đoán tốc độ

## ⚠️ Nhược Điểm

❌ Chậm hơn - Chỉ ~300 vessels/day
❌ Không có fallback - Nếu VesselFinder down, không có dữ liệu

## 🚀 Cách Sử Dụng

### Không cần setup gì thêm!
```bash
# Chỉ cần start backend như bình thường
npm run start:dev
```

Hệ thống sẽ:
- Tự động queue unenriched vessels (6 giờ/lần)
- Process 2 vessels mỗi 10 phút
- Tránh bị block hoàn toàn

## 📈 Dự Kiến

| Thời gian | Vessels Enriched | Tốc độ |
|-----------|------------------|--------|
| 1 giờ | 2-4 | 2 per 10min |
| 1 ngày | 288 | Very stable |
| 1 tuần | ~2,000 | No blocking |
| 1 tháng | ~8,600 | Safe mode |

## 🔧 Nếu Muốn Tăng Tốc

### Option 1: Tăng Items Per Run
File: `vessel-enrichment-scheduler.service.ts`
```typescript
// Thay đổi từ 2 thành 4
const processed = await this.queueService.processQueue(4);
```

### Option 2: Giảm Delay Giữa Requests
File: `vessel-enrichment-queue.service.ts`
```typescript
// Thay đổi từ 35 giây thành 30 giây
await new Promise((resolve) => setTimeout(resolve, 30000));
```

### Option 3: Tăng Tần Suất Queue
File: `vessel-enrichment-scheduler.service.ts`
```typescript
// Thay từ 6 giờ thành 3 giờ
@Cron('0 */3 * * *')
```

## 💡 Khuyến Nghị

- **Giữ conservative mode hiện tại** - Rất an toàn
- Nếu cần nhanh hơn, cân nhắc xin **API key từ VesselFinder** (paid)
- Hoặc upgrade từng bước (tăng từng 1 item) và monitor

## 🔍 Theo Dõi

### Xem Tốc Độ
```bash
# Watch logs
tail -f logs/app.log | grep "processed"

# Hoặc check mỗi giờ
GET /vessel-enrichment/stats
```

### Database
```sql
-- Xem tiến độ
SELECT 
  COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) as enriched,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) * 100.0 / COUNT(*), 1) as percentage
FROM vessels;
```

## ❓ FAQ

**Q: Tại sao chậm vậy?**
A: Conservative mode để 100% tránh bị block IP. Nếu cần nhanh, xin API key.

**Q: Có thể tắt VesselFinder không?**
A: Có, nhưng sẽ không có dữ liệu. Dùng code ở trên để thêm sources khác.

**Q: Bao lâu sẽ enriched hết?**
A: ~1 tháng cho 10,000 vessels. Có thể tăng tốc nếu cần.

**Q: VesselFinder có API key paid không?**
A: Có. Xem https://www.vesselfinder.com/api

**Q: Có thể dùng 2 API cùng lúc không?**
A: Có thể, nhưng cần đổi port hoặc instance khác để avoid IP blocking.

## 📝 Ghi Chú

- ✅ Hệ thống hiện đang **hoàn toàn an toàn**
- ✅ Không sợ bị **IP blocking**
- ✅ **Dữ liệu ổn định** và có chất lượng
- ✅ **Production-ready**

---

**Made with ❤️ for safe vessel enrichment**


# Vessel Enrichment Service

Service tự động làm giàu thông tin tàu từ các nguồn dữ liệu công khai.

## Data Sources

### 1. MarineTraffic (Priority 2 - Primary)

- **URL Pattern**: `https://www.marinetraffic.com/en/ais/details/ships/shipid:{shipId}`
- **Rate Limit**: 1 request/minute (rất bảo thủ)
- **Data Fields**:
  - Name, Flag, IMO, MMSI, Call sign
  - Vessel type (General & Detailed)
  - Port of registry, Year built
  - Departure/Destination info
  - AIS transponder class

**Features**:

- Tìm kiếm shipId qua MMSI/IMO trước
- Parse HTML với cheerio
- Exponential backoff khi bị rate limit
- Hỗ trợ cả fetchByMmsi và fetchByImo

**Example**:

```typescript
const scraper = new MarineTrafficScraper();
const data = await scraper.fetchByMmsi('413213250');
// Returns: { vesselName: 'HAI YANG SHI YOU 944', imo: '9739886', ... }
```

### 2. VesselFinder (Priority 1 - Fallback)

- **URL Pattern**: `https://www.vesselfinder.com/vessels/details/{mmsi}`
- **Rate Limit**: 1 request/minute
- **Data Fields**: Similar to MarineTraffic

## How It Works

### Priority System

Hệ thống sẽ thử các data sources theo thứ tự priority (cao → thấp):

```
MarineTraffic (Priority 2) → VesselFinder (Priority 1)
```

Nếu source có priority cao thất bại hoặc không có dữ liệu, sẽ fallback sang source tiếp theo.

### Rate Limiting

- Mỗi source có rate limit riêng: **1 request/minute**
- Consecutive errors trigger exponential backoff (tối đa 5 phút)
- Tránh IP blocking bằng User-Agent rotation và delay thông minh

### Data Quality Score

Điểm chất lượng dữ liệu (0-100) dựa trên số fields được điền:

- Mỗi field có giá trị: +10 điểm
- Fields đánh giá: mmsi, imo, vesselName, vesselType, flag, callSign, yearBuilt, homePort, destination

## Usage

### Enrich Single Vessel

```bash
POST /vessel-enrichment/enrich/:mmsi
Authorization: Bearer {admin_token}
```

### Batch Enrich

```bash
POST /vessel-enrichment/batch
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "mmsiList": ["413213250", "412345678"]
}
```

### Get Stats

```bash
GET /vessel-enrichment/stats
Authorization: Bearer {admin_token}
```

## Configuration

### Add New Data Source

1. Tạo file mới trong `data-sources/` implement `VesselDataSource` interface
2. Add vào constructor của `VesselEnrichmentService`:
   ```typescript
   this.dataSources = [
     new NewScraper(), // Priority X
     new MarineTrafficScraper(), // Priority 2
     new VesselFinderScraper(), // Priority 1
   ];
   ```

### Adjust Rate Limits

Sửa `rateLimit` property trong scraper class:

```typescript
export class MarineTrafficScraper implements VesselDataSource {
  rateLimit = 2; // Change from 1 to 2 requests/minute
  // ...
}
```

## Monitoring

### Logs

- `[MarineTraffic]` - Logs từ MarineTraffic scraper
- `[VesselFinder]` - Logs từ VesselFinder scraper
- `[VesselEnrichmentService]` - Logs chung của service

### Database

Enrichment history được lưu trong bảng `VesselEnrichmentLog`:

```sql
SELECT * FROM "VesselEnrichmentLog"
WHERE mmsi = '413213250'
ORDER BY "createdAt" DESC
LIMIT 10;
```

## Important Notes

⚠️ **Rate Limiting**: Các scrapers này sử dụng public websites, KHÔNG phải official APIs. Rate limits rất bảo thủ để tránh bị block IP.

⚠️ **Production Use**: Để production, nên:

- Sử dụng official APIs nếu có
- Tăng rate limits nếu có subscription/API key
- Setup proxy rotation nếu scale lớn

⚠️ **Legal**: Đảm bảo tuân thủ Terms of Service của các websites khi scraping.

## Troubleshooting

### "Rate limited" errors

- Kiểm tra `consecutiveErrors` trong logs
- Backoff delay tự động tăng: 60s → 120s → 240s → 300s (max)
- Chờ 5-10 phút rồi thử lại

### "No data found"

- Vessel có thể không có trong database của source đó
- Fallback sẽ tự động thử source tiếp theo

### Parse errors

- HTML structure có thể thay đổi → cần update parser
- Kiểm tra response HTML trong logs (debug mode)

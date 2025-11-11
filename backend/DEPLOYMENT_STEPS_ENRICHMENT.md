# 🚀 Deployment Steps - Vessel Enrichment System

## Các Bước Triển Khai

### Bước 1: Stop Backend Server (Nếu Đang Chạy)

```bash
# Stop the running server
Ctrl + C  # trong terminal đang chạy server
```

### Bước 2: Chạy Prisma Migration

```bash
cd backend
npx prisma migrate dev --name add_vessel_enrichment_tracking
```

Hoặc nếu chỉ cần generate client:

```bash
npx prisma generate
```

### Bước 3: Cấu Hình Environment

Thêm vào file `backend/.env`:

```bash
# Vessel Enrichment Configuration
VESSEL_ENRICHMENT_ENABLED=true

# Optional: API Keys
APRS_FI_API_KEY=
```

### Bước 4: Build & Restart Backend

```bash
# Install dependencies (nếu cần)
npm install

# Build
npm run build

# Start development mode
npm run start:dev

# Hoặc production mode
npm run start:prod
```

### Bước 5: Verify Installation

#### Kiểm Tra Logs

Sau khi server khởi động, bạn sẽ thấy logs:

```
[VesselEnrichmentService] Initialized 3 data sources: VesselFinder, MyShipTracking, APRS.fi
[VesselEnrichmentSchedulerService] Vessel enrichment scheduler initialized and enabled
[VesselEnrichmentSchedulerService] Checking for unenriched vessels
```

#### Test API Endpoints

```bash
# Get JWT token trước (login)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Save token
export JWT_TOKEN="your-jwt-token-here"

# Test enrichment stats
curl -X GET http://localhost:3000/vessel-enrichment/stats \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Bước 6: Queue Initial Vessels

```bash
# Queue all unenriched vessels
curl -X POST http://localhost:3000/vessel-enrichment/queue/unenriched \
  -H "Authorization: Bearer $JWT_TOKEN"

# Check queue status
curl -X GET http://localhost:3000/vessel-enrichment/queue/stats \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Bước 7: Monitor Progress

#### Option A: Watch Logs

```bash
# Linux/Mac
tail -f logs/app.log | grep VesselEnrichment

# Windows PowerShell
Get-Content logs/app.log -Wait | Select-String "VesselEnrichment"
```

#### Option B: Check Stats Periodically

```bash
# Create a simple monitoring script
while true; do
  curl -X GET http://localhost:3000/vessel-enrichment/stats \
    -H "Authorization: Bearer $JWT_TOKEN" | jq
  sleep 300  # Check every 5 minutes
done
```

#### Option C: Database Query

```sql
-- Check enrichment progress
SELECT
  COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) as enriched,
  COUNT(*) FILTER (WHERE "enrichedAt" IS NULL) as not_enriched,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "enrichedAt" IS NOT NULL) / COUNT(*), 2) as percentage
FROM vessels;

-- Recent enrichments
SELECT mmsi, "vesselName", "enrichedAt", "enrichmentSource", "dataQualityScore"
FROM vessels
WHERE "enrichedAt" IS NOT NULL
ORDER BY "enrichedAt" DESC
LIMIT 10;

-- Queue status
SELECT status, COUNT(*) as count
FROM vessel_enrichment_queue
GROUP BY status;
```

## 🔍 Troubleshooting

### Issue 1: Migration Failed

```bash
# Reset migration (careful in production!)
npx prisma migrate reset

# Or apply manually
npx prisma db push
```

### Issue 2: Prisma Generate Error (Permission Denied on Windows)

```bash
# Close backend server completely
# Then run
npx prisma generate
```

### Issue 3: Scheduler Not Starting

Kiểm tra file `.env`:

```bash
VESSEL_ENRICHMENT_ENABLED=true  # Must be 'true', not 'false'
```

Restart server:

```bash
npm run start:dev
```

### Issue 4: No Vessels Being Enriched

```bash
# Check if there are vessels in database
curl http://localhost:3000/vessels | jq length

# Manually trigger enrichment for one vessel
curl -X POST http://localhost:3000/vessel-enrichment/enrich/MMSI_NUMBER \
  -H "Authorization: Bearer $JWT_TOKEN"

# Check logs for errors
tail -f logs/app.log
```

### Issue 5: Data Source Not Available

```bash
# Test connectivity
curl -I https://www.vesselfinder.com
curl -I https://www.myshiptracking.com

# The system will automatically skip unavailable sources
# Check logs for warnings
```

## ✅ Success Indicators

Sau khi triển khai thành công, bạn sẽ thấy:

1. **Logs showing scheduler is running:**

```
[VesselEnrichmentSchedulerService] Starting scheduled queue processing
[VesselEnrichmentSchedulerService] Scheduled processing completed: 10 vessels enriched
```

2. **Statistics API returns data:**

```json
{
  "enrichment": {
    "totalVessels": 1000,
    "enrichedVessels": 50,
    "enrichmentPercentage": 5,
    "pendingQueue": 100
  }
}
```

3. **Database shows enriched vessels:**

```sql
SELECT COUNT(*) FROM vessels WHERE "enrichedAt" IS NOT NULL;
-- Should increase over time
```

4. **Queue is being processed:**

```sql
SELECT * FROM vessel_enrichment_log ORDER BY "createdAt" DESC LIMIT 5;
-- Shows recent enrichment attempts
```

## 📊 Expected Timeline

- **First 1 hour**: 10-20 vessels enriched (initial queue processing)
- **First 6 hours**: 50-100 vessels enriched
- **First 24 hours**: 200-400 vessels enriched
- **First week**: 1000-2000 vessels enriched

_Note: Actual numbers depend on:_

- Total vessels in database
- Data source availability
- Rate limits
- Success rate

## 🎉 Done!

Hệ thống đã được triển khai và đang chạy 24/7!

Next steps:

- Monitor logs định kỳ
- Check stats hàng ngày
- Adjust scheduler frequency nếu cần
- Consider paid APIs cho faster processing

Enjoy! 🚢

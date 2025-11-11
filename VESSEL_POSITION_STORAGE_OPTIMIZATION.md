# Vessel Position Storage Optimization Strategy 🎯

## ⚠️ Vấn Đề: Storage Explosion

### Tính Toán Hiện Tại:
- **28,869 vessels** đang hoạt động
- **2 sources** (SignalR + AISStream.io)
- **Update frequency:** 5 giây/lần
- **Records/ngày:** ~100 triệu records
- **Storage/ngày:** ~100 GB
- **Storage/năm:** ~36 TB ❌

→ **KHÔNG BỀN VỮNG!**

## ✅ Giải Pháp: Tiered Storage Strategy

### Chiến Lược 3 Tầng:

```
┌─────────────────────────────────────────────────────────┐
│  Tier 1: HOT DATA (Redis)                               │
│  - Last 1 hour                                          │
│  - Full resolution (all sources)                        │
│  - In-memory, ultra-fast                               │
│  - Size: ~2 GB                                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Tier 2: WARM DATA (PostgreSQL - Recent)                │
│  - Last 7 days                                          │
│  - FUSED data only (1 record per timestamp)            │
│  - Indexed for fast queries                            │
│  - Size: ~70 GB                                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Tier 3: COLD DATA (PostgreSQL - Archive)               │
│  - Older than 7 days                                    │
│  - DOWNSAMPLED (1 record per minute)                   │
│  - Compressed                                           │
│  - Size: ~5 GB/month                                    │
└─────────────────────────────────────────────────────────┘
```

## 📊 Chi Tiết Từng Tầng

### Tier 1: HOT DATA (Redis) - 1 Hour

**Mục đích:** Realtime tracking, ultra-fast queries

**Lưu gì:**
- ✅ **Tất cả sources** (để fusion có đủ data)
- ✅ **Full resolution** (mọi update)
- ✅ **Geo-indexed** (cho bbox queries)

**Implementation:**
```typescript
// Redis keys:
ais:vessel:{mmsi}:recent        // Hash - latest position
ais:vessel:{mmsi}:history:1h    // Sorted Set - last 1 hour positions
ais:vessels:geo                 // Geo index
ais:vessels:active              // Sorted Set by timestamp

// TTL: 1 hour (auto-expire)
```

**Storage:**
```
28,869 vessels × 720 records/hour × 2 sources × 100 bytes = ~4 GB
```

---

### Tier 2: WARM DATA (Postgres) - 7 Days

**Mục đích:** Recent history, detailed tracking

**Lưu gì:**
- ✅ **Chỉ FUSED data** (1 record tốt nhất mỗi timestamp)
- ❌ **Không lưu tất cả sources** (tiết kiệm 50% space)
- ✅ **Full resolution** (mọi update từ fusion)

**Schema Change:**
```prisma
model VesselPosition {
  id        Int      @id @default(autoincrement())
  vesselId  Int
  latitude  Float
  longitude Float
  speed     Float?
  course    Int?
  heading   Int?
  status    String?
  timestamp DateTime @default(now())
  source    String?   // Source của message tốt nhất
  score     Float?    // Score của message tốt nhất
  
  // ✅ Chỉ 1 record per timestamp (không phân biệt source)
  @@unique([vesselId, timestamp])  // ← Changed from [vesselId, timestamp, source]
  @@index([vesselId])
  @@index([timestamp])
  @@index([latitude, longitude])
  @@map("vessel_positions")
}

// ✅ Partition by date for easy archival
// CREATE TABLE vessel_positions_2025_11_08 PARTITION OF vessel_positions
// FOR VALUES FROM ('2025-11-08') TO ('2025-11-09');
```

**Storage:**
```
28,869 vessels × 17,280 records/day × 7 days × 100 bytes = ~350 GB/week
Với compression: ~70 GB/week
```

**Auto-cleanup:**
```typescript
// Scheduled job: Delete data older than 7 days
@Cron('0 0 * * *')  // Daily at midnight
async cleanupOldPositions() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  await this.prisma.vesselPosition.deleteMany({
    where: {
      timestamp: { lt: sevenDaysAgo }
    }
  });
}
```

---

### Tier 3: COLD DATA (Archive) - Long-term

**Mục đích:** Historical analysis, compliance

**Lưu gì:**
- ✅ **DOWNSAMPLED** (1 record per minute thay vì per 5 seconds)
- ✅ **Compressed** (PostgreSQL compression)
- ✅ **Separate table** (không ảnh hưởng queries realtime)

**Schema:**
```prisma
model VesselPositionArchive {
  id        Int      @id @default(autoincrement())
  vesselId  Int
  latitude  Float
  longitude Float
  speed     Float?
  course    Int?
  heading   Int?
  timestamp DateTime  // Rounded to minute
  source    String?
  score     Float?
  
  // Aggregated data
  sampleCount Int?     // Số samples được aggregate
  avgSpeed    Float?   // Average speed trong minute đó
  
  @@unique([vesselId, timestamp])
  @@index([vesselId])
  @@index([timestamp])
  @@map("vessel_positions_archive")
}
```

**Downsampling Strategy:**
```typescript
@Cron('0 1 * * *')  // Daily at 1 AM
async archiveOldPositions() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  
  // Get positions from 7-8 days ago
  const positions = await this.prisma.vesselPosition.findMany({
    where: {
      timestamp: {
        gte: eightDaysAgo,
        lt: sevenDaysAgo
      }
    },
    orderBy: { timestamp: 'asc' }
  });
  
  // Group by vessel and minute
  const grouped = this.groupByMinute(positions);
  
  // Insert into archive (1 record per minute)
  for (const [key, group] of grouped) {
    const [vesselId, minute] = key.split(':');
    
    await this.prisma.vesselPositionArchive.create({
      data: {
        vesselId: parseInt(vesselId),
        latitude: group[0].latitude,  // First position in minute
        longitude: group[0].longitude,
        speed: group[0].speed,
        course: group[0].course,
        heading: group[0].heading,
        timestamp: new Date(minute),
        source: group[0].source,
        score: group[0].score,
        sampleCount: group.length,
        avgSpeed: this.average(group.map(p => p.speed)),
      }
    });
  }
  
  // Delete from main table
  await this.prisma.vesselPosition.deleteMany({
    where: {
      timestamp: {
        gte: eightDaysAgo,
        lt: sevenDaysAgo
      }
    }
  });
}

private groupByMinute(positions: VesselPosition[]) {
  const map = new Map<string, VesselPosition[]>();
  
  for (const pos of positions) {
    const minute = new Date(pos.timestamp);
    minute.setSeconds(0, 0);
    const key = `${pos.vesselId}:${minute.toISOString()}`;
    
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(pos);
  }
  
  return map;
}
```

**Storage:**
```
28,869 vessels × 1,440 records/day (1/min) × 100 bytes = ~4 GB/day
Per month: ~120 GB
Per year: ~1.4 TB (vs 36 TB without optimization!)
```

## 🎯 Cải Tiến Fusion Pipeline

### Thay Đổi: Chỉ Lưu Message Tốt Nhất Vào DB

**File:** `backend/src/ais/ais-orchestrator.service.ts`

```typescript
private async processFusion(key: string, now: number) {
  try {
    const decision = await this.vesselFusion.decide(key, now);

    if (!decision.best) return;

    // ✅ Chỉ publish nếu là message mới
    if (decision.publish) {
      const fused = this.toFusedRecord(decision.best);
      this.fused$.next(fused);
      this.stats.published++;
      await this.vesselFusion.markPublished(key, decision.best.ts);
      
      // ✅ Chỉ persist message tốt nhất (không persist tất cả)
      await this.persist(decision.best);
    }

    // ❌ REMOVED: Không persist backfillOnly nữa
    // if (decision.backfillOnly) {
    //   await this.persist(decision.best);
    // }
  } catch (e: any) {
    this.logger.error(`processFusion failed for key ${key}: ${e.message}`);
  }
}
```

**Kết quả:**
- ✅ Chỉ lưu **1 record** mỗi timestamp (message tốt nhất)
- ✅ Giảm **50% storage** ngay lập tức
- ✅ Vẫn giữ được chất lượng data (vì đã chọn message tốt nhất)

## 📈 So Sánh Storage

### Trước Optimization:
```
Tier 1 (Redis):     4 GB
Tier 2 (Postgres):  700 GB (7 days, all sources)
Tier 3 (Archive):   36 TB/year
─────────────────────────────────────
TOTAL/year:         ~36 TB ❌
```

### Sau Optimization:
```
Tier 1 (Redis):     4 GB (1 hour, all sources for fusion)
Tier 2 (Postgres):  70 GB (7 days, fused only)
Tier 3 (Archive):   1.4 TB/year (downsampled)
─────────────────────────────────────
TOTAL/year:         ~1.4 TB ✅ (96% reduction!)
```

## 🚀 Implementation Plan

### Phase 1: Schema Migration (Immediate)
```bash
# 1. Create archive table
npx prisma migrate dev --name add_position_archive

# 2. Update unique constraint
# Change: @@unique([vesselId, timestamp, source])
# To:     @@unique([vesselId, timestamp])
npx prisma migrate dev --name remove_source_from_unique_key
```

### Phase 2: Update Fusion Logic (Immediate)
```typescript
// ✅ Only persist best message (not all sources)
if (decision.publish) {
  await this.persist(decision.best);
}
```

### Phase 3: Add Cleanup Jobs (Within 1 week)
```typescript
// 1. Daily cleanup: Delete positions older than 7 days
@Cron('0 0 * * *')
async cleanupOldPositions() { ... }

// 2. Daily archival: Downsample and move to archive
@Cron('0 1 * * *')
async archiveOldPositions() { ... }
```

### Phase 4: Redis TTL (Within 1 week)
```typescript
// Set TTL on Redis keys
await client.expire(`ais:vessel:${mmsi}:history:1h`, 3600);
```

## 📊 Query Patterns

### Recent Data (Last 7 days):
```typescript
// Fast - from main table
const positions = await prisma.vesselPosition.findMany({
  where: {
    vesselId: 922767,
    timestamp: { gte: sevenDaysAgo }
  },
  orderBy: { timestamp: 'desc' }
});
```

### Historical Data (Older than 7 days):
```typescript
// From archive table (downsampled)
const positions = await prisma.vesselPositionArchive.findMany({
  where: {
    vesselId: 922767,
    timestamp: {
      gte: thirtyDaysAgo,
      lt: sevenDaysAgo
    }
  },
  orderBy: { timestamp: 'desc' }
});
```

### Combined Query (Last 30 days):
```typescript
const [recent, archived] = await Promise.all([
  prisma.vesselPosition.findMany({
    where: { vesselId: 922767, timestamp: { gte: sevenDaysAgo } }
  }),
  prisma.vesselPositionArchive.findMany({
    where: { 
      vesselId: 922767, 
      timestamp: { gte: thirtyDaysAgo, lt: sevenDaysAgo }
    }
  })
]);

const combined = [...recent, ...archived].sort((a, b) => 
  b.timestamp.getTime() - a.timestamp.getTime()
);
```

## 🎯 Trade-offs

### Pros:
- ✅ **96% storage reduction**
- ✅ **Faster queries** (smaller tables)
- ✅ **Lower costs** (database, backup)
- ✅ **Scalable** long-term

### Cons:
- ❌ **Mất chi tiết** của từng source (chỉ giữ message tốt nhất)
- ❌ **Không thể audit** individual sources sau 7 ngày
- ❌ **Downsampled** data sau 7 ngày (1 record/minute thay vì /5 seconds)

### Mitigation:
- Nếu cần audit sources → Lưu **source comparison logs** riêng (lightweight)
- Nếu cần full resolution lâu dài → Tăng Tier 2 lên 30 ngày (trade-off: 300 GB)
- Nếu cần raw data → Export sang S3/cold storage (rẻ hơn nhiều)

## 🔍 Monitoring

### Metrics to Track:
```typescript
// Storage metrics
SELECT 
  pg_size_pretty(pg_total_relation_size('vessel_positions')) as main_size,
  pg_size_pretty(pg_total_relation_size('vessel_positions_archive')) as archive_size;

// Record counts
SELECT 
  (SELECT COUNT(*) FROM vessel_positions) as recent_count,
  (SELECT COUNT(*) FROM vessel_positions_archive) as archive_count;

// Oldest record in main table
SELECT MIN(timestamp) FROM vessel_positions;
```

### Alerts:
- 🚨 Main table > 7 days old data → Cleanup job failed
- 🚨 Main table > 100 GB → Storage growing too fast
- 🚨 Archive job failed → Manual intervention needed

---

## ✅ Recommendation

**Implement Phase 1 + 2 IMMEDIATELY:**
1. Change unique constraint to `@@unique([vesselId, timestamp])`
2. Only persist best message (not all sources)
3. Add cleanup job for 7-day retention

**Expected Result:**
- 50% immediate storage reduction
- Sustainable growth (~1.4 TB/year)
- No impact on functionality

**Timeline:** 1-2 days implementation + testing


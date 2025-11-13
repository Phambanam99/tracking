# Phân tích vấn đề biến động số lượng tàu thuyền trên Dashboard

## Tóm tắt vấn đề

Dashboard hiển thị sự biến động đáng kể về số lượng tàu thuyền đang hoạt động, thay đổi giữa 20,000 và 366 tàu. Phân tích sâu đã xác định được nguyên nhân gốc rễ và đề xuất giải pháp khắc phục.

## Phân tích hệ thống hiện tại

### 1. Cách dashboard tính số lượng tàu thuyền

**Frontend (`frontend/src/app/dashboard/page.tsx`):**

- Gọi API `/stats` để lấy thống kê tổng quan
- Gọi API `/vessels?hasSignal=true` để lấy danh sách tàu có tín hiệu
- Lọc lại các tàu có `lastPosition` để xác định tàu đang hoạt động

**Backend (`backend/src/app.controller.ts`):**

```typescript
// API /stats - Đếm tàu hoạt động trong 30 phút gần nhất
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
const activeVessels = await this.prisma.vessel.count({
  where: {
    positions: {
      some: {
        timestamp: { gte: thirtyMinutesAgo },
      },
    },
  },
});
```

**Backend (`backend/src/vessel/vessel.controller.ts`):**

- API `/vessels/online` sử dụng Redis ZSET `ais:vessels:active` với timestamp
- API `/vessels` sử dụng database query với `hasSignal=true`

### 2. Nguồn dữ liệu và đồng bộ hóa

**Hệ thống có 3 nguồn dữ liệu chính:**

1. **AIS Data Stream** (SignalR + AISStream.io)

   - Dữ liệu thời gian thực từ các nguồn AIS
   - Được xử lý bởi `AisOrchestratorService`
   - Lưu vào Redis và PostgreSQL

2. **Vessel Enrichment Service** (Python)

   - Chạy độc lập, làm giàu dữ liệu tàu
   - Cập nhật các trường như `vessel_name`, `vessel_type`, `flag`, etc.
   - **KHÔNG ảnh hưởng đến vị trí hoặc timestamp của tàu**

3. **Database Queries**
   - PostgreSQL lưu trữ lịch sử vị trí
   - Redis lưu trữ trạng thái active vessels với TTL 30 phút

## Nguyên nhân gốc rễ của vấn đề

### 1. Sự không nhất quán giữa Redis và Database

**Vấn đề chính:** Dashboard sử dụng 2 nguồn dữ liệu khác nhau cho cùng một metric:

- **API `/stats`**: Query trực tiếp từ PostgreSQL database
- **API `/vessels?hasSignal=true`**: Query từ PostgreSQL với filter khác
- **API `/vessels/online`**: Query từ Redis ZSET

**Kết quả:** Các API trả về số lượng khác nhau vì:

1. **Redis TTL Issue**: Redis keys có TTL 30 phút, có thể bị expired
2. **Database Query Performance**: Query với JOIN `positions` có thể chậm và timeout
3. **Timestamp Inconsistency**: Different time windows being used (30min vs 1h vs custom)

### 2. Vấn đề về Performance và Caching

**Database Performance Issues:**

```typescript
// Query này có thể rất chậm với lượng dữ liệu lớn
const activeVessels = await this.prisma.vessel.count({
  where: {
    positions: {
      some: {
        timestamp: { gte: thirtyMinutesAgo },
      },
    },
  },
});
```

**Redis Synchronization Issues:**

- `AisOrchestratorService` cập nhật Redis với TTL 30 phút
- Nếu có lỗi trong quá trình sync, Redis có thể mất dữ liệu
- Không có cơ chế fallback khi Redis empty

### 3. Vessel Enrichment Service Impact

**Phân tích cho thấy Vessel Enrichment Service KHÔNG gây ra vấn đề:**

- Service chỉ cập nhật metadata (tên, loại tàu, flag, etc.)
- KHÔNG thay đổi `timestamp` hoặc `position`
- Sử dụng connection pooling và rate limiting để tránh ảnh hưởng performance
- Có retry mechanisms và graceful shutdown

## Giải pháp đề xuất

### 1. Giải pháp ngắn hạn (Immediate Fix)

**Standardize Data Source:**

```typescript
// Sử dụng统一的数据源和查询逻辑
async getActiveVesselsCount() {
  // Luôn sử dụng Redis làm primary source
  const client = this.redis.getClient();
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  const activeCount = await client.zcount(
    'ais:vessels:active',
    thirtyMinutesAgo,
    '+inf'
  );

  // Fallback to database nếu Redis empty
  if (activeCount === 0) {
    return this.getDatabaseActiveVessels();
  }

  return activeCount;
}
```

**Add Health Check for Data Consistency:**

```typescript
// Thêm endpoint để kiểm tra tính nhất quán
@Get('health/data-consistency')
async checkDataConsistency() {
  const [redisCount, dbCount] = await Promise.all([
    this.getRedisActiveVessels(),
    this.getDatabaseActiveVessels()
  ]);

  const discrepancy = Math.abs(redisCount - dbCount);
  const threshold = 0.1; // 10% threshold

  return {
    consistent: discrepancy / Math.max(redisCount, dbCount) < threshold,
    redisCount,
    dbCount,
    discrepancy,
    threshold
  };
}
```

### 2. Giải pháp trung hạn (Medium-term Improvements)

**Implement Caching Layer:**

```typescript
// Thêm caching cho database queries
@Injectable()
export class VesselStatsCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 60000; // 1 minute

  async getActiveVesselsCount(): Promise<number> {
    const cacheKey = "active_vessels_count";
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    const count = await this.queryActiveVessels();
    this.cache.set(cacheKey, { data: count, timestamp: Date.now() });

    return count;
  }
}
```

**Optimize Database Queries:**

```sql
-- Thêm index để tối ưu query
CREATE INDEX CONCURRENTLY idx_vessel_positions_timestamp
ON vessel_positions (timestamp DESC);

CREATE INDEX CONCURRENTLY idx_vessel_positions_vessel_timestamp
ON vessel_positions (vessel_id, timestamp DESC);

-- Sử dụng materialized view cho thống kê
CREATE MATERIALIZED VIEW vessel_active_stats AS
SELECT
  v.id,
  v.mmsi,
  MAX(vp.timestamp) as last_position_time,
  CASE
    WHEN MAX(vp.timestamp) > NOW() - INTERVAL '30 minutes' THEN true
    ELSE false
  END as is_active
FROM vessels v
LEFT JOIN vessel_positions vp ON v.id = vp.vessel_id
GROUP BY v.id, v.mmsi;

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_vessel_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vessel_active_stats;
END;
$$ LANGUAGE plpgsql;
```

### 3. Giải pháp dài hạn (Long-term Architecture)

**Implement Event-Driven Architecture:**

```typescript
// Sử dụng event sourcing để đảm bảo tính nhất quán
@Injectable()
export class VesselEventService {
  async onPositionUpdate(event: VesselPositionEvent) {
    // Update Redis
    await this.updateRedisActiveSet(event);

    // Update cache
    await this.updateStatsCache(event);

    // Emit event for other services
    await this.eventEmitter.emit("vessel.position.updated", event);
  }
}
```

**Add Monitoring and Alerting:**

```typescript
// Monitor data consistency
@Injectable()
export class DataConsistencyMonitor {
  @Cron("*/5 * * * *") // Every 5 minutes
  async checkConsistency() {
    const [redisCount, dbCount] = await Promise.all([
      this.getRedisCount(),
      this.getDatabaseCount(),
    ]);

    const discrepancy = Math.abs(redisCount - dbCount);
    const threshold = 0.05; // 5% threshold

    if (discrepancy / Math.max(redisCount, dbCount) > threshold) {
      await this.alertService.sendAlert({
        type: "DATA_INCONSISTENCY",
        redisCount,
        dbCount,
        discrepancy,
      });
    }
  }
}
```

## Kế hoạch triển khai

### Phase 1: Immediate Fix (1-2 days)

1. [ ] Standardize `/stats` API to use Redis as primary source
2. [ ] Add fallback mechanism when Redis is empty
       3...

## Kế hoạch triển khai

### Phase 1: Immediate Fix (1-2 days)

1. [ ] Standardize `/stats` API to use Redis as primary source
2. [ ] Add fallback mechanism when Redis is empty
3. [ ] Implement data consistency check endpoint
4. [ ] Add logging for debugging data discrepancies

### Phase 2: Medium-term Improvements (1-2 weeks)

1. [ ] Implement caching layer for database queries
2. [ ] Optimize database indexes for performance
3. [ ] Add materialized views for statistics
4. [ ] Implement monitoring and alerting for data consistency

### Phase 3: Long-term Architecture (1-2 months)

1. [ ] Implement event-driven architecture
2. [ ] Add comprehensive monitoring and alerting
3. [ ] Implement data validation and reconciliation
4. [ ] Add automated recovery mechanisms

## Kết luận

Vấn đề biến động số lượng tàu thuyền trên dashboard được gây ra bởi:

1. **Sự không nhất quán giữa các nguồn dữ liệu** (Redis vs Database)
2. **Performance issues** trong database queries
3. **Thiếu cơ chế fallback** khi một nguồn dữ liệu gặp vấn đề

**Vessel Enrichment Service không phải là nguyên nhân** - service được thiết kế tốt với:

- Connection pooling để tránh ảnh hưởng database performance
- Rate limiting để tránh overload
- Retry mechanisms và graceful shutdown
- Chỉ cập nhật metadata, không ảnh hưởng đến position/timestamp

Giải pháp đề xuất sẽ đảm bảo tính nhất quán và reliability cho dashboard metrics.

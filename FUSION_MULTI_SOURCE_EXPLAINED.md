# Fusion Pipeline: Xử Lý Đa Nguồn (Multi-Source) 🔄

## Câu Hỏi: Khi có 2 nguồn thì lưu như thế nào?

Khi **cùng 1 vessel** nhận dữ liệu từ **nhiều nguồn khác nhau** (ví dụ: SignalR và AISStream.io), hệ thống fusion sẽ:

1. ✅ **Nhận TẤT CẢ các message** từ mọi nguồn
2. ✅ **Lưu TẤT CẢ vào database** (với source khác nhau)
3. ✅ **Chọn message TỐT NHẤT** để publish realtime
4. ✅ **Cập nhật Redis** với message tốt nhất

## 🔄 Quy Trình Chi Tiết

### Bước 1: Ingest - Nhận Dữ Liệu Từ Nhiều Nguồn

```typescript
// ais-orchestrator.service.ts

// SignalR gửi message
this.signalrSub = this.aisSignalr.dataStream$.subscribe({
  next: ({ data }) => {
    this.ingestBatch(data, 'signalr');  // ← Source: 'signalr'
  }
});

// AISStream.io gửi message
this.aistreamSub = this.aisAistream.dataStream$.subscribe({
  next: (data) => {
    this.ingestBatch(data, 'aisstream.io');  // ← Source: 'aisstream.io'
  }
});
```

**Kết quả:** Cả 2 nguồn đều được normalize và đưa vào fusion service.

### Bước 2: Window Store - Lưu Tạm Trong Cửa Sổ Thời Gian

```typescript
// vessel-fusion.service.ts

ingest(messages: NormVesselMsg[], now = Date.now()): void {
  for (const m of messages) {
    if (!saneVessel(m, now)) continue;
    const key = keyOfVessel(m);  // key = MMSI (ví dụ: "636021123")
    if (!key) continue;
    this.windows.push(key, m, now);  // ← Thêm vào window
  }
}
```

**Window Store (`EventTimeWindowStore`):**
- Mỗi vessel có 1 **window** (cửa sổ thời gian 5 phút)
- Window chứa **TẤT CẢ messages** từ **TẤT CẢ sources** trong 5 phút qua
- Ví dụ window cho MMSI `636021123`:

```javascript
[
  { mmsi: "636021123", lat: 37.85, lon: -8.86, ts: "2025-11-08T10:00:00Z", source: "signalr", ... },
  { mmsi: "636021123", lat: 37.85, lon: -8.86, ts: "2025-11-08T10:00:05Z", source: "aisstream.io", ... },
  { mmsi: "636021123", lat: 37.85, lon: -8.86, ts: "2025-11-08T10:00:10Z", source: "signalr", ... },
  { mmsi: "636021123", lat: 37.85, lon: -8.86, ts: "2025-11-08T10:00:15Z", source: "aisstream.io", ... },
]
```

### Bước 3: Decide - Chọn Message Tốt Nhất

```typescript
// vessel-fusion.service.ts

async decide(key: string, now = Date.now()): Promise<FusionDecision<NormVesselMsg>> {
  // Lấy tất cả messages trong window
  const win = this.windows.getWindow(key).filter((m) => saneVessel(m, now));
  
  // Lọc messages mới hơn lần publish cuối
  const newer = win.filter((m) =>
    (!last || Date.parse(m.ts) > Date.parse(last)) &&
    now - Date.parse(m.ts) <= FUSION_CONFIG.ALLOWED_LATENESS_MS,
  );
  
  if (newer.length > 0) {
    // Sắp xếp theo: 1) Timestamp mới nhất, 2) Score cao nhất
    best = newer.sort(
      (a, b) => 
        Date.parse(b.ts) - Date.parse(a.ts) ||  // ← Ưu tiên timestamp
        scoreVessel(b, now) - scoreVessel(a, now)  // ← Sau đó là score
    )[0];
    return { best, publish: true, backfillOnly: false };
  }
  
  // Nếu không có message mới, chọn message có score cao nhất
  best = win.sort((a, b) => scoreVessel(b, now) - scoreVessel(a, now))[0];
  return { best, publish: false, backfillOnly: true };
}
```

**Thuật Toán Chọn:**
1. **Ưu tiên timestamp mới nhất** (event-time priority)
2. **Nếu timestamp bằng nhau** → chọn source có score cao hơn
3. **Score được tính:** `0.5×Recency + 0.3×SourceWeight + 0.2×Validity`

### Bước 4: Persist - Lưu VÀO DATABASE

```typescript
// ais-orchestrator.service.ts

private async persist(msg: NormVesselMsg) {
  const sourceValue = msg.source || 'unknown';
  const timestampValue = new Date(ts);
  const score = scoreVessel(msg, Date.now());

  await tx.vesselPosition.upsert({
    where: {
      vesselId_timestamp_source: {  // ← Unique constraint
        vesselId: vessel.id,
        timestamp: timestampValue,
        source: sourceValue,  // ← Source là part của unique key
      },
    },
    create: {
      vesselId: vessel.id,
      latitude: msg.lat,
      longitude: msg.lon,
      timestamp: timestampValue,
      source: sourceValue,  // ← Lưu source
      score: score,         // ← Lưu score
      // ...
    },
    update: {
      latitude: msg.lat,
      longitude: msg.lon,
      score: score,
      // ...
    },
  });
}
```

**Unique Constraint:**
```prisma
@@unique([vesselId, timestamp, source])
```

**Điều này có nghĩa:**
- ✅ **Cùng 1 vessel, cùng 1 timestamp, KHÁC source** → Lưu 2 records riêng biệt
- ✅ **Cùng 1 vessel, cùng 1 timestamp, CÙNG source** → Update record cũ

## 📊 Ví Dụ Cụ Thể

### Tình Huống: MMSI `636021123` nhận data từ 2 nguồn

**Timeline:**
```
10:00:00 - SignalR:      lat=37.85170, lon=-8.86390, speed=1.4
10:00:05 - AISStream.io: lat=37.85172, lon=-8.86392, speed=1.5
10:00:10 - SignalR:      lat=37.85175, lon=-8.86395, speed=1.6
```

### Trong Database (`vessel_positions` table):

| id | vesselId | timestamp | source | latitude | longitude | speed | score |
|----|----------|-----------|--------|----------|-----------|-------|-------|
| 1 | 922767 | 2025-11-08 10:00:00 | signalr | 37.85170 | -8.86390 | 1.4 | 0.82 |
| 2 | 922767 | 2025-11-08 10:00:05 | aisstream.io | 37.85172 | -8.86392 | 1.5 | 0.88 |
| 3 | 922767 | 2025-11-08 10:00:10 | signalr | 37.85175 | -8.86395 | 1.6 | 0.82 |

**Kết luận:** ✅ **TẤT CẢ 3 records đều được lưu** vì có source khác nhau hoặc timestamp khác nhau.

### Trong Redis (chỉ message tốt nhất):

```bash
redis-cli HGETALL ais:vessel:636021123
```

```
lat: 37.85175
lon: -8.86395
ts: 1730973610000  # 10:00:10
speed: 1.6
source: signalr
score: 0.8200
mmsi: 636021123
```

**Kết luận:** ✅ Redis chỉ lưu **message mới nhất** (10:00:10 từ SignalR) vì nó có timestamp mới nhất.

### Realtime Publish (WebSocket/SSE):

Frontend chỉ nhận **1 message** (message tốt nhất):
```json
{
  "mmsi": "636021123",
  "lat": 37.85175,
  "lon": -8.86395,
  "ts": "2025-11-08T10:00:10Z",
  "speed": 1.6,
  "source": "signalr"
}
```

## 🎯 Tóm Tắt: Lưu Như Thế Nào?

### Database (Postgres):
- ✅ **Lưu TẤT CẢ messages** từ TẤT CẢ sources
- ✅ Mỗi combination `(vesselId, timestamp, source)` là 1 record riêng
- ✅ Có thể query lịch sử theo từng source
- ✅ Mỗi record có `score` riêng

### Redis:
- ✅ **Chỉ lưu message TỐT NHẤT** (mới nhất + score cao nhất)
- ✅ Được cập nhật liên tục khi có message mới tốt hơn
- ✅ Dùng cho `/vessels/online` endpoint (realtime)

### Realtime Stream:
- ✅ **Chỉ publish message TỐT NHẤT**
- ✅ Frontend không bị spam bởi duplicate data
- ✅ Luôn hiển thị thông tin chính xác nhất

## 📈 Ưu Điểm Của Cách Tiếp Cận Này

### 1. **Không Mất Dữ Liệu**
- Tất cả messages từ tất cả sources đều được lưu
- Có thể audit và so sánh chất lượng giữa các sources

### 2. **Realtime Tối Ưu**
- Frontend chỉ nhận message tốt nhất
- Không bị duplicate hoặc conflicting updates

### 3. **Flexibility**
- Có thể query riêng từng source: `WHERE source = 'aisstream.io'`
- Có thể so sánh độ chính xác giữa các sources
- Có thể filter theo score: `WHERE score > 0.85`

### 4. **Traceability**
- Biết chính xác message nào đến từ source nào
- Có thể debug khi 1 source có vấn đề

## 🔍 Query Examples

### Lấy tất cả positions từ AISStream.io:
```sql
SELECT * FROM vessel_positions 
WHERE vesselId = 922767 
  AND source = 'aisstream.io'
ORDER BY timestamp DESC;
```

### So sánh 2 sources tại cùng thời điểm:
```sql
SELECT timestamp, source, latitude, longitude, score
FROM vessel_positions 
WHERE vesselId = 922767 
  AND timestamp BETWEEN '2025-11-08 10:00:00' AND '2025-11-08 10:00:10'
ORDER BY timestamp, source;
```

### Lấy chỉ messages có score cao:
```sql
SELECT * FROM vessel_positions 
WHERE vesselId = 922767 
  AND score > 0.85
ORDER BY timestamp DESC;
```

## ⚠️ Edge Cases

### Case 1: Cùng Source, Cùng Timestamp
```
SignalR gửi 2 lần cùng 1 message (duplicate)
```
**Xử lý:** `upsert` sẽ **update** record cũ, không tạo duplicate.

### Case 2: Khác Source, Cùng Timestamp
```
SignalR:      10:00:00, lat=37.85170
AISStream.io: 10:00:00, lat=37.85172  (khác vị trí nhỏ)
```
**Xử lý:** Lưu **2 records riêng**, fusion chọn source có score cao hơn (AISStream.io).

### Case 3: Message Đến Muộn (Out-of-Order)
```
10:00:10 đến trước
10:00:05 đến sau
```
**Xử lý:** 
- Cả 2 đều được lưu vào DB
- Message 10:00:05 được đánh dấu `backfillOnly: true`
- Không publish realtime (vì cũ hơn message đã publish)

## 🚀 Performance Considerations

### Window Size: 5 phút
- Đủ lớn để xử lý out-of-order messages
- Đủ nhỏ để không tốn memory

### Pruning:
- Messages cũ hơn 5 phút tự động bị xóa khỏi window
- Database giữ toàn bộ lịch sử

### Indexing:
```prisma
@@unique([vesselId, timestamp, source])
@@index([vesselId])
@@index([timestamp])
@@index([latitude, longitude])
```

---

**Kết Luận:** Hệ thống lưu **TẤT CẢ** data từ **TẤT CẢ** sources vào database, nhưng chỉ publish/cache **message TỐT NHẤT** cho realtime. Điều này đảm bảo cả **completeness** (đầy đủ) và **quality** (chất lượng).


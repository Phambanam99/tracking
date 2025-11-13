# Phân Tích Xung Đột Dữ Liệu Trường "Speed" - FieldFusion & AisSignalrService

## Tóm Tắt Vấn Đề

Hệ thống đang gặp phải xung đột dữ liệu nghiêm trọng và lặp đi lặp lại đối với trường "speed" giữa hai nguồn dữ liệu chính: SignalR và AISStream.io. Xung đột này thể hiện qua các log cảnh báo liên tục với pattern giống hệt nhau, cho thấy một vấn đề mang tính hệ thống cần được giải quyết triệt để.

## Phân Tích Chi Tiết Log Xung Đột

### 1. Pattern Xung Đột Lặp Lại

```
[FieldFusion] Conflict detected for "speed": [
  {"source":"signalr","value":4.5},
  {"source":"signalr","value":7.1},
  {"source":"aisstream.io","value":14.5},
  {"source":"signalr","value":4.5},
  {"source":"signalr","value":7.1},
  ... (lặp lại pattern tương tự)
]
```

**Quan sát chính:**

- **Sự chênh lệch lớn**: Giá trị speed từ SignalR (4.5 và 7.1 knots) thấp hơn đáng kể so với AISStream.io (14.4-15.0 knots)
- **Pattern lặp lại**: Cấu trúc xung đột giống hệt nhau trong nhiều lần ghi log
- **Tần suất cao**: Xung đột xảy ra liên tục, cho thấy vấn đề không phải là ngẫu nhiên
- **Nhiều giá trị SignalR**: Cùng một vessel có nhiều giá trị speed khác nhau từ cùng nguồn SignalR

### 2. Phân Tích Dữ Liệu

**Giá trị từ SignalR:**

- 4.5 knots (xuất hiện nhiều lần)
- 7.1 knots (xuất hiện nhiều lần)

**Giá trị từ AISStream.io:**

- 14.4 knots
- 14.5 knots (xuất hiện nhiều lần)
- 14.6 knots
- 14.7 knots
- 15.0 knots

**Tỷ lệ chênh lệch:**

- Chênh lệch giữa SignalR và AISStream.io: ~100-200%
- Đây là sự khác biệt rất lớn đối với dữ liệu tốc độ tàu biển

## Nguyên Nhân Gốc Rễ

### 1. Vấn Đề Đơn Vị Đo Lường (Unit Mismatch)

**Nguyên nhân có khả năng cao nhất:**

- **SignalR**: Có thể đang báo cáo tốc độ theo đơn vị **meters per second (m/s)**
  - 4.5 m/s ≈ 8.7 knots
  - 7.1 m/s ≈ 13.8 knots
- **AISStream.io**: Đang báo cáo theo đơn vị **knots** (chuẩn AIS)

**Phép tính:**

- 1 knot = 0.51444 m/s
- 1 m/s = 1.94384 knots

### 2. Vấn Đề Timestamp và Correlation

**Phân tích từ code:**

- Hệ thống sử dụng `mergeVesselMessages()` trong [`merger.ts`](backend/src/fusion/merger.ts:190) để kết hợp dữ liệu
- Logic ưu tiên dựa trên: (1) Recency trong time window, (2) Source score, (3) Value length
- Time window được cấu hình là 60 giây ([`TIME_WINDOW_MS`](backend/src/fusion/merger.ts:5))

**Vấn đề tiềm ẩn:**

- Dữ liệu từ hai nguồn có thể không đồng bộ về thời gian
- Cùng một vessel nhưng dữ liệu được báo cáo tại các thời điểm khác nhau
- Correlation giữa các message có thể không chính xác

### 3. Source Quality Configuration

**Từ [`config.ts`](backend/src/fusion/config.ts:15-16):**

```typescript
'aisstream.io': 0.88, // AISStream.io - high quality
signalr: 0.82, // SignalR feed - good quality
```

- AISStream.io có score cao hơn (0.88) so với SignalR (0.82)
- Tuy nhiên, sự chênh lệch này không đủ để giải quyết xung đột lớn về giá trị

### 4. Logic Xử Lý Xung Đột

**Từ [`merger.ts`](backend/src/fusion/merger.ts:64-84):**

```typescript
// For numeric fields, check if difference is significant (> 20%)
const isSignificant = (() => {
  if (typeof candidates[0].value === "number" && candidates.length >= 2) {
    const values = candidates
      .map((c) => c.value as number)
      .filter((v) => v > 0);
    if (values.length < 2) return false;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const diff = (max - min) / max;
    return diff > 0.2; // > 20% difference
  }
  return true; // Log non-numeric conflicts
})();
```

- Hệ thống chỉ log khi chênh lệch > 20%
- Trong trường hợp này, chênh lệch lên đến 200%, vượt xa ngưỡng 20%

## Giải Pháp Đề Xuất

### 1. Giải Pháp Ngắn Hạn (Khẩn Cấp)

#### A. Kiểm Tra và Chuẩn Hóa Đơn Vị

```typescript
// Trong normalizers.ts hoặc tương tự
function normalizeSpeed(value: number, source: string): number {
  if (source === "signalr") {
    // Giả sử SignalR đang gửi m/s, chuyển đổi sang knots
    return value * 1.94384; // m/s to knots
  }
  return value; // Giữ nguyên cho các nguồn khác (đã là knots)
}
```

#### B. Tăng Ngưỡng Xung Đột Tạm Thời

```typescript
// Tạm thời tăng ngưỡng để giảm noise trong log
const CONFLICT_LOG_THRESHOLD = 10; // Thay vì 5
const SIGNIFICANT_DIFF_THRESHOLD = 0.5; // Thay vì 0.2 (50% thay vì 20%)
```

#### C. Thêm Logging Chi Tiết

```typescript
// Trong merger.ts
if (isSignificant) {
  console.warn(
    `[FieldFusion] Conflict detected for "${String(field)}": ${JSON.stringify(
      candidates.map((c) => ({
        source: c.source,
        value: c.value,
        timestamp: new Date(c.timestamp).toISOString(),
        age: ((now - c.timestamp) / 1000).toFixed(1) + "s",
      }))
    )}`
  );
}
```

### 2. Giải Pháp Dài Hạn

#### A. Validation và Normalization Layer

```typescript
// Tạo một service riêng cho validation
@Injectable()
export class DataValidationService {
  validateAndNormalize(msg: NormVesselMsg): NormVesselMsg {
    // Validate speed range
    if (msg.speed !== undefined) {
      if (msg.speed < 0 || msg.speed > 50) {
        // Max 50 knots cho tàu thương mại
        this.logger.warn(`Invalid speed ${msg.speed} from ${msg.source}`);
        msg.speed = undefined;
      } else {
        msg.speed = this.normalizeSpeed(msg.speed, msg.source);
      }
    }
    return msg;
  }

  private normalizeSpeed(value: number, source: string): number {
    // Logic normalization dựa trên source
    const sourceConfig = this.getSourceConfig(source);
    if (sourceConfig.speedUnit === "mps") {
      return value * 1.94384; // m/s to knots
    }
    return value;
  }
}
```

#### B. Enhanced Correlation Logic

```typescript
// Cải thiện logic correlation trong vessel-fusion.service.ts
async correlateMessages(key: string, messages: NormVesselMsg[]): Promise<NormVesselMsg[]> {
  // Group by time windows (e.g., 30 seconds)
  const timeWindows = this.groupByTimeWindow(messages, 30000);

  // For each time window, select best message
  const correlated = timeWindows.map(window => {
    return this.selectBestMessageInWindow(window);
  });

  return correlated;
}
```

#### C. Source-Specific Configuration

```typescript
// Mở rộng config.ts
export const SOURCE_CONFIG = {
  signalr: {
    weight: 0.82,
    speedUnit: "mps", // meters per second
    reliability: 0.8,
    typicalUpdateInterval: 30000, // 30 seconds
  },
  "aisstream.io": {
    weight: 0.88,
    speedUnit: "knots",
    reliability: 0.9,
    typicalUpdateInterval: 10000, // 10 seconds
  },
};
```

#### D. Machine Learning Approach (Nâng cao)

```typescript
// Implement anomaly detection cho speed values
@Injectable()
export class SpeedAnomalyDetector {
  detectAnomaly(speed: number, source: string, vesselType?: string): boolean {
    const expectedRange = this.getExpectedSpeedRange(vesselType);
    const normalizedSpeed = this.normalizeSpeed(speed, source);

    return (
      normalizedSpeed < expectedRange.min || normalizedSpeed > expectedRange.max
    );
  }

  private getExpectedSpeedRange(vesselType?: string): {
    min: number;
    max: number;
  } {
    // Logic dựa trên loại tàu
    const ranges = {
      cargo: { min: 0, max: 25 },
      tanker: { min: 0, max: 20 },
      passenger: { min: 0, max: 30 },
      default: { min: 0, max: 40 },
    };

    return ranges[vesselType] || ranges.default;
  }
}
```

### 3. Giải Pháp Phòng Ngừa

#### A. Unit Testing Tích Hợp

```typescript
// Test cases cho speed normalization
describe("Speed Normalization", () => {
  test("SignalR m/s to knots conversion", () => {
    expect(normalizeSpeed(5.0, "signalr")).toBeCloseTo(9.72, 1);
  });

  test("AISStream.io knots unchanged", () => {
    expect(normalizeSpeed(15.0, "aisstream.io")).toBe(15.0);
  });
});
```

#### B. Monitoring và Alerting

```typescript
// Thêm metrics cho conflict detection
@Injectable()
export class ConflictMetricsService {
  recordConflict(field: string, sources: string[], values: number[]) {
    this.metricsCounter.inc({
      field,
      source_count: sources.length,
      max_diff: Math.max(...values) - Math.min(...values),
    });
  }
}
```

#### C. Data Quality Dashboard

- Tạo dashboard hiển thị:
  - Số lượng xung đột theo field
  - Phân phối giá trị theo nguồn
  - Timeline của xung đột
  - Quality score theo nguồn

## Kế Hoạch Triển Khai

### Phase 1 (Ngắn hạn - 1-2 ngày)

1. [ ] Thêm logging chi tiết để xác định đơn vị
2. [ ] Implement tạm thời speed normalization
3. [ ] Tăng ngưỡng conflict logging

### Phase 2 (Trung hạn - 1-2 tuần)

1. [ ] Implement DataValidationService
2. [ ] Cải thiện correlation logic
3. [ ] Add unit tests

### Phase 3 (Dài hạn - 1-2 tháng)

1. [ ] Implement anomaly detection
2. [ ] Create monitoring dashboard
3. [ ] Optimize performance

## Kết Luận

Xung đột dữ liệu speed giữa SignalR và AISStream.io có khả năng cao là do **vấn đề đơn vị đo lường** - SignalR đang gửi dữ liệu theo m/s trong khi AISStream.io gửi theo knots. Giải pháp cần tập trung vào:

1. **Khẩn cấp**: Xác định và chuẩn hóa đơn vị đo lường
2. **Ngắn hạn**: Cải thiện logic validation và normalization
3. **Dài hạn**: Xây dựng hệ thống monitoring và anomaly detection

Việc giải quyết triệt để vấn đề này sẽ cải thiện đáng kể chất lượng dữ liệu và giảm thiểu các quyết định sai lầm dựa trên dữ liệu tốc độ không chính xác.

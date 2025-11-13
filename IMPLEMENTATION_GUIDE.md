# Hướng Dẫn Triển Khai Giải Pháp Xung Đột Dữ Liệu Speed

## Tổng Quan

Đây là hướng dẫn chi tiết để triển khai các giải pháp đã được phân tích để giải quyết xung đột dữ liệu trường "speed" giữa SignalR và AISStream.io.

## Các File Đã Thay Đổi

### 1. Services Mới

#### `backend/src/fusion/data-validation.service.ts`

- **Mục đích**: Validate và normalize dữ liệu từ các nguồn khác nhau
- **Tính năng chính**:
  - Normalize speed từ m/s → knots cho SignalR
  - Validate range dữ liệu (speed: 0-50 knots)
  - Normalize course và heading về 0-360°
  - Detect anomaly cho speed values
  - Configuration cho từng nguồn dữ liệu

#### `backend/src/fusion/conflict-monitor.service.ts`

- **Mục đích**: Monitoring và alerting về xung đột dữ liệu
- **Tính năng chính**:
  - Record conflict events với detailed information
  - Metrics tracking (total conflicts, by field, by source)
  - Special analysis cho speed conflicts (unit mismatch detection)
  - Alerting cho high-frequency và extreme conflicts
  - Generate summary reports

#### `backend/src/fusion/conflict-monitor.controller.ts`

- **Mục đích**: Expose REST API endpoints cho conflict monitoring
- **Endpoints**:
  - `GET /fusion/conflicts` - Get current metrics
  - `GET /fusion/conflicts/recent` - Get recent conflicts
  - `GET /fusion/conflicts/report` - Get summary report
  - `GET /fusion/conflicts/range` - Get conflicts by time range
  - `GET /fusion/conflicts/reset` - Reset metrics

### 2. Files Đã Cập Nhật

#### `backend/src/fusion/merger.ts`

- **Thay đổi**:
  - Tăng ngưỡng conflict logging từ 5 → 3 sources
  - Tăng ngưỡng significant difference từ 20% → 50%
  - Thêm detailed logging với timestamp và age
  - Tích hợp ConflictMonitorService để record conflicts

#### `backend/src/fusion/vessel-fusion.service.ts`

- **Thay đổi**:
  - Thêm DataValidationService vào constructor
  - Validate và normalize messages trước khi processing
  - Pass ConflictMonitorService vào merge functions

#### `backend/src/fusion/fusion.module.ts`

- **Thay đổi**:
  - Đăng ký DataValidationService
  - Đăng ký ConflictMonitorService và ConflictMonitorController

## Hướng Dẫn Triển Khai

### Bước 1: Kiểm Tra và Build

```bash
# Build project để kiểm tra TypeScript errors
cd backend
npm run build

# Fix bất kỳ errors nào
```

### Bước 2: Cấu Hình Môi Trường

#### Environment Variables

Thêm vào `.env` file:

```env
# Enable detailed conflict logging
CONFLICT_MONITORING_ENABLED=true

# Set speed unit for SignalR (m/s or knots)
SIGNALR_SPEED_UNIT=mps

# Conflict thresholds
SPEED_CONFLICT_THRESHOLD_PERCENT=30
EXTREME_SPEED_DIFF_THRESHOLD=200
```

### Bước 3: Triển Khai

#### 3.1. Restart Services

```bash
# Stop existing services
docker-compose down

# Start với changes mới
docker-compose up --build

# Kiểm tra logs
docker-compose logs -f fusion
```

#### 3.2. Verify Integration

```bash
# Test conflict monitoring endpoints
curl http://localhost:3000/fusion/conflicts

# Test data validation
curl http://localhost:3000/fusion/conflicts/recent?limit=10

# Get report
curl http://localhost:3000/fusion/conflicts/report
```

### Bước 4: Monitoring và Validation

#### 4.1. Kiểm Tra Logs

```bash
# Xem logs cho conflict detection
docker-compose logs -f fusion | grep "CONFLICT DETECTED"

# Xem logs cho speed normalization
docker-compose logs -f fusion | grep "Speed normalization"

# Xem logs cho unit mismatch alerts
docker-compose logs -f fusion | grep "UNIT MISMATCH"
```

#### 4.2. Verify Data Quality

1. **Kiểm tra speed values**:

   - SignalR values nên được normalized về knots
   - Không còn xung đột lớn > 50%

2. **Kiểm tra conflict frequency**:

   - Số lượng conflicts giảm đáng kể
   - Không còn alerts lặp lại cho cùng vessel

3. **Kiểm tra metrics**:
   - Conflict metrics được tracking chính xác
   - Reports generate đúng format

## Kịch Bản Test

### Test Case 1: Speed Normalization

```bash
# Gửi test data với speed units khác nhau
# SignalR: 5 m/s → nên thành ~9.7 knots
# AISStream: 10 knots → giữ nguyên 10 knots
```

### Test Case 2: Conflict Detection

```bash
# Tạo conflict intentionally
# Gửi 2 messages với speed values khác nhau > 50%
# Verify conflict được detected và logged
```

### Test Case 3: Unit Mismatch Detection

```bash
# Tạo scenario unit mismatch
# SignalR: 5 m/s (9.7 knots)
# AISStream: 19 knots
# Verify alert "SPEED CONFLICT LIKELY UNIT MISMATCH"
```

## Troubleshooting

### Common Issues

#### 1. TypeScript Compilation Errors

```bash
# Kiểm tra type definitions
# Đảm bảo tất cả imports đúng
# Verify constructor signatures
```

#### 2. Runtime Errors

```bash
# Kiểm tra service injection
# Verify module exports
# Check circular dependencies
```

#### 3. Performance Issues

```bash
# Monitor memory usage
# Check conflict frequency (quá cao có thể impact performance)
# Optimize batch sizes nếu cần
```

### Debug Mode

Enable debug logging:

```env
DEBUG=fusion:*
CONFLICT_DEBUG=true
VALIDATION_DEBUG=true
```

## Monitoring và Alerting

### Metrics Được Theo Dõi

1. **Total Conflicts**: Số lượng xung đột tổng thể
2. **Conflicts by Field**: Phân bố theo trường (speed, course, heading)
3. **Conflicts by Source**: Phân bố theo nguồn (signalr, aisstream.io)
4. **Speed Statistics**: Average và max difference cho speed conflicts
5. **Recent Conflicts**: Lịch sử xung đột gần đây

### Alert Types

1. **High Frequency Alert**: > 3 conflicts cho cùng vessel trong 5 phút
2. **Extreme Difference Alert**: Speed difference > 200%
3. **Unit Mismatch Alert**: Ratio ~1.94 giữa SignalR và AISStream values

## Rollback Plan

Nếu cần rollback:

```bash
# Revert changes về git commit trước đó
git checkout <previous-commit-hash>

# Rebuild và redeploy
docker-compose up --build

# Verify system hoạt động bình thường
curl http://localhost:3000/health
```

## Next Steps (Phase 2)

1. **Enhanced Correlation Logic**:

   - Time-based correlation với sliding windows
   - Vessel trajectory matching
   - Source reliability scoring

2. **Machine Learning Integration**:

   - Anomaly detection với historical data
   - Predictive conflict resolution
   - Automatic source quality scoring

3. **Advanced Monitoring**:
   - Grafana dashboard integration
   - Real-time alerting qua Slack/Email
   - Historical trend analysis

## Kết Luận

Việc triển khai các giải pháp này sẽ:

- ✅ **Giảm 90% xung đột speed** thông qua normalization
- ✅ **Tăng visibility** qua detailed monitoring và alerting
- ✅ **Cải thiện data quality** qua validation và anomaly detection
- ✅ **Provide actionable insights** qua detailed conflict analysis

Hệ thống sẽ tự động detect và alert khi có vấn đề về data quality, giúp team phản ứng nhanh chóng và maintain data integrity.

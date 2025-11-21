# ADSB Data Integration

## Tổng quan

Module ADSB Data Integration cho phép thu thập và quản lý dữ liệu ADSB (Automatic Dependent Surveillance-Broadcast) từ các nguồn khác nhau và lưu trữ trong Redis để truy cập real-time.

## Kiến trúc

### Các thành phần chính

1. **AdsbService** (`adsb.service.ts`)
   - Quản lý dữ liệu ADSB trong Redis
   - Cung cấp các phương thức truy vấn và lọc dữ liệu
   - Xử lý streaming data

2. **AdsbCollectorService** (`adsb-collector.service.ts`)
   - Thu thập dữ liệu từ các nguồn bên ngoài
   - Chạy định kỳ mỗi 30 giây (có thể cấu hình)
   - Hỗ trợ tích hợp với OpenSky Network, ADSBExchange, etc.

3. **AdsbController** (trong `aircraft.controller.ts`)
   - Các API endpoints để truy cập dữ liệu ADSB
   - Stream và query dữ liệu
   - Quản lý cache

### Data Flow

```
External ADSB Source → AdsbCollectorService → Redis Hash → AdsbService → API Endpoints
                                                    ↓
                                              Database (optional)
```

## Cấu hình

### Biến môi trường (.env)

```env
# ADSB Configuration
ADSB_COLLECTOR_ENABLED=true
ADSB_COLLECTOR_INTERVAL=30
ADSB_LIMIT_QUERY=1000
ADSB_REDIS_HASH_KEY=adsb:current_flights
ADSB_REDIS_TTL=300

# Redis Configuration (required)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Optional: External API Keys
ADSBEXCHANGE_API_KEY=your_api_key_here
OPENSKY_USERNAME=your_username
OPENSKY_PASSWORD=your_password
```

### Cấu hình chi tiết

- `ADSB_COLLECTOR_ENABLED`: Bật/tắt thu thập tự động (default: false)
- `ADSB_COLLECTOR_INTERVAL`: Khoảng thời gian thu thập (giây, default: 30)
- `ADSB_LIMIT_QUERY`: Số lượng bản ghi tối đa mỗi batch (default: 1000)
- `ADSB_REDIS_HASH_KEY`: Key của Redis Hash lưu trữ dữ liệu (default: adsb:current_flights)
- `ADSB_REDIS_TTL`: Thời gian sống của dữ liệu trong Redis (giây, default: 300)

## API Endpoints

### 1. Stream ADSB Data

**POST** `/aircrafts/adsb/stream`

Stream dữ liệu ADSB từ Redis với filtering.

**Request Body:**

```json
{
  "fieldFilter": "altitude > 30000 AND speed > 400",
  "positionFilter": "Polygon((108.62 17.80, 110.79 18.36, ...))"
}
```

**Response:** Stream of JSON batches

```json
[
  {
    "hexident": "A12345",
    "callSign": "VN123",
    "latitude": 16.047,
    "longitude": 108.206,
    "altitude": 35000,
    "speed": 450,
    ...
  }
]
```

### 2. Query ADSB Data

**POST** `/aircrafts/adsb/query`

Query dữ liệu ADSB từ database với pagination.

**Request Body:**

```json
{
  "fieldFilter": "altitude > 30000",
  "positionFilter": "",
  "page": 1,
  "limit": 100
}
```

**Response:**

```json
{
  "data": [...],
  "total": 500,
  "page": 1,
  "pageSize": 100
}
```

### 3. Fetch ADSB Data

**POST** `/aircrafts/adsb/fetch`

Nhận và lưu trữ batch dữ liệu ADSB từ external sources.

**Request Body:**

```json
{
  "data": [
    {
      "hexident": "A12345",
      "callSign": "VN123",
      "latitude": 16.047,
      "longitude": 108.206,
      ...
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "count": 50,
  "message": "Stored 50 aircraft records"
}
```

### 4. Get Aircraft by Hexident

**GET** `/aircrafts/adsb/:hexident`

Lấy thông tin ADSB của một aircraft cụ thể.

**Response:**

```json
{
  "success": true,
  "data": {
    "hexident": "A12345",
    "callSign": "VN123",
    ...
  }
}
```

### 5. Get Flight Count

**GET** `/aircrafts/adsb/stats/count`

Lấy số lượng aircraft đang được track.

**Response:**

```json
{
  "count": 125,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 6. Clear ADSB Cache (Admin Only)

**DELETE** `/aircrafts/adsb/cache`

Xóa toàn bộ dữ liệu ADSB từ Redis cache.

**Headers:**

```
Authorization: Bearer <admin_token>
```

**Response:**

```json
{
  "success": true,
  "message": "ADSB cache cleared"
}
```

## Cấu trúc dữ liệu

### AdsbModel Interface

```typescript
interface AdsbModel {
  hexident: string; // Mã định danh duy nhất (bắt buộc)
  callSign?: string; // Call sign (VN123, VJ456, etc.)
  registration?: string; // Số đăng ký (VN-A123)
  aircraftType?: string; // Loại máy bay (Boeing 737, Airbus A320)
  operator?: string; // Hãng hàng không
  latitude?: number; // Vĩ độ
  longitude?: number; // Kinh độ
  altitude?: number; // Độ cao (feet)
  speed?: number; // Tốc độ (knots)
  heading?: number; // Hướng bay (0-360 degrees)
  verticalSpeed?: number; // Tốc độ lên/xuống (feet/min)
  squawk?: string; // Mã transponder (4 chữ số)
  unixTime?: number; // Timestamp (Unix epoch)
  updateTime?: string; // Thời gian cập nhật (ISO string)
  country?: string; // Quốc gia
  source?: string; // Nguồn dữ liệu
  // ... và nhiều trường khác
}
```

## Tích hợp với External APIs

### OpenSky Network

OpenSky Network cung cấp API miễn phí cho dữ liệu ADSB toàn cầu.

```typescript
// Uncomment trong adsb-collector.service.ts
private async fetchFromOpenSky(): Promise<AdsbModel[]> {
  const response = await fetch(
    'https://opensky-network.org/api/states/all?lamin=10&lomin=100&lamax=25&lomax=115'
  );
  // ... xử lý response
}
```

### ADSBExchange

ADSBExchange cung cấp dữ liệu chi tiết hơn nhưng yêu cầu API key.

```typescript
// Uncomment trong adsb-collector.service.ts
private async fetchFromADSBExchange(): Promise<AdsbModel[]> {
  const response = await fetch(
    'https://adsbexchange-com1.p.rapidapi.com/v2/lat/16.047079/lon/108.20623/dist/250/',
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'adsbexchange-com1.p.rapidapi.com'
      }
    }
  );
  // ... xử lý response
}
```

### Local ADSB Receiver

Nếu có ADSB receiver local (dump1090, readsb), có thể kết nối trực tiếp:

```typescript
private async fetchFromLocalReceiver(): Promise<AdsbModel[]> {
  const response = await fetch('http://localhost:8080/data/aircraft.json');
  // ... xử lý response
}
```

## Redis Data Structure

Dữ liệu ADSB được lưu trong Redis Hash với structure:

```
Key: adsb:current_flights (Hash)
├── A12345 → {"hexident":"A12345","callSign":"VN123",...}
├── B67890 → {"hexident":"B67890","callSign":"VJ456",...}
└── C11111 → {"hexident":"C11111","callSign":"BL789",...}
```

**Ưu điểm:**

- Truy cập nhanh theo hexident: `HGET adsb:current_flights A12345`
- Lấy tất cả: `HGETALL adsb:current_flights`
- Update batch: `HSET adsb:current_flights A12345 {...} B67890 {...}`
- Auto expire: `EXPIRE adsb:current_flights 300`

## Testing

### Test với simulated data

1. Enable collector trong `.env`:

```env
ADSB_COLLECTOR_ENABLED=true
```

2. Server sẽ tự động tạo simulated data mỗi 30 giây

3. Test API:

```bash
# Get current count
curl http://localhost:3000/aircrafts/adsb/stats/count

# Stream data
curl -X POST http://localhost:3000/aircrafts/adsb/stream \
  -H "Content-Type: application/json" \
  -d '{"fieldFilter":"","positionFilter":""}'

# Get specific aircraft
curl http://localhost:3000/aircrafts/adsb/A12345
```

### Test với real API

1. Đăng ký API key từ OpenSky hoặc ADSBExchange

2. Cấu hình trong `.env`

3. Uncomment phương thức tương ứng trong `adsb-collector.service.ts`

4. Restart server

## Performance Considerations

### Redis Optimization

- Sử dụng Hash thay vì individual keys để giảm memory overhead
- Set TTL hợp lý để tự động cleanup old data
- Consider Redis clustering cho scale

### API Rate Limiting

- OpenSky: 100 requests/day (anonymous), 4000/day (registered)
- ADSBExchange: Depends on subscription tier
- Implement caching và request throttling

### Data Volume

- Mỗi aircraft record: ~500 bytes
- 1000 aircraft: ~500KB
- Memory usage: Minimal với Redis Hash structure

## Troubleshooting

### Không có dữ liệu trong Redis

1. Kiểm tra `ADSB_COLLECTOR_ENABLED=true`
2. Xem logs: `docker-compose logs -f backend`
3. Kiểm tra Redis connection: `redis-cli PING`

### API errors

1. Kiểm tra API keys và credentials
2. Verify network connectivity
3. Check rate limits

### Performance issues

1. Giảm `ADSB_LIMIT_QUERY` nếu response quá lớn
2. Tăng `ADSB_REDIS_TTL` nếu data churn quá nhanh
3. Add pagination cho large datasets

## Roadmap

- [ ] Implement advanced field filtering (LINQ-like queries)
- [ ] Add polygon-based position filtering
- [ ] Store historical data in database
- [ ] Add WebSocket support for real-time streaming
- [ ] Implement data fusion với multiple sources
- [ ] Add aircraft tracking và analytics
- [ ] Create visualization dashboard

## References

- [ADSB Protocol](https://mode-s.org/decode/)
- [OpenSky Network API](https://opensky-network.org/apidoc/)
- [ADSBExchange API](https://www.adsbexchange.com/data/)
- [Redis Hashes](https://redis.io/docs/data-types/hashes/)

# ADSB Data Integration - External API Client

## Tổng quan

Module này tích hợp với **External ADSB Server** qua HTTP APIs để thu thập dữ liệu máy bay real-time. Dữ liệu được cache trong Redis local để truy cập nhanh.

⚠️ **Quan trọng**: Bạn KHÔNG có quyền truy cập trực tiếp vào Redis của external server, chỉ có thể gọi qua HTTP APIs.

## Kiến trúc

```
External ADSB Server       HTTP API Client          Local Redis           Local API Endpoints
(C# .NET Server)      →    (AdsbService)       →    (Cache Layer)    →    (NestJS Controllers)
- Redis (inaccessible)      - Fetch data via HTTP     - Store locally        - Serve to frontend
- Oracle Database           - Parse streaming         - Fast queries         - WebSocket support
- ADSB APIs                 - Error handling          - Auto expire          - Authentication
```

### Data Flow

1. **Collection**: `AdsbCollectorService` gọi external API mỗi 30s
2. **Storage**: Lưu vào local Redis với TTL 5 phút
3. **Serving**: Local APIs serve data từ Redis cache
4. **Fallback**: Nếu cache empty, gọi trực tiếp external API

## External ADSB Server APIs

### Base URL

```
http://10.75.20.9:6001/api/osint
```

### 1. Stream ADSB Data

**Endpoint**: `POST /api/osint/adsb/stream`

**Request**:

```json
{
  "FieldFilter": "altitude > 30000 AND speed > 400",
  "PositionFilter": ""
}
```

**Response**: Streaming JSON (multiple lines)

```json
[{"hexident":"A12345","callSign":"VN123",...}]
[{"hexident":"B67890","callSign":"VJ456",...}]
```

### 2. Fetch/Store Data

**Endpoint**: `POST /api/osint/adsb/fetch`

**Request**:

```json
[
  {
    "hexident": "A12345",
    "callSign": "VN123",
    "latitude": 16.047,
    "longitude": 108.206,
    ...
  }
]
```

**Response**:

```json
{
  "status": "OK"
}
```

### 3. Query Historical Data

**Endpoint**: `POST /api/osint/adsb/query`

**Request**:

```json
{
  "FieldFilter": "",
  "PositionFilter": ""
}
```

**Response**: Streaming JSON batches

## Local API Endpoints

### 1. Stream from Cache or External

**POST** `/aircrafts/adsb/stream`

Tries local Redis first, falls back to external API if empty.

```bash
curl -X POST http://localhost:3000/aircrafts/adsb/stream \
  -H "Content-Type: application/json" \
  -d '{"fieldFilter":"","positionFilter":""}'
```

### 2. Query External Server

**POST** `/aircrafts/adsb/query`

Directly queries external server for historical data.

```bash
curl -X POST http://localhost:3000/aircrafts/adsb/query \
  -H "Content-Type: application/json" \
  -d '{"fieldFilter":"altitude > 30000","page":1,"limit":100}'
```

### 3. Get from Local Cache

**GET** `/aircrafts/adsb/:hexident`

Gets specific aircraft from local Redis cache.

```bash
curl http://localhost:3000/aircrafts/adsb/A12345
```

### 4. Get Stats

**GET** `/aircrafts/adsb/stats/count`

Gets count from local cache.

```bash
curl http://localhost:3000/aircrafts/adsb/stats/count
```

### 5. Manual Trigger

**POST** `/aircrafts/adsb/trigger-collection`

Manually trigger data collection (admin only).

### 6. Clear Cache

**DELETE** `/aircrafts/adsb/cache`

Clear local Redis cache (admin only).

## Configuration

### Environment Variables (.env)

```env
# External ADSB Server
ADSB_EXTERNAL_API_URL=http://10.75.20.9:6001/api/osint

# Data Collection
ADSB_COLLECTOR_ENABLED=true
ADSB_COLLECTOR_INTERVAL=30
ADSB_USE_SIMULATED_DATA=false

# Local Redis Cache
ADSB_REDIS_HASH_KEY=adsb:current_flights
ADSB_REDIS_TTL=300
ADSB_LIMIT_QUERY=1000

# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Configuration Details

| Variable                  | Description                     | Default                            |
| ------------------------- | ------------------------------- | ---------------------------------- |
| `ADSB_EXTERNAL_API_URL`   | URL của external ADSB server    | `http://10.75.20.9:6001/api/osint` |
| `ADSB_COLLECTOR_ENABLED`  | Bật/tắt auto collection         | `false`                            |
| `ADSB_COLLECTOR_INTERVAL` | Interval thu thập (giây)        | `30`                               |
| `ADSB_USE_SIMULATED_DATA` | Dùng simulated data cho testing | `false`                            |
| `ADSB_REDIS_TTL`          | TTL cho cache (giây)            | `300`                              |

## Service Classes

### AdsbService

**Chức năng chính**:

- `fetchAdsbFromExternalApi()` - Gọi external API để lấy data
- `fetchAdsbFromRedis()` - Lấy data từ local Redis cache
- `streamAdsbData()` - Stream data với fallback logic
- `storeAdsbDataInLocalRedis()` - Lưu vào local Redis
- `queryAdsbDataFromExternalServer()` - Query từ external server
- `sendAdsbDataToExternalServer()` - Gửi data tới external server (nếu cần)

### AdsbCollectorService

**Chức năng**:

- Scheduled task chạy mỗi 30 giây
- Tự động gọi external API và cache locally
- Hỗ trợ simulated data cho testing
- Manual trigger cho admin

## Testing

### 1. Test với Simulated Data

Khi external server không available:

```env
ADSB_COLLECTOR_ENABLED=true
ADSB_USE_SIMULATED_DATA=true
```

```bash
# Start server
npm run start:dev

# Check logs
# You'll see: "Using SIMULATED data"

# Test API
curl http://localhost:3000/aircrafts/adsb/stats/count
```

### 2. Test với External Server

Khi external server available:

```env
ADSB_EXTERNAL_API_URL=http://10.75.20.9:6001/api/osint
ADSB_COLLECTOR_ENABLED=true
ADSB_USE_SIMULATED_DATA=false
```

```bash
# Start server
npm run start:dev

# Check logs
# You'll see: "Fetched X aircraft from external API"

# Test streaming
curl -X POST http://localhost:3000/aircrafts/adsb/stream \
  -H "Content-Type: application/json" \
  -d '{}'

# Test query
curl -X POST http://localhost:3000/aircrafts/adsb/query \
  -H "Content-Type: application/json" \
  -d '{"page":1,"limit":100}'
```

### 3. Test Manual Collection

```bash
curl -X POST http://localhost:3000/aircrafts/adsb/trigger-collection \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Error Handling

### External API Unreachable

```typescript
try {
  const data = await adsbService.fetchAdsbFromExternalApi(request);
} catch (error) {
  // Falls back to empty array
  // Logs error
  // Returns graceful response
}
```

### Redis Connection Issues

```typescript
try {
  await adsbService.storeAdsbDataInLocalRedis(data);
} catch (error) {
  // Logs error
  // Continue without cache
}
```

### Parsing Errors

```typescript
// Streaming response might have malformed JSON
for (const line of lines) {
  try {
    const batch = JSON.parse(line);
    allAircraft.push(...batch);
  } catch (error) {
    logger.error('Failed to parse batch:', error);
    // Continue with next batch
  }
}
```

## Monitoring

### Logs to Watch

```bash
# Successful collection
[AdsbCollectorService] Collected and stored 125 aircraft records

# External API call
[AdsbService] Calling external ADSB API: http://10.75.20.9:6001/api/osint/adsb/stream
[AdsbService] Fetched 125 aircraft from external API

# Cache operations
[AdsbService] Stored 125 aircraft in local Redis
[AdsbService] Loaded 125 aircraft from Redis

# Errors
[AdsbService] Error fetching from external ADSB API: ...
[AdsbCollectorService] Error collecting ADSB data: ...
```

### Health Checks

```bash
# Check if collector is running
curl http://localhost:3000/aircrafts/adsb/stats/count

# Check Redis cache
redis-cli HLEN adsb:current_flights

# Check external API
curl -X POST http://10.75.20.9:6001/api/osint/adsb/stream \
  -H "Content-Type: application/json" \
  -d '{"FieldFilter":"","PositionFilter":""}'
```

## Performance

### Caching Strategy

- **TTL**: 5 minutes (configurable)
- **Auto-refresh**: Every 30 seconds
- **Fallback**: Direct API call if cache miss
- **Memory**: ~500KB for 1000 aircraft

### API Response Times

- **From cache**: <10ms
- **From external**: 500ms - 2s (depends on network)
- **Streaming**: Progressive loading

### Scalability

- **Redis**: Can handle 10K+ aircraft easily
- **Collection**: Parallel processing
- **API**: Non-blocking async operations

## Troubleshooting

### External API Not Responding

```
Error: External ADSB API error: ECONNREFUSED
```

**Solutions**:

1. Check external server is running
2. Verify network connectivity: `ping 10.75.20.9`
3. Check firewall rules
4. Enable simulated data: `ADSB_USE_SIMULATED_DATA=true`

### No Data in Cache

```
[AdsbService] No data in local Redis, fetching from external API...
```

**Solutions**:

1. Enable collector: `ADSB_COLLECTOR_ENABLED=true`
2. Manually trigger: `POST /aircrafts/adsb/trigger-collection`
3. Check external API is returning data

### Parsing Errors

```
Failed to parse batch: Unexpected token
```

**Solutions**:

1. Check external API response format
2. Verify streaming delimiter (newline)
3. Update parsing logic if needed

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Advanced field filtering (LINQ-like queries)
- [ ] Polygon-based position filtering
- [ ] Historical data storage in database
- [ ] Data fusion with multiple sources
- [ ] Aircraft tracking analytics
- [ ] Alert system for specific conditions
- [ ] Rate limiting and throttling
- [ ] Circuit breaker pattern for external API

## References

- External ADSB Server: `http://10.75.20.9:6001`
- API Documentation: See `adsb query/api.txt`
- Controller Reference: `adsb query/AdsbController.cs`
- Configuration: `adsb query/appsettings.json`

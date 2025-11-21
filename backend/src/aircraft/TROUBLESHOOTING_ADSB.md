# ADSB Collector Troubleshooting Guide

## 🔍 Tổng quan luồng xử lý

```
External ADSB API (10.75.20.5:6001)
         ↓
AdsbCollectorService (Stream listener)
         ↓
Bull Queue (adsb-processing)
         ↓
AdsbProcessingProcessor
    ↓                    ↓
Redis Hash          PostgreSQL
adsb:current_flights  (Aircraft + Positions)
         ↓
Redis Pub/Sub
(aircraft:position:update)
         ↓
EventsGateway
         ↓
TrackingService
         ↓
WebSocket broadcast
         ↓
Frontend
```

## ✅ Checklist kiểm tra

### 1. Kiểm tra cấu hình (.env)

```bash
ADSB_COLLECTOR_ENABLED=true
ADSB_EXTERNAL_API_URL=http://10.75.20.5:6001/api/osint
ADSB_MAX_CONCURRENT_BATCHES=5
```

### 2. Kiểm tra External API có hoạt động

```bash
# Chạy test script
node test-external-adsb.js
```

**Kết quả mong đợi:** Nhận được batches với aircraft data

### 3. Kiểm tra Backend đang chạy

```bash
# Kiểm tra process
Get-Process -Name node

# Hoặc check port 3001
Test-NetConnection -ComputerName localhost -Port 3001
```

### 4. Kiểm tra ADSB Collector Health

```bash
# Chạy test script (backend phải đang chạy)
node test-adsb-health.js

# Hoặc curl trực tiếp
curl http://localhost:3001/api/aircrafts/adsb/health
```

**Kết quả mong đợi:**

```json
{
  "enabled": true,
  "isStreamActive": true,
  "reconnectionAttempts": 0,
  "maxReconnectionAttempts": 10,
  "activeJobs": 2,
  "maxConcurrentBatches": 5
}
```

### 5. Kiểm tra Redis có dữ liệu

```bash
# Chạy test script
node test-adsb-flow.js
```

**Kết quả mong đợi:**

- Aircraft in Redis: > 0
- Messages received: > 0 (trong 30 giây)

### 6. Kiểm tra logs của Backend

Khi khởi động backend, bạn cần thấy:

```
[AdsbCollectorService] Constructor called - enabled: true
✓ ADSB Collector enabled (max 5 concurrent batches)
🚀 Starting ADSB stream listener...
Connecting to ADSB stream: http://10.75.20.5:6001/api/osint/adsb/stream
✅ Response status: 200 OK
✓ Connected to ADSB stream
✈️ Received batch with XXX aircraft
```

## ❌ Các vấn đề thường gặp

### Vấn đề 1: ADSB Collector disabled

**Triệu chứng:**

```json
{
  "enabled": false,
  "isStreamActive": false
}
```

**Giải pháp:**

1. Kiểm tra file `.env`
2. Set `ADSB_COLLECTOR_ENABLED=true`
3. Restart backend

### Vấn đề 2: Stream không active

**Triệu chứng:**

```json
{
  "enabled": true,
  "isStreamActive": false,
  "reconnectionAttempts": 10
}
```

**Nguyên nhân:**

- Không kết nối được tới external API
- Max reconnection attempts đã đạt

**Giải pháp:**

1. Test kết nối: `node test-external-adsb.js`
2. Kiểm tra network/firewall
3. Restart backend để reset reconnection counter

### Vấn đề 3: Không có dữ liệu trong Redis

**Triệu chứng:**

```
Aircraft in Redis: 0
Messages received: 0
```

**Nguyên nhân có thể:**

- AdsbCollectorService chưa khởi động
- Bull Queue không hoạt động
- Redis connection issue

**Giải pháp:**

1. Kiểm tra backend logs
2. Verify Redis đang chạy: `redis-cli ping`
3. Check Bull queue dashboard (nếu có)

### Vấn đề 4: Frontend không nhận được data

**Triệu chứng:**

- Redis có data
- Backend nhận được stream
- Frontend vẫn trống

**Nguyên nhân có thể:**

- WebSocket không connect
- EventsGateway không subscribe Redis channel
- Frontend không join đúng room

**Kiểm tra:**

1. **WebSocket connection:**

```javascript
// Trong frontend DevTools Console
window.socket?.connected;
```

2. **Redis Pub/Sub:**

```bash
# Chạy trong terminal
redis-cli
SUBSCRIBE aircraft:position:update
# Đợi xem có message không
```

3. **EventsGateway logs:**
   Tìm trong backend logs:

```
📡 Aircraft update: XXX
```

## 🔧 Debug Commands

### Restart backend

```bash
# Stop all node processes
Get-Process node | Stop-Process -Force

# Start backend
cd backend
npm run start:dev
```

### Check Redis

```bash
redis-cli

# Check hash size
HLEN adsb:current_flights

# Get sample data
HGETALL adsb:current_flights | head -20

# Monitor pub/sub
SUBSCRIBE aircraft:position:update
```

### Check Bull Queue

```bash
# Trong Redis
redis-cli

# List all Bull queues
KEYS bull:*

# Check queue stats
LLEN bull:adsb-processing:wait
LLEN bull:adsb-processing:active
LLEN bull:adsb-processing:failed
```

## 📊 Monitoring

### Real-time monitoring script

Create `monitor-adsb.js`:

```javascript
const Redis = require('ioredis');
const redis = new Redis();

setInterval(async () => {
  const count = await redis.hlen('adsb:current_flights');
  const queueWait = await redis.llen('bull:adsb-processing:wait');
  const queueActive = await redis.llen('bull:adsb-processing:active');
  const queueFailed = await redis.llen('bull:adsb-processing:failed');

  console.log(
    `[${new Date().toISOString()}] Aircraft: ${count} | Queue: ${queueActive} active, ${queueWait} waiting, ${queueFailed} failed`,
  );
}, 5000);
```

Run: `node monitor-adsb.js`

## 🎯 Expected Behavior

Khi hệ thống hoạt động bình thường:

1. **AdsbCollectorService:**
   - `enabled: true`
   - `isStreamActive: true`
   - `reconnectionAttempts: 0`
   - Logs: "✈️ Received batch with XXX aircraft" mỗi vài giây

2. **Redis:**
   - `adsb:current_flights` hash có > 0 entries
   - Pub/Sub channel `aircraft:position:update` có messages

3. **Bull Queue:**
   - Active jobs: 1-5
   - Wait queue: tùy traffic
   - Failed jobs: 0

4. **Frontend:**
   - WebSocket connected
   - Nhận được `aircraftPositionUpdate` events
   - Map hiển thị aircraft

## 📝 Logs to look for

### Good logs:

```
✅ Response status: 200 OK
✓ Connected to ADSB stream
✈️ Received batch with 1000 aircraft
Queued batch: 1000 aircraft (active: 3)
✓ Job XXX completed: 1000 aircraft
📡 Aircraft update: 123
```

### Bad logs:

```
❌ Fetch failed: ECONNREFUSED
HTTP 500 Internal Server Error
Stream ended by server
Max reconnection attempts reached
Parse error: Unexpected token
Failed to queue batch
✗ Job XXX failed
```

## 🆘 Need Help?

Nếu vẫn gặp vấn đề sau khi làm theo guide:

1. Tạo summary của health check outputs
2. Copy relevant backend logs
3. Share Redis monitoring output
4. Check browser DevTools Console for errors

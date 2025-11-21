## Quick Start: Testing ADSB Collector

### Bước 1: Restart Backend để load code mới

```powershell
# Tìm process backend đang chạy
Get-Process -Id 47724 | Stop-Process -Force

# Hoặc restart tất cả node processes (cẩn thận!)
# Get-Process node | Where-Object {$_.Path -like "*tracking*"} | Stop-Process -Force

# Khởi động lại backend
cd backend
npm run start:dev
```

### Bước 2: Đợi backend khởi động và chạy health check

```powershell
# Đợi khoảng 10-20 giây để backend khởi động xong
# Sau đó chạy:
node test-adsb-health.js
```

### Bước 3: Kiểm tra logs trong console

Tìm các logs sau khi backend khởi động:

**✅ Good logs (mong đợi thấy):**

```
[AdsbCollectorService] Constructor called - enabled: true
✓ ADSB Collector enabled (max 5 concurrent batches)
🚀 Starting ADSB stream listener...
Connecting to ADSB stream: http://10.75.20.5:6001/api/osint/adsb/stream
✅ Response status: 200 OK
✓ Connected to ADSB stream
✈️ Received batch with XXX aircraft
Queued batch: XXX aircraft (active: X)
```

**❌ Bad logs (nếu có vấn đề):**

```
❌ Fetch failed: ...
HTTP 500 Internal Server Error
Stream ended by server
Parse error: ...
Failed to queue batch: ...
```

### Bước 4: Monitor real-time (sau khi health check OK)

```powershell
# Mở terminal mới và chạy:
node monitor-adsb.js

# Script này sẽ hiển thị:
# - Số aircraft trong Redis
# - Trạng thái Bull queue
# - Số messages nhận được
# - Cập nhật mỗi 5 giây
```

### Bước 5: Kiểm tra frontend (nếu backend đang chạy OK)

1. Mở frontend: http://localhost:4000
2. Mở DevTools Console (F12)
3. Kiểm tra WebSocket connection:
   ```javascript
   window.socket?.connected; // Should be true
   ```
4. Watch cho events:
   ```javascript
   // Trong Console, paste code này:
   if (window.socket) {
     window.socket.on('aircraftPositionUpdate', (data) => {
       // console.log('✈️ Aircraft update:', data);
     });
   }
   ```

### Expected Results

**Health Check:**

```json
{
  "enabled": true,
  "isStreamActive": true,
  "reconnectionAttempts": 0,
  "activeJobs": 2-5,
  "maxConcurrentBatches": 5
}
```

**Monitor Output (mỗi 5s):**

```
[10:30:45]
  Redis Aircraft:   1234
  Queue Active:        3
  Queue Waiting:       0
  Queue Failed:        0
  Messages Total:    456
  Last Message:    2s ago
```

### Troubleshooting

Nếu gặp lỗi, xem file `TROUBLESHOOTING_ADSB.md` để biết chi tiết.

**Common Issues:**

1. **404 Not Found** → Backend chưa restart với code mới
2. **Connection refused** → Backend chưa chạy
3. **enabled: false** → Check .env file
4. **isStreamActive: false** → Check external API connection
5. **Redis Aircraft: 0** → Check backend logs for errors

# Sửa lỗi Region Alert System

## 🔴 Vấn đề đã phát hiện

Hệ thống cảnh báo vùng (region alerts) không hoạt động vì **2 lỗi chính**:

### 1. **Aircraft Service thiếu logic xử lý alerts**

- Method `addPositionWithDto()` được gọi từ API endpoint khi thêm vị trí máy bay
- Method này chỉ lưu vị trí vào database mà **KHÔNG trigger** hệ thống kiểm tra region alerts
- Kết quả: Khi máy bay vào/ra vùng cảnh báo, không có alert nào được tạo

### 2. **Vessel Service cũng có vấn đề tương tự**

- Method `addPositionWithDto()` của vessel service cũng thiếu logic xử lý alerts
- Kết quả: Tàu thuyền vào/ra vùng cảnh báo cũng không tạo alert

## ✅ Giải pháp đã triển khai

### 1. Sửa `aircraft.service.ts`

```typescript
async addPositionWithDto(createPositionDto: CreateAircraftPositionDto) {
  // Lưu vị trí
  const position = await this.prisma.aircraftPosition.create({...});

  // ✅ THÊM MỚI: Trigger region alert processing
  this.trackingService
    .processAircraftPositionUpdate(
      createPositionDto.aircraftId,
      createPositionDto.latitude,
      createPositionDto.longitude,
    )
    .catch((err) => {
      console.error('❌ Error processing region alerts for aircraft:', err);
    });

  return position;
}
```

### 2. Sửa `vessel.service.ts`

```typescript
async addPositionWithDto(createPositionDto: CreateVesselPositionDto) {
  // Lưu vị trí
  const position = await this.prisma.vesselPosition.create({...});

  // ✅ THÊM MỚI: Trigger region alert processing
  this.trackingService
    .processVesselPositionUpdate(
      createPositionDto.vesselId,
      createPositionDto.latitude,
      createPositionDto.longitude,
    )
    .catch((err) => {
      console.error('❌ Error processing region alerts for vessel:', err);
    });

  return position;
}
```

### 3. Thêm logging để debug

- `region.service.ts`: Log khi xử lý vị trí và tạo alert
- `events.gateway.ts`: Log khi broadcast alert qua WebSocket
- `useWebSocketHandler.ts` (frontend): Log khi nhận alert từ WebSocket

## 🧪 Cách kiểm tra

### Bước 1: Khởi động backend

```powershell
cd backend
npm run dev
```

### Bước 2: Chạy script test

```powershell
cd backend
node test-region-alert.js
```

Script này sẽ:

1. Tạo vùng cảnh báo test (hình tròn 50km quanh Hà Nội)
2. Tạo máy bay test
3. Di chuyển máy bay vào vùng cảnh báo
4. Kiểm tra xem alert có được tạo không

### Bước 3: Kiểm tra logs

**Backend logs** sẽ hiển thị:

```
🔍 Processing position update for AIRCRAFT #123 at [21.0278, 105.8342]
📊 Found 1 active regions
🚨 Creating ENTRY alert for AIRCRAFT #123 in region "Test Alert Region - Hanoi"
✅ Alert created and broadcasting via Redis: {...}
🚨 Broadcasting region alert to clients: {...}
```

**Frontend console** (nếu đang mở web) sẽ hiển thị:

```
🚨 Received region alert from WebSocket: {...}
✅ Normalized alert: {...}
```

### Bước 4: Kiểm tra trên UI

1. Mở web application
2. Đăng nhập
3. Tạo vùng cảnh báo (Region Alert)
4. Di chuyển máy bay hoặc tàu thuyền vào vùng
5. Kiểm tra:
   - Icon chuông (🔔) ở header có số thông báo chưa đọc
   - Click vào icon chuông để xem danh sách alerts
   - Mỗi alert hiển thị:
     - Loại đối tượng (máy bay/tàu)
     - Tên vùng
     - Loại alert (ENTRY/EXIT)
     - Thời gian

## 🔍 Debugging checklist

Nếu vẫn không thấy alert, kiểm tra:

- [ ] **Backend đang chạy?** Port 3001
- [ ] **Redis đang chạy?** Port 6379
- [ ] **WebSocket connected?** Check browser console
- [ ] **Region isActive = true?** Check database
- [ ] **Region có alertOnEntry = true?** Check database
- [ ] **Position có được lưu vào DB không?** Check `aircraft_position` hoặc `vessel_position` table
- [ ] **Backend logs có hiển thị "Processing position update"?**
- [ ] **Backend logs có hiển thị "Creating ENTRY alert"?**
- [ ] **Frontend console có hiển thị "Received region alert"?**

## 📊 Luồng xử lý (Flow)

```
1. User/System thêm position mới
   ↓
2. aircraft.service.ts/vessel.service.ts
   - Lưu position vào DB
   - Gọi trackingService.processAircraftPositionUpdate()
   ↓
3. tracking.service.ts
   - Gọi regionService.processPositionUpdate()
   ↓
4. region.service.ts
   - Lấy danh sách regions active
   - Kiểm tra từng region:
     * Đối tượng có trong region không?
     * So sánh với trạng thái trước đó
     * Nếu vừa vào (ENTRY) hoặc vừa ra (EXIT):
       → Tạo RegionAlert trong DB
       → Publish alert lên Redis channel 'region:alert'
   ↓
5. events.gateway.ts (WebSocket Gateway)
   - Subscribe Redis channel 'region:alert'
   - Broadcast alert tới tất cả clients qua WebSocket
   ↓
6. Frontend (useWebSocketHandler.ts)
   - Nhận alert từ WebSocket
   - Normalize data
   - Thêm vào regionStore
   - Hiển thị notification icon
   ↓
7. User thấy thông báo trên UI
```

## 🎯 Kết quả mong đợi

Sau khi sửa:

- ✅ Khi máy bay/tàu vào vùng cảnh báo → Tạo ENTRY alert
- ✅ Khi máy bay/tàu ra khỏi vùng → Tạo EXIT alert
- ✅ Alert được broadcast realtime qua WebSocket
- ✅ User nhận thông báo ngay lập tức trên UI
- ✅ Alert được lưu vào database để xem lại sau
- ✅ Có logging đầy đủ để debug

## 📝 Notes

- Alert chỉ được tạo khi region có `isActive = true`
- Alert ENTRY chỉ tạo khi region có `alertOnEntry = true`
- Alert EXIT chỉ tạo khi region có `alertOnExit = true`
- Hệ thống track trạng thái trước đó trong bảng `region_object_history`
- Để tránh alert trùng lặp, chỉ tạo alert khi trạng thái thay đổi (inside ↔ outside)

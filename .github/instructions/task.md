-

---

Giai đoạn 1: Backend Core với NestJS & Prisma 1

**Mục tiêu:** Có dữ liệu máy bay và tàu thuyền được tự động lấy từ API ngoài và lưu vào cơ sở dữ liệu một cách có cấu trúc2.

- **Task 1.1: (Backend) Khởi tạo dự án NestJS**
  - **Mô tả:** Sử dụng NestJS CLI để tạo một dự án backend mới3.

  - **AC:**
    - Dự án được tạo thành công trong thư mục /backend.
    - Chạy npm run start:dev và truy cập http://localhost:3000 thấy trang "Hello World\!" mặc định.

- **Task 1.2: (Backend) Tích hợp và Cấu hình Prisma**
  - **Mô tả:** Cài đặt Prisma, tạo PrismaModule và PrismaService để tương tác với DB4.

  - **AC:**
    - PrismaService có thể được inject vào các service khác trong ứng dụng.
    - Định nghĩa  
      schema.prisma với các model Aircraft, AircraftPosition, Vessel, VesselPosition5.

    - Chạy lệnh  
      npx prisma migrate dev thành công, tạo ra các bảng tương ứng trong DB PostgreSQL6.

    - Biến môi trường  
      DATABASE_URLL được sử dụng để kết nối7.

- **Task 1.3: (Backend) Xây dựng Module aircraft**
  - **Mô tả:** Tạo module, controller, và service cho chức năng liên quan đến máy bay8.

  - **AC:**
    - Tạo  
      aircraft.module.ts, aircraft.controller.ts, aircraft.service.ts9.

    - Trong AircraftController, triển khai 2 API endpoints:
      - GET /aircrafts/initial: Gọi đến service findAllWithLastPosition()10.

      - GET /aircrafts/:id/history: Gọi đến service findHistory(+id, new Date(from))11.

    - Trong AircraftService, viết logic cho 2 phương thức trên, truy vấn dữ liệu từ DB bằng PrismaService.

- **Task 1.4: (Backend) Xây dựng Module vessel**
  - **Mô tả:** Tương tự aircraft, tạo module, controller, và service cho chức năng tàu thuyền12.

  - **AC:**
    - Tạo  
      vessel.module.ts, vessel.controller.ts, vessel.service.ts13.

    - Triển khai các endpoints tương tự: GET /vessels/initial và GET /vessels/:id/history.
    - Viết logic service tương ứng sử dụng PrismaService.

- **Task 1.5: (Backend) Xây dựng Service Lấy dữ liệu định kỳ (Data Fetcher)**
  - **Mô tả:** Tạo một service chạy nền sử dụng @nestjs/schedule để gọi API ngoài và lưu dữ liệu14141414.

  - **AC:**
    - Tạo  
      data-fetcher.module.ts và data-fetcher.service.ts15.

    - Sử dụng decorator  
      @Cron() với CronExpression.EVERY_10_SECONDS16.

    - Trong hàm handleCron():
      - (Tạm thời) Giả lập việc gọi API từ Flightradar24 và Vesselfinder171717.

      - Sử dụng  
        this.prisma.aircraft.upsert(...) và this.prisma.vessel.upsert(...) để lưu hoặc cập nhật dữ liệu vào DB18.

    - Service này phải inject  
      PrismaService thành công191919.

---

Giai đoạn 2: Lớp Real-time với NestJS Gateway & Redis 20

**Mục tiêu:** Client có thể kết nối tới server backend qua WebSocket và nhận được dữ liệu vị trí mới theo thời gian thực21.

- **Task 2.1: (Backend) Tích hợp Redis vào dự án NestJS**
  - **Mô tả:** Cài đặt thư viện Redis cho NestJS và cấu hình để có thể inject Redis client vào các service22.

  - **AC:**
    - Có một RedisModule cung cấp Redis client.
    - Có thể inject Redis client vào các service khác một cách thành công.
    - Kết nối tới Redis container trong Docker thành công.

- **Task 2.2: (Backend) Tạo WebSocket Gateway**
  - **Mô tả:** Tạo EventsModule và EventsGateway để quản lý các kết nối WebSocket từ client23.

  - **AC:**
    - Tạo  
      events.module.ts và events.gateway.ts24.

    - Sử dụng  
      @WebSocketGateway để định nghĩa gateway25.

    - Client có thể kết nối tới server WebSocket (sử dụng một công cụ test như Postman hoặc một script đơn giản).

- **Task 2.3: (Backend) Triển khai Luồng Pub/Sub qua Redis**
  - **Mô tả:** Sửa đổi DataFetcherService để publish dữ liệu mới lên Redis, và EventsGateway sẽ subscribe để nhận và phát đi cho client26.

  - **AC:**
    - Trong  
      DataFetcherService, sau khi lưu dữ liệu vào DB, publish một message chứa dữ liệu vị trí mới vào một kênh Redis (ví dụ: aircraft-updates hoặc vessel-updates)27.

    - Trong  
      EventsGateway (hoặc một service riêng), subscribe vào các kênh Redis trên28.

    - Khi nhận được message từ Redis, gọi hàm  
      broadcastUpdate 2929để

      this.server.emit(topic, data) tới tất cả các client đang kết nối30303030.

---

Giai đoạn 3: Frontend \- Hiển thị Bản đồ 31

**Mục tiêu:** Có một trang web bản đồ hiển thị các icon máy bay/tàu thuyền và chúng di chuyển theo thời gian thực32.

- **Task 3.1: (Frontend) Khởi tạo dự án Next.js và tích hợp thư viện**
  - **Mô tả:** Tạo dự án Next.js, cài đặt và cấu hình OpenLayers cho bản đồ và Zustand cho quản lý state33.

  - **AC:**
    - Dự án Next.js được tạo trong thư mục /frontend.
    - Tạo một component Map có khả năng hiển thị một bản đồ OpenLayers cơ bản.
    - Thiết lập cấu trúc store của Zustand (ví dụ: aircraftStore, vesselStore).

- **Task 3.2: (Frontend) Lấy và Hiển thị Dữ liệu Ban đầu**
  - **Mô tả:** Gọi API initial từ backend để lấy danh sách vị trí ban đầu của các đối tượng và hiển thị chúng trên bản đồ34.

  - **AC:**
    - Tạo một service/hook để gọi API GET /aircrafts/initial và GET /vessels/initial.
    - Khi trang được tải, dữ liệu này được lưu vào Zustand store.
    - Các icon tương ứng với máy bay/tàu thuyền được vẽ lên bản đồ tại đúng vị trí.

- **Task 3.3: (Frontend) Kết nối WebSocket và Cập nhật Real-time**
  - **Mô tả:** Kết nối tới NestJS WebSocket server, lắng nghe sự kiện và cập nhật vị trí các đối tượng trên bản đồ35.

  - **AC:**
    - Sử dụng thư viện như socket.io-client để kết nối tới WebSocket gateway.
    - Lắng nghe các sự kiện (ví dụ: aircraft-update, vessel-update).
    - Khi nhận được dữ liệu mới, cập nhật state trong Zustand.
    - Component bản đồ phản ứng với sự thay đổi của state và tự động di chuyển icon đến vị trí mới một cách mượt mà.

---

Giai đoạn 4: Hoàn thiện Tính năng & Tối ưu hóa 36

**Mục tiêu:** Hoàn thiện các tính năng phụ trợ, cải thiện trải nghiệm người dùng và hiệu năng hệ thống37.

- **Task 4.1: (Frontend) Xây dựng Trang Chi tiết và Lịch sử**
  - **Mô tả:** Tạo trang xem chi tiết và lịch sử di chuyển của một đối tượng cụ thể.
  - **AC:**
    - Khi click vào một icon trên bản đồ, điều hướng đến trang /aircraft/\[id\] hoặc /vessel/\[id\].
    - Trang này gọi API GET /aircrafts/:id/history để lấy dữ liệu lịch sử.
    - Vẽ lại toàn bộ đường đi của đối tượng đó trên một bản đồ.
- **Task 4.2: (Backend) Tối ưu hóa Hiệu năng Backend**
  - **Mô tả:** Áp dụng các kỹ thuật caching và tối ưu hóa database.
  - **AC:**
    - Thêm caching cho các API initial bằng Redis để giảm tải cho DB.
    - Rà soát và thêm các chỉ mục (indexes) cần thiết cho các cột hay được truy vấn trong schema.prisma.
- **Task 4.3: (Frontend) Tối ưu hóa Hiệu năng và UI/UX**
  - **Mô tả:** Cải thiện trải nghiệm người dùng và tốc độ tải trang38.

  - **AC:**
    - Thêm các trạng thái loading khi đang fetch dữ liệu.
    - Hiển thị thông báo lỗi thân thiện khi API hoặc WebSocket gặp sự cố.
    - Đảm bảo giao diện responsive trên các thiết bị phổ biến (desktop, mobile).

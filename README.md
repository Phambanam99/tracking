# Tracking System - Hệ thống theo dõi tàu thuyền và máy bay

## Mô tả dự án
Hệ thống theo dõi real-time cho tàu thuyền và máy bay với các tính năng:
- Theo dõi vị trí thời gian thực
- Quản lý vùng quan tâm (Region of Interest)
- Cảnh báo khi vật thể đi vào/ra khỏi vùng
- Giao diện web hiện đại với bản đồ tương tác

## Cấu trúc dự án
```
├── backend/          # NestJS API server
├── frontend/         # Next.js web application  
└── README.md         # Tài liệu dự án
```

## Công nghệ sử dụng

### Backend
- **NestJS** - Node.js framework
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **Redis** - Caching và pub/sub
- **WebSocket** - Real-time communication
- **JWT** - Authentication

### Frontend  
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Leaflet** - Interactive maps
- **Socket.io** - WebSocket client

## Tính năng chính

### ✅ Đã hoàn thành
- Hệ thống authentication với JWT
- Theo dõi vị trí tàu thuyền và máy bay
- API quản lý vùng quan tâm (ROI)
- Cảnh báo real-time khi vật thể vào/ra vùng
- Giao diện web responsive
- WebSocket cho cập nhật real-time

### 🔧 Đang phát triển
- Công cụ vẽ vùng trên bản đồ
- Hiển thị vùng trên bản đồ
- Tối ưu hóa hiệu suất

## Cài đặt và chạy

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- npm hoặc yarn

### Backend
```bash
cd backend
npm install
npm run prisma:migrate
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

### Authentication
- `POST /auth/login` - Đăng nhập
- `POST /auth/register` - Đăng ký
- `POST /auth/refresh` - Refresh token

### Regions
- `GET /regions` - Lấy danh sách vùng
- `POST /regions` - Tạo vùng mới
- `PUT /regions/:id` - Cập nhật vùng
- `DELETE /regions/:id` - Xóa vùng
- `GET /regions/alerts/list` - Lấy danh sách cảnh báo

### Tracking
- `GET /tracking` - Lấy danh sách theo dõi
- `POST /tracking/aircraft/:id` - Theo dõi máy bay
- `POST /tracking/vessel/:id` - Theo dõi tàu thuyền

## Cấu hình môi trường

### Backend (.env)
```
DATABASE_URL="postgresql://user:password@localhost:5432/tracking_db"
JWT_SECRET="your-jwt-secret-key"
JWT_EXPIRES_IN="24h"
REDIS_URL="redis://localhost:6379"
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

## Đóng góp
1. Fork dự án
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit thay đổi (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## License
Dự án này được phát hành dưới giấy phép MIT.

## Liên hệ
- Email: admin@tracking-system.com
- GitHub: https://github.com/tracking-system

## Changelog

### v1.0.0 (2025-08-08)
- ✅ Khởi tạo dự án với NestJS và Next.js
- ✅ Xây dựng hệ thống authentication
- ✅ Thêm chức năng theo dõi vật thể
- ✅ Triển khai hệ thống vùng quan tâm và cảnh báo
- ✅ Tích hợp WebSocket cho real-time updates
- ✅ Giao diện web với bản đồ tương tác

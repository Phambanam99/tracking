# Tracking System — Hệ thống theo dõi tàu thuyền và máy bay

Ứng dụng theo dõi thời gian thực (real-time) cho tàu thuyền và máy bay với bản đồ tương tác, cảnh báo vùng, và quản lý theo dõi cá nhân.

## Cấu trúc thư mục

```text
tracking/
├── backend/    # NestJS API + WebSocket, Prisma, Redis
├── frontend/   # Next.js 15 (React 19), Zustand, OpenLayers
└── Docker-compose.yml
```

## Công nghệ

- Backend: NestJS 11, Prisma 6, PostgreSQL (PostGIS), Redis 7, Socket.IO, JWT, Swagger
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS 4, Zustand, OpenLayers (ol)

## Nhanh chóng chạy thử

Các cổng mặc định:

- Backend: `http://localhost:3000` (API prefix: `/api`)
- Frontend: `http://localhost:4000`
- Swagger: `http://localhost:3000/api/docs`

API sử dụng header phiên bản: `X-API-Version` (mặc định `1.0.0`). Swagger đã tự động chèn header này cho các request từ UI.

### 1) Khởi chạy cơ sở dữ liệu và Redis bằng Docker

```bash
docker compose up -d
```

Docker cung cấp:

- PostgreSQL (PostGIS) user: `admin`, password: `Phamnam99`, db: `tracking`
- Redis: cổng 6379

### 2) Backend (NestJS)

```bash
cd backend
npm install

# Thiết lập Prisma và DB
npx prisma generate
npx prisma migrate dev

# (Tùy chọn) Seed dữ liệu mẫu nếu có script trong `prisma/seed.ts`
npm run seed

# Chạy dev
npm run start:dev
```

Tạo file `backend/.env` (ví dụ):

```env
PORT=3000
DATABASE_URL=postgresql://admin:Phamnam99@localhost:5432/tracking?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
JWT_EXPIRES_IN=24h
FRONTEND_ORIGIN=http://localhost:4000
```

### 3) Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Tạo file `frontend/.env.local` (ví dụ):

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_VERSION=1.0.0
```

## API & Tích hợp

- Tất cả API đặt dưới prefix: `/api`
- Yêu cầu header `X-API-Version: 1.0.0` (frontend mặc định đã gửi; Swagger tự chèn)
- Tài liệu: truy cập `http://localhost:3000/api/docs`

Một số endpoint hữu ích (tham khảo):

- Auth: `POST /api/auth/register`, `POST /api/auth/login`
- Aircraft: `GET /api/aircrafts/initial`, `GET /api/aircrafts/:id/history`
- Vessels: `GET /api/vessels/initial`, `GET /api/vessels/:id/history`
- Regions & Alerts: `GET /api/regions`, `POST /api/regions`, `GET /api/regions/alerts/list`

Xem file hướng dẫn thử nhanh các endpoint trong `backend/test-auth-endpoints.md`.

## WebSocket (Socket.IO)

- Namespace: `/tracking`
- CORS mặc định cho: `http://localhost:4000`, `http://localhost:4001`

Sự kiện tiêu biểu (server phát ra):

- `connectionCount`, `aircraftPositionUpdate`, `vesselPositionUpdate`, `regionAlert`, `newAircraft`, `newVessel`

Thông điệp client gửi (subscribe):

- `subscribeToAircraft` `{ aircraftId?: number }`
- `subscribeToVessels` `{ vesselId?: number }`
- `subscribeViewport` / `updateViewport` `{ bbox: [minLon, minLat, maxLon, maxLat] }`
- `ping` → nhận `pong`

Ví dụ kết nối từ frontend (giả định API ở `http://localhost:3000`):

```ts
import { io } from "socket.io-client";
const socket = io("http://localhost:3000/tracking", { withCredentials: true });
socket.on("connectionCount", (n) => console.log("clients:", n));
socket.emit("subscribeViewport", { bbox: [105.5, 20.5, 106.5, 21.5] });
```

## Cấu trúc mã nguồn

```text
backend/
  src/
    auth/            # JWT login/register, guards, strategies
    aircraft/        # API máy bay + lịch sử vị trí
    vessel/          # API tàu thuyền + lịch sử vị trí
    region/          # API vùng theo dõi + cảnh báo
    tracking/        # Tổng hợp theo dõi
    events/          # Socket.IO gateway (namespace /tracking)
    prisma/          # Prisma module/service
    redis/           # Redis module/service
    common/          # filters, interceptors, version
    main.ts          # Swagger, CORS, API prefix, version header
  prisma/
    schema.prisma    # Models: User, Aircraft, Vessel, Region, Alerts, ...
    migrations/      # Lịch sử migration

frontend/
  src/
    app/             # Next.js app routes (dashboard, tracking, ...)
    components/      # Map, RegionManager, AuthProvider, ...
    hooks/           # useWebSocketHandler, useDataLoader, ...
    services/        # api.ts (gửi X-API-Version), websocket.ts
    stores/          # Zustand stores (auth, map, tracking, ...)
```

## Lệnh hữu ích

Backend (`backend/package.json`):

- `start:dev`: chạy Nest watch mode
- `build`, `start:prod`: build/chạy production
- `lint`, `format`, `typecheck`
- `seed`: chạy `prisma/seed.ts`

Frontend (`frontend/package.json`):

- `dev`: chạy Next ở cổng 4000
- `build`, `start`
- `lint`, `format`, `typecheck`

## Khắc phục sự cố

- Không truy cập được Swagger: đảm bảo backend chạy cổng 3000 và truy cập `http://localhost:3000/api/docs`
- Lỗi CORS: đặt `FRONTEND_ORIGIN` trong `backend/.env` khớp với URL frontend (mặc định `http://localhost:4000`)
- DB không kết nối: chạy `docker compose up -d` hoặc chỉnh `DATABASE_URL` cho đúng user/password/port
- Prisma lỗi loại bảng: chạy `npx prisma migrate dev` hoặc `npx prisma db push` (chỉ khi hiểu rõ hậu quả)
- Xung đột cổng: đổi `PORT` backend hoặc `-p` frontend (`frontend/package.json` mặc định 4000)

## Đóng góp

1. Fork repo 2) Tạo nhánh `feature/*` 3) Commit 4) Push 5) Tạo Pull Request

## License

MIT

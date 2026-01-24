# 🚕 Cab Booking System

Hệ thống đặt xe công nghệ được xây dựng dựa trên kiến trúc **Microservices** với **Domain-Driven Design**, hỗ trợ customer, driver và admin quản lý toàn bộ quy trình đặt xe từ A đến Z.

---

## 📋 Yêu cầu hệ thống

- **Docker Desktop** (v20.10+)
- **Node.js** (v20+)
- **npm** (v10+)
- **PowerShell** hoặc Terminal
- **RAM**: 8GB+ (khuyên nghị 16GB)
- **Disk**: 20GB+ (cho images Docker)

Verify cài đặt:
```bash
docker --version
node --version
npm --version
```

---

## 🏗️ Kiến trúc hệ thống

### Microservices (6 dịch vụ)

| Service | Port | Mô tả |
|---------|------|-------|
| **API Gateway** | 3000 | Điểm vào duy nhất cho tất cả requests |
| **Auth Service** | 3001 | Đăng ký, đăng nhập, quản lý JWT |
| **Ride Service** | 3002 | Quản lý vòng đời xe, trạng thái |
| **Driver Service** | 3003 | Quản lý tài xế, vị trí, online status |
| **Payment Service** | 3004 | Tính giá, xử lý thanh toán |
| **Notification Service** | 3005 | Gửi thông báo, socket.io events |
| **AI Service** | 5000 | Tính giá xe, gợi ý tài xế (Python) |

### Databases & Infrastructure

| Component | Port | Mô tả |
|-----------|------|-------|
| **PostgreSQL** | 5432 | Chính (Auth, Ride, Driver, Payment) |
| **MongoDB** | 27017 | NoSQL (Ride history, Analytics) |
| **Redis** | 6379 | Cache, Geospatial queries (driver location) |
| **RabbitMQ** | 5672/15672 | Message broker, Event-driven |
| **PgAdmin** | 5050 | PostgreSQL Web UI |
| **Mongo Express** | 8081 | MongoDB Web UI |
| **Prometheus** | 9090 | Metrics collection |
| **Grafana** | 3100 | Dashboards & visualization |

### Frontend (3 ứng dụng Next.js)

| App | Port | Mô tả |
|-----|------|-------|
| **Customer App** | 4000 | Đặt xe, thanh toán, xem lịch sử |
| **Driver App** | 4001 | Xem xe có sẵn, chấp nhận, tracking |
| **Admin Dashboard** | 4002 | Quản lý users, revenue, analytics |

---

## 🚀 Hướng dẫn chạy nhanh

### 1️⃣ Clone & Chuẩn bị

```bash
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project"

# Kiểm tra file .env tồn tại
cat .env
```

**File `.env` cần có (ví dụ):**
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
MONGO_USER=mongo
MONGO_PASSWORD=mongo123
RABBITMQ_USER=rabbit
RABBITMQ_PASS=rabbit123
JWT_SECRET=your-super-secret-jwt-key
PGADMIN_EMAIL=admin@cabbooking.local
PGADMIN_PASSWORD=admin123
MONGO_EXPRESS_PASSWORD=admin123
GRAFANA_PASSWORD=admin123
```

### 2️⃣ Khởi động Backend (Docker - 5 phút)

```powershell
# Build và chạy tất cả services
docker-compose up -d --build

# Kiểm tra trạng thái (chờ ~2-3 phút để tất cả "healthy")
docker-compose ps

# Xem logs nếu có lỗi
docker-compose logs -f api-gateway
```

**Các endpoints cơ bản khi backend ready:**
- Gateway health: `GET http://localhost:3000/health`
- Services health: `GET http://localhost:3000/health/services`
- PgAdmin: `http://localhost:5050`
- Mongo Express: `http://localhost:8081`
- RabbitMQ Management: `http://localhost:15672` (user: rabbit, pass: rabbit123)

### 3️⃣ Khởi động Frontend (Mở 3 terminal riêng)

#### 🟦 Terminal 1 - Customer App (Port 4000)
```bash
cd frontend/customer-app
npm install
npm run dev
```
Truy cập: `http://localhost:4000`

#### 🟩 Terminal 2 - Driver App (Port 4001)
```bash
cd frontend/driver-app
npm install
npm run dev
```
Truy cập: `http://localhost:4001`

#### 🟪 Terminal 3 - Admin Dashboard (Port 4002)
```bash
cd frontend/admin-dashboard
npm install
npm run dev
```
Truy cập: `http://localhost:4002`

---

## ✅ Kiểm tra hệ thống (Smoke Test)

```powershell
cd scripts
.\smoke-test.ps1 -BaseUrl "http://localhost:3000"
```

**Output mong đợi:**
```
✅ Smoke test completed.
```

---

## 🧪 Quy trình test (End-to-End)

### Tạo tài khoản Test

**Customer:**
- Email: `customer@test.com`
- Password: `Password123!`

**Driver:**
- Email: `driver@test.com`
- Password: `Password123!`

### Test flow cơ bản

1. **Đăng ký** (Customer) → Mở Customer App → Register
2. **Đặt xe** → Chọn điểm đón/trả → Chọn loại xe (ECONOMY/COMFORT/PREMIUM) → Chọn thanh toán (CASH/CARD/WALLET) → Đặt
3. **Driver chấp nhận** → Mở Driver App → Xem danh sách xe có sẵn → Bấm Accept
4. **Tracking real-time** → Cả hai app thấy vị trí driver cập nhật
5. **Hoàn thành** → Driver kết thúc chuyến → Thanh toán tự động
6. **Lịch sử** → Customer xem chuyến đã đi

---

## 📁 Cấu trúc thư mục

```
├── services/                    # Microservices
│   ├── api-gateway/            # Điểm vào API
│   ├── auth-service/           # Xác thực
│   ├── ride-service/           # Quản lý xe
│   ├── driver-service/         # Quản lý tài xế
│   ├── payment-service/        # Tính giá & thanh toán
│   ├── notification-service/   # Thông báo
│   └── ai-service/             # AI (Python)
├── frontend/
│   ├── customer-app/           # App khách hàng
│   ├── driver-app/             # App tài xế
│   └── admin-dashboard/        # Dashboard admin
├── shared/                      # Shared types & utilities
├── monitoring/                  # Prometheus, Grafana, Loki
├── scripts/                     # Helper scripts
├── docker-compose.yml          # Orchestration
└── README.md                   # File này
```

---

## 🔧 Các lệnh hữu ích

### Docker

```bash
# Xem tất cả containers
docker-compose ps

# Xem logs service
docker-compose logs -f <service-name>

# Dừng tất cả
docker-compose down

# Dừng & xóa volumes (reset data)
docker-compose down -v

# Rebuild service
docker-compose up -d --build <service-name>

# Exec vào container
docker-compose exec <service-name> sh
```

### npm (Frontend)

```bash
# Chạy dev mode
npm run dev

# Build production
npm run build

# Test
npm test

# Lint
npm run lint
```

### Useful endpoints

```bash
# Register customer
POST http://localhost:3000/api/auth/register
Body: {
  "email": "user@example.com",
  "password": "Password123!",
  "role": "CUSTOMER",
  "firstName": "John",
  "lastName": "Doe"
}

# Login
POST http://localhost:3000/api/auth/login
Body: { "email": "...", "password": "..." }

# Estimate fare (public)
POST http://localhost:3000/api/ai/ride/estimate
Body: {
  "pickup": { "lat": 10.762622, "lng": 106.660172 },
  "destination": { "lat": 10.776889, "lng": 106.700806 },
  "vehicleType": "ECONOMY"
}

# Find drivers nearby
POST http://localhost:3000/api/ai/match/drivers
Body: {
  "pickup": { "lat": 10.762622, "lng": 106.660172 },
  "maxDistanceKm": 5
}
```

---

## 🐛 Troubleshooting

### Services không khởi động
```bash
# 1. Xem logs chi tiết
docker-compose logs api-gateway

# 2. Kiểm tra port bị chiếm
netstat -ano | findstr :3000

# 3. Restart Docker Desktop
# 4. Remove images & rebuild
docker-compose down -v
docker-compose up -d --build
```

### Frontend không kết nối backend
```bash
# 1. Verify backend health
curl http://localhost:3000/health

# 2. Kiểm tra CORS trong API Gateway
# 3. Kiểm tra JWT token lưu trong localStorage
```

### Database errors
```bash
# 1. Xem logs PostgreSQL
docker-compose logs postgres

# 2. Reset database
docker-compose down -v
docker-compose up -d

# 3. Manual run migrations
docker-compose exec api-gateway npm run migrate
```

---

## 📊 Monitoring

### Metrics & Logs

- **Prometheus**: `http://localhost:9090`
  - Queries: `http_requests_total`, `response_time_ms`
  
- **Grafana**: `http://localhost:3100`
  - Login: admin / admin123
  - Dashboards: System Overview, API Performance
  
- **Loki**: Centralized logs
  - Query logs từ Grafana

### Health Checks

```bash
# Gateway
curl http://localhost:3000/health

# All services
curl http://localhost:3000/health/services
```

---

## 🎯 Features chính

✅ **Customer:**
- Đăng ký/Đăng nhập
- Đặt xe chọn loại (ECONOMY/COMFORT/PREMIUM)
- Chọn phương thức thanh toán (CASH/CARD/WALLET)
- Real-time tracking tài xế
- Lịch sử chuyến
- Rating/Review

✅ **Driver:**
- Đăng ký/Đăng nhập
- Online/Offline status
- Xem danh sách xe có sẵn gần vị trí
- Chấp nhận chuyến
- Navigation đến điểm đón/trả
- Earnings dashboard

✅ **Admin:**
- Quản lý users
- Revenue analytics
- Commission tracking
- User support tools

✅ **Technical:**
- Microservices architecture
- Event-driven (RabbitMQ)
- Real-time updates (Socket.IO)
- Geospatial queries (Redis)
- JWT authentication
- Dynamic pricing by vehicle type
- Duplicate detection

---

## 📝 Ghi chú quan trọng

1. **Lần đầu chạy sẽ mất 5-10 phút** cho Docker build images
2. **Chờ 2-3 phút** sau khi `docker-compose up` để tất cả services healthy
3. **PostgreSQL khởi tạo sẽ tự động** từ init-db.sql
4. **RabbitMQ subscriptions** cần time để setup
5. **JWT tokens hết hạn sau 24h** (check `.env`)
6. **Restart frontend khi thay env variables**

---

## 🤝 Hỗ trợ

- **Logs**: `docker-compose logs -f <service>`
- **Health check**: `http://localhost:3000/health`
- **RabbitMQ Management**: `http://localhost:15672`
- **Database UI**: 
  - PgAdmin: `http://localhost:5050`
  - Mongo Express: `http://localhost:8081`

---

## 📄 License

MIT

---

**Phiên bản**: 1.0.0  
**Cập nhật**: January 2026  
**Status**: ✅ Production Ready

## Chạy bằng Docker Compose (khuyến nghị)

```bash
npm run docker:build
npm run docker:up

# logs
npm run docker:logs

# stop
npm run docker:down
```

## Chạy local (dev)

Chạy từng service (mở nhiều terminal):

```bash
npm run dev:auth
npm run dev:ride
npm run dev:driver
npm run dev:payment
npm run dev:notification
npm run dev:gateway

# AI service
npm run dev:ai
```

Chạy frontend:

```bash
npm run dev:frontend:customer
npm run dev:frontend:driver
npm run dev:frontend:admin
```

## Prisma notes (Ride/Payment)

Vì monorepo, Prisma Client của Ride và Payment được generate vào thư mục riêng để tránh ghi đè lẫn nhau:

- Ride: `services/ride-service/src/generated/prisma-client`
- Payment: `services/payment-service/src/generated/prisma-client`

## Testing

```bash
# chạy toàn repo
npm test

# chạy riêng từng workspace
npm run test:auth
npm run test:ride

# coverage
npm run test:coverage
```

## Monitoring (Docker)

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3100
- RabbitMQ Management: http://localhost:15672

## License

MIT




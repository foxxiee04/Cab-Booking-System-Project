# 🚀 HƯỚNG DẪN CHẠY DỰ ÁN NHANH

## 📋 YÊU CẦU

✅ **Phần mềm cần có:**
- Docker Desktop (đang chạy)
- Node.js 20+ 
- PowerShell
- Trình duyệt web

✅ **Kiểm tra file `.env` tồn tại trong root project**

---

## ⚡ CHẠY NHANH (5 PHÚT)

### Bước 1: Khởi động Backend (Docker)

```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project"

# Build và chạy tất cả services (lần đầu ~5-10 phút)
docker-compose up -d --build

# Kiểm tra trạng thái (chờ đến khi tất cả services "Up" và "healthy")
docker-compose ps
```

**⏳ Chờ 2-3 phút để các services khởi động và healthy!**

**Kiểm tra logs nếu có lỗi:**
```powershell
# Xem logs tất cả services
docker-compose logs -f

# Xem logs service cụ thể
docker-compose logs -f api-gateway
docker-compose logs -f auth-service
```

---

### Bước 2: Khởi động Frontend (Mở 3 Terminal riêng)

#### 🟦 Terminal 1: Customer App (Port 4000)
```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project\frontend\customer-app"
npm install
npm run dev
```
**Truy cập:** http://localhost:4000

---

#### 🟩 Terminal 2: Driver App (Port 4001)
```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project\frontend\driver-app"
npm install
npm run dev
```
**Truy cập:** http://localhost:4001

---

#### 🟨 Terminal 3: Admin Dashboard (Port 4002)
```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project\frontend\admin-dashboard"
npm install
npm run dev
```
**Truy cập:** http://localhost:4002

---

## 🗄️ XEM DATABASE (Web UI)

### � PostgreSQL - pgAdmin
**URL:** http://localhost:5050  
**Login:**
- Email: `admin@cabbooking.local`
- Password: `admin123`

**Kết nối đến PostgreSQL trong pgAdmin:**
1. Click "Add New Server"
2. **General Tab:**
   - Name: `CabBooking`
3. **Connection Tab:**
   - Host: `postgres` (nếu dùng từ Docker) hoặc `localhost` (từ máy host)
   - Port: `5432` (trong Docker network) hoặc `5433` (từ máy host)
   - Maintenance database: `postgres`
   - Username: `postgres`
   - Password: `postgres123`
4. Click "Save"

**Databases có trong PostgreSQL:**
- `cab_rides` - Dữ liệu chuyến đi (Ride Service)
- `cab_payments` - Dữ liệu thanh toán (Payment Service)

---

### 🍃 MongoDB - Mongo Express
**URL:** http://localhost:8081  
**Login:**
- Username: `admin`
- Password: `admin123`

**Databases có trong MongoDB:**
- `cab_auth` - Dữ liệu users, authentication (Auth Service)
- `cab_drivers` - Dữ liệu tài xế, xe (Driver Service)

---

### 🐰 RabbitMQ - Management UI
**URL:** http://localhost:15672  
**Login:**
- Username: `rabbit`
- Password: `rabbit123`

**Xem được:**
- Queues (hàng đợi messages)
- Exchanges (routing messages)
- Message flow giữa các services

---

### 📊 Grafana - Monitoring Dashboard
**URL:** http://localhost:3300  
**Login:**
- Username: `admin`
- Password: `admin123`

**Có sẵn dashboards:**
- System metrics (CPU, RAM, Disk)
- Service health checks
- API performance metrics

---

## 🧪 TEST API NHANH

### URLs của các services:
```
API Gateway:         http://localhost:3000
Auth Service:        http://localhost:3001
Ride Service:        http://localhost:3002
Driver Service:      http://localhost:3003
Payment Service:     http://localhost:3004
Notification (WS):   http://localhost:3005
AI Service:          http://localhost:3006
```

#### 1️⃣ Đăng ký Customer
```powershell
$registerBody = @{
  email = "customer@test.com"
  password = "123456"
  phone = "0901234567"
  role = "CUSTOMER"
  firstName = "Nguyen"
  lastName = "Van A"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d $registerBody
```

---

#### 2️⃣ Đăng nhập và lấy token
```powershell
$loginBody = @{
  email = "customer@test.com"
  password = "123456"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d $loginBody
```
**📋 Copy `accessToken` từ response để dùng cho các bước sau!**

---

#### 3️⃣ Ước tính giá chuyến đi
```powershell
$token = "PASTE_YOUR_ACCESS_TOKEN_HERE"

$estimateBody = @{
  pickup = @{
    lat = 10.762622
    lng = 106.660172
  }
  destination = @{
    lat = 10.772622
    lng = 106.680172
  }
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/ai/ride/estimate `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $estimateBody
```

---

#### 4️⃣ Tạo chuyến đi mới
```powershell
$rideBody = @{
  pickup = @{
    lat = 10.762622
    lng = 106.660172
    address = "Đại học Công Nghệ Thông Tin"
  }
  dropoff = @{
    lat = 10.772622
    lng = 106.680172
    address = "Nhà Văn Hóa Thanh Niên"
  }
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/rides `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $rideBody
```

---

#### 5️⃣ Xem danh sách chuyến đi của tôi
```powershell
curl -X GET http://localhost:3000/api/rides/my-rides `
  -H "Authorization: Bearer $token"
```

---

## 📊 XEM DỮ LIỆU TRONG DATABASE

### 🐘 PostgreSQL - Các bảng quan trọng:

**Database: cab_rides**
- `rides` - Thông tin chuyến đi (pickup, dropoff, status, fare)
- `ride_locations` - Vị trí real-time của xe
- `fare_calculations` - Chi tiết tính giá cước

**Database: cab_payments**
- `payments` - Giao dịch thanh toán
- `payment_methods` - Phương thức thanh toán của user
- `refunds` - Giao dịch hoàn tiền

**Câu query mẫu trong pgAdmin:**
```sql
-- Xem 10 chuyến đi gần nhất
SELECT * FROM rides ORDER BY created_at DESC LIMIT 10;

-- Xem rides với thông tin customer và driver
SELECT r.id, r.status, r.pickup_address, r.dropoff_address, 
       r.customer_id, r.driver_id, r.created_at
FROM rides r
WHERE r.status != 'CANCELLED'
ORDER BY r.created_at DESC;

-- Xem payments
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
```

---

### 🍃 MongoDB - Các collections quan trọng:

**Database: cab_auth**
- `users` - Tất cả users (CUSTOMER, DRIVER, ADMIN)
- `sessions` - Refresh tokens, session management

**Database: cab_drivers**
- `drivers` - Thông tin tài xế (name, rating, status: ONLINE/OFFLINE)
- `vehicles` - Thông tin xe (model, color, license plate, seats)
- `driver_locations` - Vị trí real-time của tài xế

**Queries mẫu trong Mongo Express:**
```javascript
// Tìm tất cả customers
db.users.find({ role: "CUSTOMER" })

// Tìm drivers đang online
db.drivers.find({ status: "ONLINE" })

// Xem tất cả xe
db.vehicles.find({})
```

---

## 🔍 DEBUG & XEM LOGS

### Xem logs của service cụ thể:
```powershell
docker-compose logs -f api-gateway
docker-compose logs -f ride-service
docker-compose logs -f auth-service
docker-compose logs -f notification-service
```

### Xem logs tất cả services:
```powershell
docker-compose logs -f
```

### Restart một service:
```powershell
docker-compose restart api-gateway
```

### Rebuild service sau khi sửa code:
```powershell
docker-compose up -d --build api-gateway
```

---

## ⏹️ DỪNG PROJECT

### Dừng nhưng giữ lại data:
```powershell
docker-compose stop
```

### Dừng và xóa containers (data vẫn giữ):
```powershell
docker-compose down
```

### Dừng và xóa tất cả (bao gồm data):
```powershell
docker-compose down -v
```

---

## 🎯 TỔNG HỢP URLs

| Service | URL | Username/Password |
|---------|-----|-------------------|
| **Customer App** | http://localhost:4000 | Đăng ký trên web |
| **Driver App** | http://localhost:4001 | Đăng ký trên web |
| **Admin Dashboard** | http://localhost:4002 | Đăng ký trên web |
| **API Gateway** | http://localhost:3000/health | - |
| **pgAdmin (PostgreSQL UI)** | http://localhost:5050 | admin@cabbooking.local / admin123 |
| **Mongo Express (MongoDB UI)** | http://localhost:8081 | admin / admin123 |
| **RabbitMQ Management** | http://localhost:15672 | rabbit / rabbit123 |
| **Grafana (Monitoring)** | http://localhost:3300 | admin / admin123 |
| **Prometheus** | http://localhost:9090 | - |

---

## 💡 TIPS HỮU ÍCH

### 1. Kiểm tra backend đang chạy:
```powershell
curl http://localhost:3000/health
```

### 2. Kết nối database từ VS Code:

**PostgreSQL connection string:**
```
postgresql://postgres:postgres123@localhost:5433/cab_rides
```

**MongoDB connection string:**
```
mongodb://mongo:mongo123@localhost:27017/cab_auth?authSource=admin
```

**VS Code Extensions đề xuất:**
- PostgreSQL: "PostgreSQL" by Chris Kolkman
- MongoDB: "MongoDB for VS Code" by MongoDB

---

### 3. Hot reload:
- **Frontend:** Tự động reload khi save file
- **Backend:** Cần rebuild container: `docker-compose up -d --build [service-name]`

---

### 4. Test WebSocket realtime:
- Dùng Customer App (tự động connect)
- Hoặc dùng online tool: https://websocket.org/echo.html
- Connect to: `ws://localhost:3005`

---

## 🐛 TROUBLESHOOTING

### ❌ Lỗi: Port đã được sử dụng
```powershell
# Xem process nào đang dùng port
netstat -ano | findstr :4000

# Kill process (thay <PID> bằng số PID tìm được)
taskkill /PID <PID> /F
```

---

### ❌ Lỗi: Database connection failed
**Giải pháp:**
1. Check Docker containers đang chạy: `docker-compose ps`
2. Đợi healthcheck pass: `docker-compose logs postgres`
3. Kiểm tra credentials trong file `.env`

---

### ❌ Lỗi: Cannot connect to MongoDB
**Giải pháp:**
- Connection string phải có `authSource=admin`
- Kiểm tra username/password trong `.env`
- Restart MongoDB: `docker-compose restart mongodb`

---

### ❌ Lỗi: Frontend không kết nối được backend
**Giải pháp:**
1. Kiểm tra file `.env.local` trong folder frontend
2. Đảm bảo backend đang chạy: `docker-compose ps`
3. Test API: `curl http://localhost:3000/health`

---

### ❌ Lỗi: Docker build thất bại
**Giải pháp:**
```powershell
# Xóa cache và rebuild
docker-compose build --no-cache [service-name]
docker-compose up -d [service-name]
```

---

## 📚 ĐỌC THÊM

- [RUN-PROJECT.md](./RUN-PROJECT.md) - Hướng dẫn chi tiết hơn
- [TEST-CASES.md](./TEST-CASES.md) - Các test case đầy đủ
- [docs/](./docs/) - Tài liệu kỹ thuật chi tiết
- CORS: Backend cho phép localhost:4000-4002

---

## 📚 Tài liệu thêm

- [SETUP.md](./SETUP.md) - Setup chi tiết
- [docs/](./docs/) - Kiến trúc hệ thống
- [PORT-ALLOCATION.md](./PORT-ALLOCATION.md) - Phân bổ port

# 🚀 HƯỚNG DẪN CHẠY PROJECT ĐẦY ĐỦ

> **Hướng dẫn chi tiết từng bước để chạy và test toàn bộ Cab Booking System**

---

## 📋 CHUẨN BỊ

### ✅ Checklist phần mềm:
- [x] **Docker Desktop** - Đã cài và đang chạy
- [x] **Node.js 20+** - Check: `node --version`
- [x] **npm** - Check: `npm --version`
- [x] **PowerShell** (Windows)
- [x] **Trình duyệt web**

### ✅ Kiểm tra file `.env`:
```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project"
cat .env
```

**File `.env` phải có những dòng này:**
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
MONGO_USER=mongo
MONGO_PASSWORD=mongo123
RABBITMQ_USER=rabbit
RABBITMQ_PASS=rabbit123
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PGADMIN_EMAIL=admin@cabbooking.local
PGADMIN_PASSWORD=admin123
MONGO_EXPRESS_PASSWORD=admin123
GRAFANA_PASSWORD=admin123
```

---

## 🎯 BƯỚC 1: KHỞI ĐỘNG BACKEND

### 1.1. Build và chạy Docker services

```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project"

# Build và start (lần đầu ~5-10 phút)
docker-compose up -d --build
```

### 1.2. Kiểm tra trạng thái

```powershell
docker-compose ps
```

**Mong đợi:** Tất cả services `State: Up (healthy)`

### 1.3. Chờ khởi động (2-3 phút)

```powershell
# Xem logs để check lỗi
docker-compose logs -f api-gateway
```

### 1.4. Test backend

```powershell
curl http://localhost:3000/health
```

**Kết quả:** `{"status":"ok"}`

---

## 🎨 BƯỚC 2: KHỞI ĐỘNG FRONTEND

> Mở 3 terminal riêng biệt

### Terminal 1 - Customer App (Port 4000)

```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project\frontend\customer-app"
npm install
npm run dev
```

Truy cập: http://localhost:4000

---

### Terminal 2 - Driver App (Port 4001)

```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project\frontend\driver-app"
npm install
npm run dev
```

Truy cập: http://localhost:4001

---

### Terminal 3 - Admin Dashboard (Port 4002)

```powershell
cd "e:\Nam4 - Ki 2\KLTN2025\Cab-Booking-System-Project\frontend\admin-dashboard"
npm install
npm run dev
```

Truy cập: http://localhost:4002

---

## 🗄️ BƯỚC 3: XEM DATABASE

### pgAdmin - PostgreSQL (Port 5050)

**URL:** http://localhost:5050  
**Login:** `admin@cabbooking.local` / `admin123`

**Kết nối server:**
- Host: `postgres` hoặc `localhost`
- Port: `5432` (Docker) hoặc `5433` (host)
- Username: `postgres`
- Password: `postgres123`

**Databases:**
- `cab_rides` - Chuyến đi
- `cab_payments` - Thanh toán

---

### Mongo Express - MongoDB (Port 8081)

**URL:** http://localhost:8081  
**Login:** `admin` / `admin123`

**Databases:**
- `cab_auth` - Users
- `cab_drivers` - Tài xế, xe

---

### RabbitMQ Management (Port 15672)

**URL:** http://localhost:15672  
**Login:** `rabbit` / `rabbit123`

---

### Grafana - Monitoring (Port 3300)

**URL:** http://localhost:3300  
**Login:** `admin` / `admin123`

---

## 🧪 BƯỚC 4: TEST API

### Test 1: Đăng ký Customer

```powershell
$body = @{
    email = "customer1@test.com"
    password = "123456"
    phone = "0901234567"
    role = "CUSTOMER"
    firstName = "Nguyen"
    lastName = "Van A"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d $body
```

**Kết quả:** Nhận được `accessToken` và `refreshToken`

---

### Test 2: Đăng nhập

```powershell
$body = @{
    email = "customer1@test.com"
    password = "123456"
} | ConvertTo-Json

$response = curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d $body

# Parse response để lấy token
$token = ($response | ConvertFrom-Json).data.accessToken
Write-Host "Token: $token"
```

**📋 Copy token này để dùng cho các bước tiếp theo!**

---

### Test 3: Ước tính giá chuyến đi

```powershell
$token = "PASTE_YOUR_TOKEN_HERE"

$body = @{
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
  -d $body
```

**Kết quả:** Nhận ước tính khoảng cách, thời gian, giá tiền

---

### Test 4: Tạo chuyến đi

```powershell
$body = @{
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
  -d $body
```

**Kết quả:** Chuyến đi được tạo với status `PENDING`

---

### Test 5: Xem danh sách chuyến đi

```powershell
curl -X GET http://localhost:3000/api/rides/my-rides `
  -H "Authorization: Bearer $token"
```

---

### Test 6: Kiểm tra dữ liệu trong database

**PostgreSQL (pgAdmin):**
```sql
-- Xem chuyến đi vừa tạo
SELECT * FROM rides ORDER BY created_at DESC LIMIT 5;
```

**MongoDB (Mongo Express):**
```javascript
// Xem user vừa đăng ký
db.users.find({ email: "customer1@test.com" })
```

---

## 🧪 BƯỚC 5: TEST FRONTEND-BACKEND

### Test trên Customer App (http://localhost:4000)

1. **Đăng ký tài khoản mới**
   - Vào trang Register
   - Nhập: email, password, phone, firstName, lastName
   - Click "Sign Up"
   - ✅ Kiểm tra: Chuyển sang trang Login

2. **Đăng nhập**
   - Nhập email và password vừa đăng ký
   - Click "Login"
   - ✅ Kiểm tra: Chuyển sang trang Home, hiển thị tên user

3. **Đặt chuyến đi**
   - Nhập địa chỉ pickup
   - Nhập địa chỉ destination
   - Click "Estimate"
   - ✅ Kiểm tra: Hiển thị giá ước tính
   - Click "Book Now"
   - ✅ Kiểm tra: Chuyến đi được tạo

4. **Xem lịch sử chuyến đi**
   - Vào trang "My Rides"
   - ✅ Kiểm tra: Thấy chuyến đi vừa tạo

---

## 🐛 TROUBLESHOOTING

### Port đã được sử dụng

```powershell
# Xem process dùng port
netstat -ano | findstr :4000

# Kill process
taskkill /PID <PID> /F
```

---

### Backend không chạy

```powershell
# Check logs
docker-compose logs -f api-gateway

# Restart service
docker-compose restart api-gateway

# Rebuild
docker-compose up -d --build api-gateway
```

---

### Frontend không connect được backend

1. Check file `.env.local` trong frontend:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3005
```

2. Test backend đang chạy:
```powershell
curl http://localhost:3000/health
```

3. Restart frontend:
- Nhấn `Ctrl+C` trong terminal
- Chạy lại `npm run dev`

---

### Database connection failed

```powershell
# Check containers đang chạy
docker-compose ps

# Restart database
docker-compose restart postgres mongodb

# Xem logs
docker-compose logs postgres
docker-compose logs mongodb
```

---

## ⏹️ DỪNG PROJECT

### Dừng nhưng giữ data

```powershell
docker-compose stop
```

### Dừng và xóa containers

```powershell
docker-compose down
```

### Dừng và xóa tất cả (bao gồm data)

```powershell
docker-compose down -v
```

---

## 📊 TỔNG HỢP URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Customer App | http://localhost:4000 | Đăng ký trên web |
| Driver App | http://localhost:4001 | Đăng ký trên web |
| Admin Dashboard | http://localhost:4002 | Đăng ký trên web |
| API Gateway | http://localhost:3000 | - |
| pgAdmin | http://localhost:5050 | admin@cabbooking.local / admin123 |
| Mongo Express | http://localhost:8081 | admin / admin123 |
| RabbitMQ | http://localhost:15672 | rabbit / rabbit123 |
| Grafana | http://localhost:3300 | admin / admin123 |
| Prometheus | http://localhost:9090 | - |

---

## 🎯 LUỒNG TEST ĐẦY ĐỦ (10 PHÚT)

### 1. Khởi động hệ thống (3 phút)
```powershell
# Terminal 1: Backend
docker-compose up -d --build

# Terminal 2: Customer App
cd frontend/customer-app && npm run dev

# Terminal 3: Driver App  
cd frontend/driver-app && npm run dev
```

### 2. Test Customer flow (3 phút)
1. Mở http://localhost:4000
2. Đăng ký → Đăng nhập
3. Đặt chuyến đi
4. Xem lịch sử

### 3. Test Driver flow (2 phút)
1. Mở http://localhost:4001
2. Đăng ký driver
3. Update status ONLINE
4. Nhận chuyến đi

### 4. Kiểm tra database (2 phút)
1. pgAdmin: Xem bảng `rides`
2. Mongo Express: Xem collection `users`
3. RabbitMQ: Xem queues

---

## 💡 TIPS

### Kết nối database từ VS Code

**PostgreSQL:**
```
postgresql://postgres:postgres123@localhost:5433/cab_rides
```

**MongoDB:**
```
mongodb://mongo:mongo123@localhost:27017/cab_auth?authSource=admin
```

**Extensions đề xuất:**
- PostgreSQL by Chris Kolkman
- MongoDB for VS Code

---

### Hot reload

- **Frontend:** Tự động reload khi save
- **Backend:** Rebuild: `docker-compose up -d --build [service-name]`

---

### Xem logs real-time

```powershell
# Tất cả services
docker-compose logs -f

# Service cụ thể
docker-compose logs -f api-gateway ride-service

# 50 dòng cuối
docker-compose logs --tail=50 api-gateway
```

---

## 📚 TÀI LIỆU LIÊN QUAN

- [START-DEV.md](./START-DEV.md) - Hướng dẫn chạy nhanh
- [TEST-CASES.md](./TEST-CASES.md) - Test cases chi tiết
- [docs/](./docs/) - Tài liệu kỹ thuật đầy đủ
- [PORT-ALLOCATION.md](./PORT-ALLOCATION.md) - Danh sách ports

---

## ❓ HỎI ĐÁP

**Q: Build lần đầu mất bao lâu?**  
A: ~5-10 phút (tùy tốc độ mạng và máy)

**Q: Cần bao nhiêu RAM?**  
A: Tối thiểu 8GB, khuyến nghị 16GB

**Q: Có cần rebuild mỗi lần sửa code backend?**  
A: Có, chạy: `docker-compose up -d --build [service-name]`

**Q: Frontend có tự reload không?**  
A: Có, Next.js có hot reload sẵn

**Q: Làm sao xóa dữ liệu test?**  
A: `docker-compose down -v` (xóa cả volumes)

---

**🎉 Chúc bạn thành công!**

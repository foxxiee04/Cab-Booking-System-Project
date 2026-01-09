# 🧪 TEST CASES - CAB BOOKING SYSTEM

> **Tổng hợp test cases cho tất cả modules và tầng của hệ thống**

---

## 📋 MỤC LỤC

1. [API Test Cases](#-api-test-cases)
2. [Frontend E2E Test Cases](#-frontend-e2e-test-cases)
3. [Database Test Cases](#-database-test-cases)
4. [Performance Test Cases](#-performance-test-cases)
5. [Security Test Cases](#-security-test-cases)
6. [Integration Test Cases](#-integration-test-cases)

---

## 🔌 API TEST CASES

### TC-API-001: Đăng ký Customer thành công

**Mục đích:** Kiểm tra API đăng ký user mới với role CUSTOMER

**Precondition:** Backend đang chạy

**Steps:**
```powershell
$body = @{
    email = "testcustomer@example.com"
    password = "Test123456"
    phone = "0901234567"
    role = "CUSTOMER"
    firstName = "Test"
    lastName = "Customer"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "testcustomer@example.com",
      "role": "CUSTOMER",
      "firstName": "Test",
      "lastName": "Customer"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Validation:**
- ✅ Status code: 201 Created
- ✅ Response có `accessToken` và `refreshToken`
- ✅ User được lưu trong MongoDB collection `users`

---

### TC-API-002: Đăng ký với email trùng (Negative Test)

**Mục đích:** Kiểm tra validate email đã tồn tại

**Steps:**
```powershell
# Đăng ký lần 1 (thành công)
$body = @{
    email = "duplicate@test.com"
    password = "123456"
    phone = "0901111111"
    role = "CUSTOMER"
    firstName = "User"
    lastName = "One"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d $body

# Đăng ký lần 2 với cùng email (thất bại)
curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result:**
```json
{
  "success": false,
  "error": {
    "message": "Email already exists"
  }
}
```

**Validation:**
- ✅ Status code: 400 Bad Request
- ✅ Error message rõ ràng
- ✅ Không tạo user mới

---

### TC-API-003: Đăng nhập thành công

**Mục đích:** Kiểm tra login với credentials đúng

**Precondition:** Đã có user đăng ký

**Steps:**
```powershell
$body = @{
    email = "testcustomer@example.com"
    password = "Test123456"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "testcustomer@example.com",
      "role": "CUSTOMER"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Validation:**
- ✅ Status code: 200 OK
- ✅ Nhận được tokens mới
- ✅ Session được lưu trong MongoDB

---

### TC-API-004: Đăng nhập với mật khẩu sai (Negative Test)

**Mục đích:** Kiểm tra security khi password sai

**Steps:**
```powershell
$body = @{
    email = "testcustomer@example.com"
    password = "WrongPassword123"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid credentials"
  }
}
```

**Validation:**
- ✅ Status code: 401 Unauthorized
- ✅ Không trả về token
- ✅ Error message không tiết lộ user có tồn tại hay không

---

### TC-API-005: Ước tính giá chuyến đi

**Mục đích:** Kiểm tra AI Service tính toán giá cước

**Precondition:** Đã đăng nhập và có accessToken

**Steps:**
```powershell
$token = "YOUR_ACCESS_TOKEN"

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

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "distance": 1.5,
    "duration": 5,
    "estimatedFare": 25000,
    "currency": "VND"
  }
}
```

**Validation:**
- ✅ Status code: 200 OK
- ✅ `distance` > 0
- ✅ `duration` > 0
- ✅ `estimatedFare` hợp lý (>= min fare)

---

### TC-API-006: Tạo chuyến đi

**Mục đích:** Kiểm tra tạo ride mới

**Precondition:** Đã đăng nhập customer

**Steps:**
```powershell
$token = "YOUR_ACCESS_TOKEN"

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

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "PENDING",
    "customerId": "...",
    "pickupLocation": {...},
    "dropoffLocation": {...},
    "estimatedFare": 25000,
    "createdAt": "2026-01-09T..."
  }
}
```

**Validation:**
- ✅ Status code: 201 Created
- ✅ Ride có status `PENDING`
- ✅ Dữ liệu lưu vào PostgreSQL `rides` table
- ✅ Event publish đến RabbitMQ

---

### TC-API-007: Lấy danh sách chuyến đi của tôi

**Mục đích:** Kiểm tra API lấy rides history

**Precondition:** Customer đã có ít nhất 1 ride

**Steps:**
```powershell
$token = "YOUR_ACCESS_TOKEN"

curl -X GET "http://localhost:3000/api/rides/my-rides?status=ALL&page=1&limit=10" `
  -H "Authorization: Bearer $token"
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "rides": [
      {
        "id": "...",
        "status": "PENDING",
        "pickupAddress": "Đại học Công Nghệ Thông Tin",
        "dropoffAddress": "Nhà Văn Hóa Thanh Niên",
        "fare": 25000,
        "createdAt": "2026-01-09T..."
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

**Validation:**
- ✅ Status code: 200 OK
- ✅ Chỉ trả về rides của customer hiện tại
- ✅ Pagination hoạt động đúng

---

### TC-API-008: Huỷ chuyến đi

**Mục đích:** Kiểm tra cancel ride

**Precondition:** Có ride với status PENDING

**Steps:**
```powershell
$token = "YOUR_ACCESS_TOKEN"
$rideId = "RIDE_ID_FROM_PREVIOUS_TEST"

$body = @{
    reason = "Changed my mind"
} | ConvertTo-Json

curl -X POST "http://localhost:3000/api/rides/$rideId/cancel" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "CANCELLED",
    "cancellationReason": "Changed my mind",
    "cancelledAt": "2026-01-09T..."
  }
}
```

**Validation:**
- ✅ Status code: 200 OK
- ✅ Ride status đổi thành `CANCELLED`
- ✅ Event publish đến RabbitMQ
- ✅ Notification gửi cho driver (nếu đã assign)

---

## 🖥️ FRONTEND E2E TEST CASES

### TC-E2E-001: Customer đăng ký thành công

**Mục đích:** Test user registration flow trên Customer App

**Precondition:** 
- Customer App đang chạy (http://localhost:4000)
- Database trống (hoặc dùng email mới)

**Steps:**
1. Mở http://localhost:4000/register
2. Nhập form:
   - Email: `e2etest@example.com`
   - Password: `Test123456`
   - Confirm Password: `Test123456`
   - Phone: `0901234567`
   - First Name: `E2E`
   - Last Name: `Test`
3. Click button "Sign Up"

**Expected Result:**
- ✅ Chuyển đến trang Login
- ✅ Hiển thị success message
- ✅ User được tạo trong database

---

### TC-E2E-002: Customer đặt chuyến đi

**Mục đích:** Test ride booking flow đầy đủ

**Precondition:** Customer đã đăng nhập

**Steps:**
1. Vào trang Home (http://localhost:4000)
2. Nhập "Pickup Location": `Đại học Công Nghệ Thông Tin`
3. Nhập "Destination": `Nhà Văn Hóa Thanh Niên`
4. Click "Estimate"
5. Xem giá ước tính hiển thị
6. Click "Book Now"

**Expected Result:**
- ✅ Hiển thị loading state khi estimate
- ✅ Hiển thị giá ước tính
- ✅ Chuyến đi được tạo
- ✅ Chuyển đến trang ride detail
- ✅ Hiển thị status "Finding driver..."

---

### TC-E2E-003: Driver nhận chuyến đi

**Mục đích:** Test driver accepting ride

**Precondition:** 
- Driver đã đăng nhập và ONLINE
- Có ride với status PENDING

**Steps:**
1. Vào Driver App (http://localhost:4001)
2. Xem danh sách "Available Rides"
3. Click vào một ride
4. Xem ride details
5. Click "Accept"

**Expected Result:**
- ✅ Ride status đổi thành `ACCEPTED`
- ✅ Customer nhận notification
- ✅ Ride biến mất khỏi list "Available Rides"
- ✅ Ride xuất hiện trong "My Active Rides"

---

### TC-E2E-004: Real-time location tracking

**Mục đích:** Test WebSocket real-time updates

**Precondition:** 
- Driver đã accept ride
- Ride có status `IN_PROGRESS`

**Steps:**
1. Customer mở ride detail page
2. Driver di chuyển (simulate bằng cách update location qua API)

**Expected Result:**
- ✅ Map trên Customer app tự động update vị trí driver
- ✅ ETA tự động cập nhật
- ✅ Không cần refresh page

---

### TC-E2E-005: Hoàn thành chuyến đi

**Mục đích:** Test complete ride flow

**Precondition:** 
- Ride có status `IN_PROGRESS`
- Driver đã đến destination

**Steps:**
1. Driver click "Complete Ride"
2. Hệ thống tính toán final fare
3. Customer xem bill
4. Customer chọn payment method
5. Customer confirm payment

**Expected Result:**
- ✅ Ride status đổi thành `COMPLETED`
- ✅ Payment record được tạo
- ✅ Driver balance tăng
- ✅ Customer và Driver nhận notification
- ✅ Rating popup hiển thị

---

## 🗄️ DATABASE TEST CASES

### TC-DB-001: Kiểm tra PostgreSQL - Rides table

**Mục đích:** Validate dữ liệu trong bảng rides

**Steps:**
```sql
-- Kết nối pgAdmin đến database cab_rides
-- Chạy query:
SELECT 
    id, 
    customer_id, 
    driver_id, 
    status, 
    pickup_address, 
    dropoff_address, 
    estimated_fare, 
    final_fare,
    created_at
FROM rides
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

**Expected Result:**
- ✅ Tất cả rides có `id`, `customer_id`, `status`
- ✅ `estimated_fare` và `final_fare` là số dương
- ✅ `status` chỉ có giá trị: PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED
- ✅ `created_at` <= NOW()

---

### TC-DB-002: Kiểm tra MongoDB - Users collection

**Mục đích:** Validate users data

**Steps:**
```javascript
// Trong Mongo Express, chạy query:
db.users.find({
    createdAt: { 
        $gte: new Date(Date.now() - 24*60*60*1000) 
    }
}).pretty()
```

**Expected Result:**
- ✅ Mỗi user có `email`, `passwordHash`, `role`
- ✅ `passwordHash` không phải plaintext
- ✅ `role` chỉ có: CUSTOMER, DRIVER, ADMIN
- ✅ `email` là unique

---

### TC-DB-003: Kiểm tra Foreign Keys

**Mục đích:** Validate referential integrity

**Steps:**
```sql
-- Kiểm tra rides không có customer_id không tồn tại
SELECT r.id, r.customer_id 
FROM rides r
LEFT JOIN -- (Cần join với MongoDB hoặc check thông qua API)
WHERE r.customer_id IS NOT NULL;

-- Kiểm tra payments không có ride_id không tồn tại
SELECT p.id, p.ride_id
FROM payments p
LEFT JOIN rides r ON p.ride_id = r.id
WHERE r.id IS NULL;
```

**Expected Result:**
- ✅ Không có rides với customer_id không tồn tại
- ✅ Không có payments với ride_id không tồn tại

---

### TC-DB-004: Kiểm tra Indexes

**Mục đích:** Validate performance indexes

**Steps:**
```sql
-- PostgreSQL: Xem indexes của bảng rides
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'rides';
```

```javascript
// MongoDB: Xem indexes của collection users
db.users.getIndexes()
```

**Expected Result:**
- ✅ PostgreSQL có index trên `customer_id`, `driver_id`, `status`
- ✅ MongoDB có index trên `email` (unique)
- ✅ MongoDB có index trên `role`

---

### TC-DB-005: Kiểm tra Data Consistency

**Mục đích:** Validate consistency giữa PostgreSQL và MongoDB

**Steps:**
1. Tạo 1 ride qua API
2. Lấy `customer_id` từ ride trong PostgreSQL
3. Check user với id đó có tồn tại trong MongoDB `users`

**Expected Result:**
- ✅ Customer_id trong PostgreSQL match với user _id trong MongoDB
- ✅ User role phải là CUSTOMER

---

## ⚡ PERFORMANCE TEST CASES

### TC-PERF-001: Load Test - Create Ride

**Mục đích:** Test hiệu năng API create ride

**Tool:** Apache Bench hoặc k6

**Steps:**
```powershell
# Dùng Apache Bench (ab)
ab -n 100 -c 10 -H "Authorization: Bearer YOUR_TOKEN" `
  -p ride_payload.json `
  -T "application/json" `
  http://localhost:3000/api/rides
```

**Expected Result:**
- ✅ 100 requests trong < 10 giây
- ✅ 95% requests có response time < 500ms
- ✅ 0% error rate

---

### TC-PERF-002: Concurrent Users

**Mục đích:** Test hệ thống với nhiều users đồng thời

**Steps:**
- Simulate 50 concurrent customers booking rides
- Simulate 20 concurrent drivers accepting rides

**Expected Result:**
- ✅ Không có deadlock
- ✅ Không có race conditions
- ✅ Database connections không exceed pool size

---

### TC-PERF-003: Database Query Performance

**Mục đích:** Test query performance

**Steps:**
```sql
EXPLAIN ANALYZE
SELECT * FROM rides 
WHERE status = 'PENDING' 
AND created_at > NOW() - INTERVAL '1 hour';
```

**Expected Result:**
- ✅ Query execution time < 50ms
- ✅ Sử dụng index
- ✅ Không có full table scan

---

### TC-PERF-004: WebSocket Performance

**Mục đích:** Test real-time updates performance

**Steps:**
- Connect 100 clients đến WebSocket server
- Publish 10 updates/second

**Expected Result:**
- ✅ Tất cả clients nhận updates
- ✅ Latency < 100ms
- ✅ No dropped connections

---

## 🔒 SECURITY TEST CASES

### TC-SEC-001: SQL Injection

**Mục đích:** Test bảo vệ chống SQL injection

**Steps:**
```powershell
# Thử inject SQL trong email field
$body = @{
    email = "admin' OR '1'='1"
    password = "test123"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result:**
- ✅ Request bị reject
- ✅ Không có SQL injection thành công
- ✅ Error message không reveal database info

---

### TC-SEC-002: JWT Token Validation

**Mục đích:** Test JWT security

**Steps:**
```powershell
# Test với token đã expire
curl -X GET http://localhost:3000/api/rides/my-rides `
  -H "Authorization: Bearer EXPIRED_TOKEN"

# Test với token không hợp lệ
curl -X GET http://localhost:3000/api/rides/my-rides `
  -H "Authorization: Bearer invalid_token_123"

# Test không có token
curl -X GET http://localhost:3000/api/rides/my-rides
```

**Expected Result:**
- ✅ Tất cả requests đều trả về 401 Unauthorized
- ✅ Không thể access protected resources

---

### TC-SEC-003: Authorization

**Mục đích:** Test phân quyền giữa roles

**Steps:**
```powershell
# Customer token try to access Driver endpoint
$customerToken = "CUSTOMER_TOKEN"

curl -X GET http://localhost:3000/api/driver/earnings `
  -H "Authorization: Bearer $customerToken"
```

**Expected Result:**
- ✅ Status code: 403 Forbidden
- ✅ Error: "Insufficient permissions"

---

### TC-SEC-004: XSS Protection

**Mục đích:** Test bảo vệ chống XSS

**Steps:**
```powershell
# Thử inject script trong firstName
$body = @{
    email = "xss@test.com"
    password = "test123"
    firstName = "<script>alert('XSS')</script>"
    lastName = "Test"
    role = "CUSTOMER"
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result:**
- ✅ Script được escape hoặc reject
- ✅ Không execute JavaScript
- ✅ Hiển thị safe text trong frontend

---

## 🔗 INTEGRATION TEST CASES

### TC-INT-001: Ride Flow - End to End

**Mục đích:** Test toàn bộ flow từ đặt xe đến hoàn thành

**Steps:**
1. Customer đăng ký
2. Customer đăng nhập
3. Customer ước tính giá
4. Customer tạo ride
5. Driver đăng ký
6. Driver đăng nhập
7. Driver update status ONLINE
8. Driver nhận ride
9. Driver bắt đầu chuyến (IN_PROGRESS)
10. Driver hoàn thành chuyến
11. Customer thanh toán
12. Customer rating driver

**Expected Result:**
- ✅ Tất cả steps thành công
- ✅ Data consistency giữa services
- ✅ Events được publish và consume đúng
- ✅ Notifications gửi đúng người

---

### TC-INT-002: Payment Integration

**Mục đích:** Test payment flow với Payment Service

**Steps:**
1. Tạo ride và complete
2. Tạo payment intent
3. Process payment
4. Verify payment success
5. Update ride payment status

**Expected Result:**
- ✅ Payment record trong database
- ✅ Ride status update
- ✅ Driver balance update
- ✅ Receipt generated

---

### TC-INT-003: Notification Integration

**Mục đích:** Test notification flow qua RabbitMQ

**Steps:**
1. Publish event: `ride.created`
2. Notification Service consume event
3. Send notification đến customer

**Expected Result:**
- ✅ Event được publish đến RabbitMQ
- ✅ Notification Service receive event
- ✅ Notification được gửi (log hoặc WebSocket)

---

## 🚀 QUICK TEST SCRIPT

### PowerShell Script - Test Full Flow

```powershell
# Save as: test-full-flow.ps1

Write-Host "🧪 Starting Full Flow Test..." -ForegroundColor Cyan

# 1. Register Customer
Write-Host "`n1️⃣ Registering Customer..." -ForegroundColor Yellow
$registerBody = @{
    email = "autotest-$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
    password = "Test123456"
    phone = "0909999999"
    role = "CUSTOMER"
    firstName = "Auto"
    lastName = "Test"
} | ConvertTo-Json

$registerResponse = curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d $registerBody | ConvertFrom-Json

$token = $registerResponse.data.accessToken
Write-Host "✅ Customer registered. Token: $($token.Substring(0,20))..." -ForegroundColor Green

# 2. Estimate Ride
Write-Host "`n2️⃣ Estimating Ride..." -ForegroundColor Yellow
$estimateBody = @{
    pickup = @{ lat = 10.762622; lng = 106.660172 }
    destination = @{ lat = 10.772622; lng = 106.680172 }
} | ConvertTo-Json

$estimateResponse = curl -X POST http://localhost:3000/api/ai/ride/estimate `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $estimateBody | ConvertFrom-Json

Write-Host "✅ Estimate: $($estimateResponse.data.estimatedFare) VND" -ForegroundColor Green

# 3. Create Ride
Write-Host "`n3️⃣ Creating Ride..." -ForegroundColor Yellow
$rideBody = @{
    pickup = @{
        lat = 10.762622
        lng = 106.660172
        address = "Test Pickup"
    }
    dropoff = @{
        lat = 10.772622
        lng = 106.680172
        address = "Test Dropoff"
    }
} | ConvertTo-Json

$rideResponse = curl -X POST http://localhost:3000/api/rides `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $rideBody | ConvertFrom-Json

$rideId = $rideResponse.data.id
Write-Host "✅ Ride created: $rideId" -ForegroundColor Green

# 4. Get My Rides
Write-Host "`n4️⃣ Getting My Rides..." -ForegroundColor Yellow
$myRides = curl -X GET http://localhost:3000/api/rides/my-rides `
  -H "Authorization: Bearer $token" | ConvertFrom-Json

Write-Host "✅ Found $($myRides.data.total) rides" -ForegroundColor Green

Write-Host "`n🎉 Full Flow Test PASSED!" -ForegroundColor Green
```

**Chạy script:**
```powershell
.\test-full-flow.ps1
```

---

## 📊 TEST COVERAGE SUMMARY

| Category | Test Cases | Priority |
|----------|-----------|----------|
| API Tests | 8 | 🔴 High |
| Frontend E2E | 5 | 🔴 High |
| Database Tests | 5 | 🟡 Medium |
| Performance Tests | 4 | 🟡 Medium |
| Security Tests | 4 | 🔴 High |
| Integration Tests | 3 | 🔴 High |
| **TOTAL** | **29** | - |

---

## 📚 TÀI LIỆU LIÊN QUAN

- [RUN-PROJECT.md](./RUN-PROJECT.md) - Hướng dẫn chạy project
- [START-DEV.md](./START-DEV.md) - Hướng dẫn nhanh
- [docs/14-TEST-NGHIEP-VU-THEO-DDD.md](./docs/14-TEST-NGHIEP-VU-THEO-DDD.md) - Test nghiệp vụ theo DDD

---

**✅ Hoàn thành test cases!**

# 📊 Sample Data Documentation

## 🎯 Tổng quan

File này mô tả chi tiết **sample data** đã được seed vào hệ thống Cab Booking System để phục vụ development và testing.

**File SQL:** [seed-sample-data.sql](seed-sample-data.sql)

---

## 👥 Users & Authentication

### 🔐 Login Credentials

**Password chung cho tất cả accounts:** `Password123`

| Role | Email | User ID | Mô tả |
|------|-------|---------|-------|
| **CUSTOMER** | customer1@example.com | c1000001-...-001 | Khách hàng nước ngoài |
| **CUSTOMER** | customer2@example.com | c1000002-...-002 | Khách hàng nước ngoài |
| **CUSTOMER** | nguyen.van.a@gmail.com | c1000003-...-003 | Khách hàng Việt Nam |
| **CUSTOMER** | tran.thi.b@gmail.com | c1000004-...-004 | Khách hàng Việt Nam |
| **DRIVER** | driver1@example.com | d2000001-...-001 | Tài xế (ONLINE) ⭐4.8 |
| **DRIVER** | driver2@example.com | d2000002-...-002 | Tài xế (ONLINE) ⭐4.9 |
| **DRIVER** | le.van.c@gmail.com | d2000003-...-003 | Tài xế (OFFLINE) ⭐4.7 |
| **DRIVER** | pham.van.d@gmail.com | d2000004-...-004 | Tài xế (ONLINE) ⭐4.6 |
| **ADMIN** | admin@cabsystem.com | a3000001-...-001 | System Administrator |

---

## 🚗 Drivers & Vehicles

### Driver Profiles

| Driver | License | Status | Rating | Total Rides | Vehicle |
|--------|---------|--------|--------|-------------|---------|
| Mike Johnson | DL12345678 | 🟢 ONLINE | ⭐4.8 | 245 | Toyota Vios (White) - 51A-12345 |
| Sarah Williams | DL87654321 | 🟢 ONLINE | ⭐4.9 | 312 | Honda City (Silver) - 51B-67890 |
| Lê Văn C | DL11111111 | 🔴 OFFLINE | ⭐4.7 | 189 | Hyundai Accent (Black) - 51C-11111 |
| Phạm Văn D | DL22222222 | 🟢 ONLINE | ⭐4.6 | 156 | Toyota Camry (Blue) - 51D-22222 |

### Vehicle Types
- **ECONOMY**: Toyota Vios, Hyundai Accent
- **COMFORT**: Honda City
- **PREMIUM**: Toyota Camry

---

## 📍 Sample Rides & Bookings

### Ride #1: Completed ✅
**Booking ID:** b1000001-0000-0000-0000-000000000001  
**Ride ID:** r1000001-0000-0000-0000-000000000001

- **Customer:** John Doe (customer1@example.com)
- **Driver:** Mike Johnson (driver1@example.com)
- **Vehicle:** Toyota Vios - White (ECONOMY)
- **Route:**
  - 📍 Pickup: Ben Thanh Market, District 1, HCMC (10.7729, 106.6980)
  - 📍 Dropoff: Tan Son Nhat Airport, HCMC (10.8187, 106.6524)
- **Distance:** 7.2 km
- **Duration:** 20 minutes (1200 seconds)
- **Fare:** 87,000 VND (estimated: 85,000 VND)
- **Payment:** 💵 CASH
- **Status:** ✅ COMPLETED
- **Timeline:**
  - Created: 2 hours ago
  - Assigned: 1h 58m ago
  - Accepted: 1h 57m ago
  - Pickup: 1h 55m ago
  - Started: 1h 55m ago
  - Completed: 1h 40m ago

---

### Ride #2: Completed ✅
**Booking ID:** b1000002-0000-0000-0000-000000000002  
**Ride ID:** r1000002-0000-0000-0000-000000000002

- **Customer:** Jane Smith (customer2@example.com)
- **Driver:** Sarah Williams (driver2@example.com)
- **Vehicle:** Honda City - Silver (COMFORT)
- **Route:**
  - 📍 Pickup: District 3, HCMC (10.7756, 106.6898)
  - 📍 Dropoff: District 7, HCMC (10.7329, 106.7172)
- **Distance:** 5.8 km
- **Duration:** 15 minutes (900 seconds)
- **Fare:** 98,000 VND (estimated: 95,000 VND)
- **Payment:** 💳 CARD
- **Status:** ✅ COMPLETED
- **Timeline:**
  - Created: 1 hour ago
  - Completed: 45 minutes ago

---

### Ride #3: In Progress 🚗💨
**Booking ID:** b1000003-0000-0000-0000-000000000003  
**Ride ID:** r1000003-0000-0000-0000-000000000003

- **Customer:** Nguyễn Văn A (nguyen.van.a@gmail.com)
- **Driver:** Phạm Văn D (pham.van.d@gmail.com)
- **Vehicle:** Toyota Camry - Blue (PREMIUM)
- **Route:**
  - 📍 Pickup: Nguyen Hue Walking Street, District 1 (10.7744, 106.7012)
  - 📍 Dropoff: Bitexco Tower, District 1 (10.7714, 106.7044)
- **Distance:** ~1.2 km (estimated)
- **Estimated Fare:** 25,000 VND
- **Payment:** 💵 CASH
- **Status:** 🚗 STARTED (đang di chuyển)
- **Timeline:**
  - Created: 5 minutes ago
  - Assigned: 4 minutes ago
  - Accepted: 3 minutes ago
  - Pickup: 3 minutes ago
  - Started: 2 minutes ago

**👉 Ride này đang active, có thể dùng để test real-time tracking!**

---

## 💳 Payments

| Payment ID | Ride | Amount | Method | Status | Transaction ID |
|------------|------|--------|--------|--------|----------------|
| p1000001-...-001 | r1000001 | 87,000 VND | 💵 CASH | ✅ COMPLETED | TXN-20260205-001 |
| p1000002-...-002 | r1000002 | 98,000 VND | 💳 CARD | ✅ COMPLETED | TXN-20260205-002 |

**Payment cho Ride #3** sẽ được tạo tự động khi ride hoàn thành.

---

## 📬 Notifications (MongoDB)

### Sample Notifications

**Customer Notification:**
- **User:** customer1@example.com
- **Type:** RIDE_COMPLETED
- **Title:** "Ride Completed"
- **Message:** "Your ride to Tan Son Nhat Airport has been completed. Total fare: 87,000 VND"
- **Status:** Unread

**Driver Notification:**
- **User:** driver1@example.com
- **Type:** PAYMENT_RECEIVED
- **Title:** "Payment Received"
- **Message:** "You received 87,000 VND for ride #r1000001"
- **Status:** Unread

---

## ⭐ Reviews (MongoDB)

### Sample Reviews

**Review #1:**
- **Ride:** r1000001 (Ben Thanh → Airport)
- **Customer:** John Doe
- **Driver:** Mike Johnson
- **Rating:** ⭐⭐⭐⭐⭐ (5/5)
- **Comment:** "Excellent driver! Very professional and safe driving."
- **Created:** 95 minutes ago

**Review #2:**
- **Ride:** r1000002 (District 3 → District 7)
- **Customer:** Jane Smith
- **Driver:** Sarah Williams
- **Rating:** ⭐⭐⭐⭐⭐ (5/5)
- **Comment:** "Great service, highly recommended!"
- **Created:** 40 minutes ago

---

## 📊 Redis Data

### Surge Pricing
```
District 1: 1.5x (50% surge)
District 7: 1.2x (20% surge)
```

### Driver Locations (Geo-index)
```
Driver d2000001 (Mike): 10.7729, 106.6980 (Ben Thanh area)
Driver d2000002 (Sarah): 10.7756, 106.6898 (District 3)
Driver d2000004 (Phạm Văn D): 10.7329, 106.7172 (District 7)
```

---

## 🎯 Use Cases for Testing

### 1. Customer Login & Book Ride
```
Login: customer3@example.com / Password123
Action: Book a new ride from your location
Expected: Should find available drivers nearby
```

### 2. Driver Login & Accept Rides
```
Login: driver3@example.com / Password123
Action: Go online, wait for ride requests
Expected: Can see available rides in area
```

### 3. Track Active Ride
```
Login: customer3@example.com / Password123
Action: View Ride #r1000003 (currently STARTED)
Expected: See live tracking of driver location
```

### 4. Admin Dashboard
```
Login: admin@cabsystem.com / Password123
Action: View system stats, all rides, all drivers
Expected: Full admin control panel
```

### 5. Complete Ride Flow
```
1. Customer books ride
2. Driver accepts → arrives at pickup
3. Customer gets in → ride starts
4. Ride completes → payment processed
5. Customer rates driver
6. Both receive notifications
```

---

## 📍 Sample Locations (Ho Chi Minh City)

| Location | Latitude | Longitude | Description |
|----------|----------|-----------|-------------|
| Ben Thanh Market | 10.7729 | 106.6980 | Famous landmark, District 1 |
| Tan Son Nhat Airport | 10.8187 | 106.6524 | International airport |
| Nguyen Hue Walking Street | 10.7744 | 106.7012 | Tourist area, District 1 |
| Bitexco Tower | 10.7714 | 106.7044 | Skyscraper, District 1 |
| District 3 Center | 10.7756 | 106.6898 | Residential area |
| District 7 Center | 10.7329 | 106.7172 | Expat area |

---

## 🔄 Ride State Machine

```
PENDING → ASSIGNED → ACCEPTED → PICKUP → STARTED → COMPLETED
           ↓          ↓                      ↓
        CANCELLED  CANCELLED            CANCELLED
```

**Sample Ride #3** đang ở trạng thái **STARTED**, có thể test các actions:
- ✅ **Complete ride** → trigger payment
- ❌ **Cancel ride** → test cancellation flow
- 📍 **Update location** → test real-time tracking

---

## 🚀 How to Seed Data

### PostgreSQL
```bash
# Seed vào database
docker exec -i cab-postgres psql -U postgres < scripts/seed-sample-data.sql

# Verify
docker exec -it cab-postgres psql -U postgres -d ride_db -c "SELECT id, status FROM rides;"
```

### MongoDB
```bash
# Connect to MongoDB
docker exec -it cab-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin

# Run MongoDB seeding commands (xem trong file SQL)
```

### Redis
```bash
# Set surge pricing
docker exec -it cab-redis redis-cli SET surge:District1 1.5 EX 3600
docker exec -it cab-redis redis-cli SET surge:District7 1.2 EX 3600

# Add driver locations
docker exec -it cab-redis redis-cli GEOADD drivers:online 106.6980 10.7729 "d2000001-0000-0000-0000-000000000001"
```

---

## ✅ Data Summary

| Entity | Count | Status |
|--------|-------|--------|
| **Users** | 9 total | 4 customers, 4 drivers, 1 admin |
| **Drivers** | 4 | 3 online, 1 offline |
| **Vehicles** | 4 | All active |
| **Bookings** | 3 | 2 confirmed, 1 pending |
| **Rides** | 3 | 2 completed, 1 in-progress |
| **Payments** | 2 | Both completed |
| **Reviews** | 2 | Both 5-star ratings |
| **Notifications** | 2 | For completed rides |

---

## 🔗 Related Documentation

- [Backend Services](../README.md)
- [Database Schema](init-db.sql)
- [API Documentation](../FRONTEND-DEVELOPMENT-GUIDE.txt)
- [Test Report](../tests/comprehensive-test-report.txt)

---

**Last Updated:** 2026-02-05  
**Data Version:** 1.0  
**Environment:** Development/Testing

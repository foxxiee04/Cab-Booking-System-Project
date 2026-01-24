# 📊 Database Schema - Cấu Trúc CSDL Đầy Đủ

> **Tài liệu chi tiết cấu trúc database của Cab Booking System**

---

## 🏛️ Tổng quan Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (3000)                       │
└──────────────┬──────────────┬──────────────┬────────────────┘
               │              │              │
        ┌──────▼──┐     ┌─────▼───┐    ┌───▼─────┐
        │ Ride    │     │ Payment │    │ Driver  │
        │ Service │     │ Service │    │ Service │
        │ (3002)  │     │ (3004)  │    │ (3003)  │
        └──────┬──┘     └──┬──────┘    └──┬──────┘
               │           │              │
        ┌──────▼───────────▼──────────────▼─────┐
        │       PostgreSQL (5432)               │
        │  ┌─────────────┐  ┌──────────────┐   │
        │  │ cab_rides   │  │ cab_payments │   │
        │  │  (Tables)   │  │   (Tables)   │   │
        │  └─────────────┘  └──────────────┘   │
        └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│       MongoDB (27017) - NoSQL for flexible data             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Collections:                                         │  │
│  │  • users (Auth, profiles)                            │  │
│  │  • refresh_tokens (Session management)               │  │
│  │  • drivers (Driver profiles, vehicle info)           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│   Redis (6379) - Cache & Geospatial data                    │
│  • drivers:geo (Driver locations via GEOADD)               │
│  • session:* (Token caching)                               │
│  • cache:* (General cache with TTL)                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  RabbitMQ (5672) - Event Message Broker                     │
│  • ride:* (Ride events)                                    │
│  • payment:* (Payment events)                              │
│  • driver:* (Driver events)                                │
│  • notification:* (Notification events)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ PostgreSQL - cab_rides (Ride Service)

### 📌 Table: Ride
Bảng chính quản lý vòng đời của mỗi chuyến xe

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PRIMARY KEY | Unique ride identifier |
| customerId | STRING | NOT NULL | FK to User (MongoDB) |
| driverId | STRING | NULL | FK to Driver (MongoDB), populated when assigned |
| status | ENUM | NOT NULL, default=CREATED | State machine: CREATED → FINDING_DRIVER → ASSIGNED → ACCEPTED → PICKING_UP → IN_PROGRESS → COMPLETED/CANCELLED |
| vehicleType | STRING | default=ECONOMY | ECONOMY \| COMFORT \| PREMIUM |
| paymentMethod | STRING | default=CASH | CASH \| CARD \| WALLET |
| pickupAddress | STRING | NOT NULL | Human-readable pickup location |
| pickupLat | FLOAT | NOT NULL | Latitude of pickup |
| pickupLng | FLOAT | NOT NULL | Longitude of pickup |
| dropoffAddress | STRING | NOT NULL | Human-readable dropoff location |
| dropoffLat | FLOAT | NOT NULL | Latitude of dropoff |
| dropoffLng | FLOAT | NOT NULL | Longitude of dropoff |
| distance | FLOAT | NULL | Calculated distance in km |
| duration | INT | NULL | Estimated duration in seconds |
| fare | FLOAT | NULL | Final fare amount (from Payment Service) |
| surgeMultiplier | FLOAT | default=1.0 | Multiplier for peak pricing (1.0 - 2.5) |
| suggestedDriverIds | STRING[] | default=[] | Array of driver IDs suggested by AI service |
| acceptedDriverId | STRING | NULL | Driver ID who accepted (different from driverId) |
| requestedAt | TIMESTAMP | default=now() | When customer requested ride |
| pickupAt | TIMESTAMP | NULL | When driver picked up customer |
| assignedAt | TIMESTAMP | NULL | When system assigned driver |
| acceptedAt | TIMESTAMP | NULL | When driver accepted ride |
| startedAt | TIMESTAMP | NULL | When ride actually started |
| completedAt | TIMESTAMP | NULL | When ride completed |
| cancelledAt | TIMESTAMP | NULL | When ride was cancelled |
| cancelReason | STRING | NULL | Reason for cancellation |
| cancelledBy | STRING | NULL | Who cancelled: CUSTOMER \| DRIVER \| SYSTEM |
| createdAt | TIMESTAMP | default=now() | Record creation time |
| updatedAt | TIMESTAMP | auto-update | Last update time |

**Indexes:**
```sql
CREATE INDEX idx_ride_customer_date ON Ride(customerId, createdAt DESC);
CREATE INDEX idx_ride_driver_date ON Ride(driverId, createdAt DESC);
CREATE INDEX idx_ride_status ON Ride(status);
```

**Enums:**
```sql
enum RideStatus = {
  CREATED,
  FINDING_DRIVER,
  ASSIGNED,
  ACCEPTED,
  PICKING_UP,
  IN_PROGRESS,
  COMPLETED,
  CANCELLED
}
```

**State Machine Transitions:**
```
CREATED 
  → FINDING_DRIVER (Auto when ride.created event)
  → CANCELLED (Customer cancels before driver found)

FINDING_DRIVER 
  → ASSIGNED (AI suggests drivers)
  → CANCELLED (Timeout or customer cancels)

ASSIGNED 
  → ACCEPTED (Driver accepts from suggestions)
  → CANCELLED

ACCEPTED 
  → PICKING_UP (Driver has arrived at pickup)
  → CANCELLED

PICKING_UP 
  → IN_PROGRESS (Customer got in, ride started)

IN_PROGRESS 
  → COMPLETED (Reached destination)
  → CANCELLED (Emergency)

COMPLETED ✓
CANCELLED ✓
```

---

### 📌 Table: RideStateTransition
Audit trail của tất cả state transitions

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PRIMARY KEY | Unique transition record |
| rideId | UUID | NOT NULL, FK | Links to Ride |
| fromStatus | ENUM | NULL | Previous status (NULL if from CREATED) |
| toStatus | ENUM | NOT NULL | New status |
| actorId | STRING | NULL | User ID who triggered change |
| actorType | STRING | NULL | CUSTOMER \| DRIVER \| SYSTEM |
| reason | STRING | NULL | Why transition happened |
| occurredAt | TIMESTAMP | default=now() | When transition occurred |

**Purpose:**
- Tracing complete ride lifecycle
- Audit & compliance
- Debugging state machine issues
- Analytics on transition patterns

---

## 🗄️ PostgreSQL - cab_payments (Payment Service)

### 📌 Table: Fare
Tính toán giá tiền cho mỗi chuyến

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PRIMARY KEY | Unique fare record |
| rideId | STRING | NOT NULL, UNIQUE | 1:1 relationship with Ride |
| baseFare | FLOAT | NOT NULL | Base fare by vehicle type: ECONOMY=15k, COMFORT=25k, PREMIUM=35k (VND) |
| distanceFare | FLOAT | NOT NULL | Distance charge: baseFare/km |
| timeFare | FLOAT | NOT NULL | Time charge: baseFare/(60 seconds) |
| surgeMultiplier | FLOAT | default=1.0 | Peak pricing multiplier |
| totalFare | FLOAT | NOT NULL | Total = (baseFare + distanceFare + timeFare) × surgeMultiplier |
| distanceKm | FLOAT | NOT NULL | Actual distance traveled |
| durationMinutes | INT | NOT NULL | Actual duration in minutes |
| currency | STRING | default=VND | Currency code |
| createdAt | TIMESTAMP | default=now() | When fare calculated |
| updatedAt | TIMESTAMP | auto-update | If recalculated (rare) |

**Pricing Formula:**
```
totalFare = (baseFare + distanceFare + timeFare) × surgeMultiplier

Where:
  baseFare = {
    "ECONOMY": 15000,
    "COMFORT": 25000,
    "PREMIUM": 35000
  } VND
  
  distanceFare = baseFare × (distanceKm / 10)
  timeFare = baseFare × (durationSeconds / 1800)
  surgeMultiplier = 1.0 - 2.5 (based on demand)
```

**Example:**
```
ECONOMY ride, 3 km, 600 seconds (10 min), surge=1.2
  baseFare = 15,000
  distanceFare = 15,000 × (3/10) = 4,500
  timeFare = 15,000 × (600/1800) = 5,000
  totalFare = (15,000 + 4,500 + 5,000) × 1.2 = 33,000 VND
```

---

### 📌 Table: Payment
Xử lý thanh toán cho mỗi chuyến

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PRIMARY KEY | Unique payment record |
| rideId | STRING | NOT NULL, UNIQUE | Links to Ride & Fare |
| customerId | STRING | NOT NULL | Who pays |
| driverId | STRING | NULL | Driver receives commission |
| amount | FLOAT | NOT NULL | Amount to pay (same as fare.totalFare) |
| currency | STRING | default=VND | Currency code |
| method | ENUM | default=CASH | CASH \| CARD \| WALLET |
| provider | ENUM | default=MOCK | STRIPE \| MOCK \| MOMO \| ZALOPAY |
| status | ENUM | default=PENDING | PENDING → PROCESSING → COMPLETED/FAILED/REFUNDED |
| transactionId | STRING | NULL | External transaction ID from provider |
| paymentIntentId | STRING | NULL | Stripe payment intent ID |
| paymentMethodId | STRING | NULL | Saved payment method ID |
| clientSecret | STRING | NULL | Stripe client secret for front-end |
| idempotencyKey | STRING | NULL | Prevent duplicate charges |
| gatewayResponse | STRING | NULL | JSON response from payment gateway |
| metadata | JSON | NULL | Custom metadata for tracking |
| initiatedAt | TIMESTAMP | default=now() | When payment initiated |
| completedAt | TIMESTAMP | NULL | When payment succeeded |
| failedAt | TIMESTAMP | NULL | When payment failed |
| refundedAt | TIMESTAMP | NULL | When refund processed |
| failureReason | STRING | NULL | Error message if failed |
| createdAt | TIMESTAMP | default=now() | Record creation |
| updatedAt | TIMESTAMP | auto-update | Last update |

**Enums:**
```sql
enum PaymentStatus = {
  PENDING,           -- Awaiting confirmation
  PROCESSING,        -- Currently processing
  REQUIRES_ACTION,   -- Needs 3D secure, OTP, etc.
  COMPLETED,         -- Successfully paid ✓
  FAILED,            -- Payment failed ✗
  REFUNDED           -- Money returned to customer
}

enum PaymentMethod = {
  CASH,              -- Cash payment at pickup
  CARD,              -- Credit/Debit card
  WALLET             -- Digital wallet (Momo, ZaloPay)
}

enum PaymentProvider = {
  STRIPE,            -- International
  MOCK,              -- For testing
  MOMO,              -- Vietnam
  ZALOPAY            -- Vietnam
}
```

**Indexes:**
```sql
CREATE INDEX idx_payment_customer_date ON Payment(customerId, createdAt DESC);
CREATE INDEX idx_payment_driver_date ON Payment(driverId, createdAt DESC);
CREATE INDEX idx_payment_status ON Payment(status);
```

**Payment Flow:**
```
1. Ride completes → Event: ride.completed
2. Payment Service receives event
3. Check Fare exists → Calculate if not
4. Create Payment record (status=PENDING)
5. Send to payment provider
6. Update status (PROCESSING)
7. On callback: Update status (COMPLETED/FAILED)
8. If CASH: Mark as COMPLETED immediately
9. Emit: payment.completed or payment.failed
```

---

### 📌 Table: OutboxEvent
Outbox pattern cho reliable event publishing

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PRIMARY KEY | Unique event record |
| eventType | STRING | NOT NULL | Event type name |
| payload | STRING | NOT NULL | JSON string of event data |
| correlationId | STRING | NOT NULL | Trace ID for debugging |
| createdAt | TIMESTAMP | default=now() | When event created |
| publishedAt | TIMESTAMP | NULL | When successfully published to RabbitMQ |

**Purpose:**
- Guarantee event publishing (at-least-once delivery)
- Polling job queries unpublished events
- Marks as published only after RabbitMQ ACK

**Index:**
```sql
CREATE INDEX idx_outbox_published ON OutboxEvent(publishedAt);
```

---

## 🗄️ MongoDB - Auth Service

### 📌 Collection: users
User accounts (customers, drivers, admins)

```javascript
{
  _id: ObjectId,
  email: string,              // unique, indexed
  phone: string,              // unique, sparse
  passwordHash: string,       // bcrypt hashed
  role: "CUSTOMER" | "DRIVER" | "ADMIN",
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  profile: {
    firstName: string,
    lastName: string,
    avatar: string            // URL to profile picture
  },
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Indexes:**
```javascript
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true });
db.users.createIndex({ role: 1, status: 1 });
```

**TTL Index for soft-deletes:**
```javascript
db.users.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days
```

---

### 📌 Collection: refresh_tokens
Session management & token revocation

```javascript
{
  _id: ObjectId,
  tokenId: string,            // unique, JWT jti claim
  userId: ObjectId,           // Reference to users._id
  expiresAt: ISODate,         // When token expires
  revokedAt: ISODate,         // NULL if still valid
  deviceInfo: string,         // User agent / device identifier
  ipAddress: string,          // Client IP address
  createdAt: ISODate
}
```

**Indexes:**
```javascript
db.refresh_tokens.createIndex({ tokenId: 1 }, { unique: true });
db.refresh_tokens.createIndex({ userId: 1 });
db.refresh_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired
```

**Purpose:**
- Track active sessions
- Revoke tokens on logout
- Detect suspicious activity (multiple IPs)

---

## 🗄️ MongoDB - Driver Service

### 📌 Collection: drivers
Driver profiles & vehicle information

```javascript
{
  _id: ObjectId,
  userId: string,             // unique, Reference to User._id
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED",  // Approval status
  availabilityStatus: "OFFLINE" | "ONLINE" | "BUSY",            // Real-time status
  
  vehicle: {
    type: "CAR" | "MOTORCYCLE" | "SUV",
    brand: string,            // Toyota, Honda, etc.
    model: string,            // Camry, Civic, etc.
    plate: string,            // unique, License plate
    color: string,
    year: number
  },
  
  license: {
    number: string,
    expiryDate: ISODate,
    verified: boolean
  },
  
  rating: {
    average: number,          // 0-5 stars
    count: number             // Total reviews
  },
  
  currentRideId: string,      // NULL when not in a ride
  lastLocation: {
    lat: number,
    lng: number,
    updatedAt: ISODate
  },
  
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Indexes:**
```javascript
db.drivers.createIndex({ userId: 1 }, { unique: true });
db.drivers.createIndex({ status: 1 });
db.drivers.createIndex({ availabilityStatus: 1 });
db.drivers.createIndex({ 'vehicle.plate': 1 }, { unique: true });
db.drivers.createIndex({ 'lastLocation': '2dsphere' });  // Geospatial queries
```

**Rating Calculation:**
```javascript
// After each completed ride, update:
rating: {
  average: (oldAverage × oldCount + newRating) / (oldCount + 1),
  count: oldCount + 1
}
```

---

## 🗄️ Redis - Cache & Geospatial

### 📌 Key: drivers:geo
Real-time driver location tracking

**Data Type:** Sorted Set (ZSET)
**Structure:** Geospatial coordinates

```bash
# Add driver location
GEOADD drivers:geo 106.660172 10.762622 driver_001
#                 longitude   latitude  member

# Find drivers within 5km of point
GEORADIUS drivers:geo 106.670000 10.770000 5 km WITHDIST

# Find nearest 10 drivers
GEORADIUSBYMEMBER drivers:geo driver_001 10 km COUNT 10
```

**TTL Management:**
- Redis GEOADD has NO built-in TTL
- Driver Service runs cleanup every 5 minutes
- Removes locations not updated in > 30 min
- Calls `cleanupStaleLocations()` method

---

### 📌 Key: session:{sessionId}
User session caching

```
Key: session:abc123def456
Value: {
  userId: "user_001",
  role: "CUSTOMER",
  email: "customer@example.com",
  tokenId: "jti_xyz"
}
TTL: 24 hours
```

---

### 📌 Key: cache:{resourceType}:{resourceId}
General cache with TTL

```
Examples:
  cache:user:user_001 → User profile JSON
  cache:driver:driver_001 → Driver profile JSON
  cache:ride:ride_001 → Ride details JSON
TTL: 5-60 minutes (configurable per resource)
```

---

## 📨 RabbitMQ - Event Topics

### Topic: ride.* (Ride Events)

```
ride:created
  Payload: {
    rideId, customerId, pickupLat, pickupLng, 
    dropoffLat, dropoffLng, vehicleType, 
    paymentMethod, surgeMultiplier, timestamp
  }
  Subscribers: AI Service (estimate), Driver Service (matching), 
              Notification Service

ride:finding_driver
  Payload: { rideId, suggestedDriverIds[] }
  Subscribers: Driver Service, Notification Service

ride:assigned
  Payload: { rideId, driverId, pickupLat, pickupLng }
  Subscribers: Driver Service, Notification Service

ride:accepted
  Payload: { rideId, driverId }
  Subscribers: Notification Service

ride:picking_up
  Payload: { rideId, driverId, lat, lng }
  Subscribers: Notification Service

ride:in_progress
  Payload: { rideId, driverId, lat, lng }
  Subscribers: Notification Service

ride:completed
  Payload: {
    rideId, customerId, driverId, 
    distanceKm, durationSeconds, 
    vehicleType, paymentMethod, 
    surgeMultiplier, fare, timestamp
  }
  Subscribers: Payment Service (charge customer), 
              Driver Service (update earnings), 
              Notification Service

ride:cancelled
  Payload: { rideId, reason, cancelledBy }
  Subscribers: Payment Service, Notification Service
```

---

### Topic: payment.* (Payment Events)

```
payment:created
  Payload: { paymentId, rideId, amount, method, provider }
  Subscribers: Notification Service

payment:processing
  Payload: { paymentId, rideId, transactionId }

payment:completed
  Payload: {
    paymentId, rideId, amount, 
    method, provider, completedAt
  }
  Subscribers: Driver Service (commission), Notification Service

payment:failed
  Payload: { paymentId, rideId, failureReason }
  Subscribers: Notification Service (alert customer)

payment:refunded
  Payload: { paymentId, rideId, amount, refundReason }
  Subscribers: Driver Service, Notification Service
```

---

### Topic: driver.* (Driver Events)

```
driver:location:updated
  Payload: { driverId, lat, lng, timestamp }
  Subscribers: Redis (geospatial update), Notification Service

driver:online
  Payload: { driverId, timestamp }

driver:offline
  Payload: { driverId, timestamp }

driver:rating:updated
  Payload: { driverId, newRating, totalReviews }
```

---

## 🔗 Relationships

```
User (MongoDB)
  ├─ Many Rides (PostgreSQL)
  ├─ Many Payments (PostgreSQL)
  └─ RefreshTokens (MongoDB)

Driver (MongoDB)
  ├─ Assigned to Rides (PostgreSQL)
  ├─ Receives Payments (PostgreSQL)
  └─ Has Locations (Redis)

Ride (PostgreSQL)
  ├─ One Fare (PostgreSQL)
  ├─ One Payment (PostgreSQL)
  └─ Many RideStateTransitions (PostgreSQL)

Payment (PostgreSQL)
  ├─ One Fare (PostgreSQL)
  └─ One OutboxEvent (PostgreSQL)
```

---

## 🔐 Data Consistency

### Saga Pattern (Distributed Transactions)

**Ride Completion Flow:**
```
1. Ride Service: ride.completed event
   → RideStateTransition: IN_PROGRESS → COMPLETED

2. Payment Service: receives ride.completed
   → Fare: CREATE if not exists
   → Payment: CREATE with status=PENDING
   → Emit: payment:created

3. Payment Service: Process payment
   → Payment: UPDATE status=PROCESSING
   → Call payment provider
   → Payment: UPDATE status=COMPLETED/FAILED
   → Emit: payment:completed or payment:failed

4. Driver Service: receives payment:completed
   → Driver: UPDATE earnings, rating

5. Notification Service: 
   → Send SMS/Email/Push to customer & driver
```

**Compensation (Rollback):**
- If payment fails → mark Payment.status = FAILED
- If driver service fails → Payment Service retries
- Outbox pattern ensures eventual consistency

---

## 📊 Partitioning Strategy

### PostgreSQL (Production scale):
```
Ride table: Partition by range on createdAt
  - ride_2024_q1, ride_2024_q2, etc.
  - Improves query performance on large tables

Payment table: Partition by hash on customerId
  - Distribute payment records across nodes
```

### MongoDB:
```
drivers collection: Shard by userId
  - Distribute driver data across replica sets

refresh_tokens: Auto-delete with TTL index
  - Old expired tokens removed automatically
```

---

## 🚨 Data Integrity Constraints

### Unique Constraints:
```sql
-- PostgreSQL
ALTER TABLE Ride ADD CONSTRAINT unique_active_ride_per_customer
  UNIQUE NULLS NOT DISTINCT (customerId, status)
  WHERE status IN ('CREATED', 'FINDING_DRIVER', 'ASSIGNED', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS');

ALTER TABLE Fare ADD CONSTRAINT unique_fare_per_ride
  UNIQUE (rideId);

ALTER TABLE Payment ADD CONSTRAINT unique_payment_per_ride
  UNIQUE (rideId);
```

### Foreign Key Constraints:
```
Ride.rideId ← RideStateTransition.rideId (CASCADE DELETE)
Fare.rideId ← Payment.rideId (CASCADE DELETE)
Payment.rideId ← OutboxEvent.correlationId (on delete mark as failed)
```

---

## 📈 Monitoring & Maintenance

### Indexes to Monitor:
```sql
-- Check index bloat
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Rebuild fragmented indexes
REINDEX INDEX idx_ride_customer_date;
```

### Backup Strategy:
```bash
# PostgreSQL daily backup
pg_dump cab_rides > backup_$(date +%Y%m%d).sql

# MongoDB backup
mongodump --db cab_auth --out backup_$(date +%Y%m%d)/

# Redis snapshot
SAVE  # Blocks, use BGSAVE for non-blocking
```

---

**Version**: 1.0  
**Last Updated**: January 2026  
**Status**: ✅ Complete & Validated

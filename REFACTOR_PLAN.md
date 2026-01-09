# REFACTOR PLAN - Cab Booking System v2

## I. BACKEND REFACTOR

### 1. Ride Service - Status Flow
**Current:** PENDING → ASSIGNED (auto) → ACCEPTED → IN_PROGRESS → COMPLETED
**New:** CREATED → FINDING_DRIVER → ASSIGNED (when driver accepts) → PICKING_UP → IN_PROGRESS → COMPLETED

**Changes needed:**
- Add `FINDING_DRIVER` status after ride created
- Remove auto-assign from `createRide()` 
- Rename `PENDING` → `CREATED`
- Add `PICKING_UP` status (between ASSIGNED and IN_PROGRESS)
- Create endpoint `/api/rides/available` - list available rides for drivers
- Create endpoint `/api/rides/:id/driver-accept` - driver accepts a ride (assigns driver)
- Create endpoint `/api/rides/:id/pickup` - driver marks passenger picked up

**Ride Schema updates needed:**
```
vehicleType: 'ECONOMY' | 'COMFORT' | 'PREMIUM'
paymentMethod: 'CASH' | 'CARD' | 'WALLET'
estimatedPickupTime: number (seconds)
suggestedDrivers: string[] (array of driver IDs)
acceptedDriverId?: string
acceptedAt?: Date
pickupAt?: Date
```

---

### 2. AI Service - Enhanced Logic
**Current:** Only returns fare estimate
**New:** Returns driver suggestions based on distance + status

**New endpoints:**
- `POST /api/ride/find-drivers` 
  - Input: pickup coords, search radius, vehicle type
  - Output: array of { driverId, distance, rating, acceptanceRate, eta }
  - Logic: Query drivers within radius who are ONLINE and vehicle matches
  
- `POST /api/ride/estimate`
  - Already exists, no change needed

**Backend integration:**
- When ride created: Call AI to get driver suggestions
- Save suggestions to Ride.suggestedDrivers
- Publish event to notify suggested drivers

---

### 3. Driver Service - Changes
**Current:** Auto-assigns drivers, has polling logic
**New:** 
- Remove auto-assign from event listener
- Create new endpoint `/api/drivers/available-rides` 
  - Input: driverId, lat, lng
  - Output: List of available rides nearby (FINDING_DRIVER status)
  - Filter by: distance, vehicle type match, driver rating requirements
  - Sort by: distance, fare, customer rating

- Create endpoint `/api/drivers/:driverId/rides/:rideId/accept`
  - Changes ride status: FINDING_DRIVER → ASSIGNED
  - Sets driverId on ride
  - Removes ride from other drivers' lists
  - Publishes `ride.assigned` event

**Remove:**
- Automatic assignment from event consumer
- Polling logic from frontend

---

### 4. Notification Service - Updates
**Current:** Sends notifications to single driver
**New:** 
- Send notification to array of suggested drivers
- Track who accepted first
- Cancel notification for others when ride accepted

---

### 5. Payment Service - Add Vehicle Type Pricing
**Current:** Flat rate calculation
**New:**
```typescript
calculateFare(distance, duration, vehicleType, surgeMultiplier) {
  let baseFare = 15000;   // ECONOMY
  let perKmRate = 12000;
  
  if (vehicleType === 'COMFORT') {
    baseFare = 25000;
    perKmRate = 18000;
  } else if (vehicleType === 'PREMIUM') {
    baseFare = 35000;
    perKmRate = 25000;
  }
  
  return (baseFare + distance * perKmRate + duration * 500) * surgeMultiplier;
}
```

---

## II. FRONTEND REFACTOR

### 1. Customer App - Book Page
**Add:**
- Vehicle type selector (radio/card buttons)
  - ECONOMY: 15k base
  - COMFORT: 25k base
  - PREMIUM: 35k base
  
- Payment method selector
  - CASH
  - CARD
  - WALLET
  
- Show available balance if WALLET selected

- ETA display with breakdown: distance, time, estimated fare

**Remove:**
- Auto-show ride assignment notification
- Change to show "Searching for drivers..." state

---

### 2. Customer App - Tracking Page
**Show states:**
1. **FINDING_DRIVER**: "Đang tìm tài xế gần nhất..."
2. **ASSIGNED**: "Tài xế [Name] đã nhận cuốc. [ETA] phút"
   - Show driver avatar, rating, vehicle
   - Show driver location on map
3. **PICKING_UP**: "Tài xế đang đến đón..."
4. **IN_PROGRESS**: "Đang di chuyển tới điểm đến"
5. **COMPLETED**: "Chuyến đi hoàn thành. Tổng: [Fare]"

---

### 3. Driver App - Complete Redesign
**Old:** "Waiting for notification" → accepts from popup
**New:** Dashboard with available rides list

**Pages:**
1. **Dashboard (Home)**
   - Status toggle (OFFLINE/ONLINE)
   - Available rides nearby (scrollable list)
   - Current earnings + trips today
   
2. **Available Rides List** (when ONLINE)
   - Cards show: distance, pickup address, fare estimate, customer rating
   - Tap to view details + MAP
   - Swipe to ACCEPT or SKIP
   
3. **Ride Details** (before accept)
   - Pickup address with map
   - Destination address
   - Customer name & rating
   - Estimated fare + distance
   - ACCEPT / REJECT buttons
   
4. **Active Ride** (after accept)
   - PICKING_UP → Start ride
   - IN_PROGRESS → Complete ride
   - Same as current

---

## III. DATABASE SCHEMA UPDATES

### Ride Table - Add Columns
```sql
vehicleType VARCHAR(20) DEFAULT 'ECONOMY';
paymentMethod VARCHAR(20) DEFAULT 'CASH';
estimatedPickupTimeSeconds INT;
pickupAt TIMESTAMP;
suggestedDriverIds TEXT[]; -- array of driver IDs
```

### Driver Table - Verify Columns
```sql
-- Must have:
status VARCHAR(20) -- OFFLINE, ONLINE, BUSY
rating FLOAT
acceptanceRate FLOAT
lastLocation POINT
approvalStatus VARCHAR(20) -- PENDING_APPROVAL, APPROVED, REJECTED
```

---

## IV. API ENDPOINTS - NEW/CHANGED

### Ride Service
```
POST   /api/rides - create ride (add vehicleType, paymentMethod)
GET    /api/rides/:id - get ride details
GET    /api/rides/available - list nearby available rides for driver
POST   /api/rides/:id/driver-accept - driver accepts ride
PUT    /api/rides/:id/status - update ride status
POST   /api/rides/:id/pickup - mark passenger picked up
POST   /api/rides/:id/complete - complete ride
POST   /api/rides/:id/cancel - cancel ride
GET    /api/rides/customer/:customerId - customer ride history
GET    /api/rides/driver/:driverId - driver ride history
```

### Driver Service
```
GET    /api/drivers/available-rides - list available rides for driver
GET    /api/drivers/:id/profile - driver profile with stats
PUT    /api/drivers/:id/status - change driver status
PUT    /api/drivers/:id/location - update driver location
```

### Payment Service
```
POST   /api/payments/calculate-fare - recalculate fare with vehicle type
POST   /api/payments/process - process payment after ride complete
```

---

## V. IMPLEMENTATION PRIORITY

### Phase 1 (Must Do)
- [ ] Update Ride status flow (CREATED, FINDING_DRIVER, etc.)
- [ ] Add vehicleType + paymentMethod to Ride schema
- [ ] Create GET /api/rides/available endpoint
- [ ] Create POST /api/rides/:id/driver-accept endpoint
- [ ] Update ride-service events (remove auto-assign)
- [ ] Update driver-service (remove auto-assign consumer)

### Phase 2 (Should Do)
- [ ] Update Customer App - add vehicle type + payment method selector
- [ ] Redesign Driver App - list available rides instead of waiting
- [ ] Update AI Service with driver suggestions
- [ ] Add driver profile middleware (rating, acceptance rate)

### Phase 3 (Nice to Have)
- [ ] Add driver approval workflow (Admin)
- [ ] Real-time driver location tracking
- [ ] Driver rating system
- [ ] Wallet balance system
- [ ] Surge pricing improvements

---

## VI. EVENT FLOW (NEW)

### Customer Books Ride
1. Customer enters pickup/dropoff, selects vehicle & payment
2. Call `POST /api/rides` → creates ride with status CREATED
3. Ride-service:
   - Calls AI to get nearby drivers
   - Sets status → FINDING_DRIVER
   - Saves suggested drivers
   - Publishes `ride.finding_driver` event

### System Suggests Drivers
4. Event consumed by Notification-service
5. Send notification to all suggested drivers: "New ride available"
6. Event consumed by Driver-service
7. Ride now appears in their "available rides" list

### Driver Accepts Ride
8. Driver taps ACCEPT on ride card
9. Call `POST /api/rides/:id/driver-accept` with driverId
10. Ride-service:
    - Validates driver is in suggested list
    - Sets status → ASSIGNED
    - Sets driverId
    - Publishes `ride.assigned` event
    - Publish `ride.no_longer_available` event (for other suggested drivers)

### Driver Arrives & Completes
11. Driver taps "Đã tới điểm đón" → Call `POST /api/rides/:id/pickup`
    - Status: ASSIGNED → PICKING_UP
12. Driver taps "Bắt đầu chuyến" → Call `POST /api/rides/:id/status` (IN_PROGRESS)
13. Driver taps "Hoàn thành" → Call `POST /api/rides/:id/complete`
    - Status: IN_PROGRESS → COMPLETED
    - Payment-service calculates final fare
    - Publishes `ride.completed` event


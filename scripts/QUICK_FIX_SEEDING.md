# Quick Fix Guide for Database Seeding

## Issue
The seed script uses snake_case column names (customer_id, driver_id) but Prisma creates camelCase columns (customerId, driverId).

## Solution

### Option 1: Update Seed Script (Recommended)
Update `scripts/seed-database-simple.ts` to match Prisma's camelCase:

**Find and Replace:**
- `customer_id` → `customerId`
- `driver_id` → `driverId`  
- `vehicle_type` → `vehicleType`
- `payment_method` → `paymentMethod`
- `pickup_address` → `pickupAddress`
- `pickup_lat` → `pickupLat`
- `pickup_lng` → `pickupLng`
- `dropoff_address` → `dropoffAddress`
- `dropoff_lat` → `dropoffLat`
- `dropoff_lng` → `dropoffLng`
- `suggested_driver_ids` → `suggestedDriverIds`
- `offered_driver_ids` → `offeredDriverIds`
- `requested_at` → `requestedAt`
- `started_at` → `startedAt`
- `completed_at` → `completedAt`
- `ride_id` → `rideId`
- `base_fare` → `baseFare`
- `distance_fare` → `distanceFare`
- `time_fare` → `timeFare`
- `surge_multiplier` → `surgeMultiplier`
- `total_fare` → `totalFare`
- `distance_km` → `distanceKm`
- `duration_minutes` → `durationMinutes`
- `transaction_id` → `transactionId`
- `initiated_at` → `initiatedAt`
- `completed_at` → `completedAt`
- `estimated_fare` → `estimatedFare`
- `estimated_distance` → `estimatedDistance`
- `estimated_duration` → `estimatedDuration`
- `confirmed_at` → `confirmedAt`

**Column Names Reference:**

```typescript
// Ride table columns (camelCase)
id, customerId, driverId, status, vehicleType, paymentMethod,
pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng,
distance, duration, fare, surgeMultiplier, suggestedDriverIds, offeredDriverIds,
requestedAt, startedAt, completedAt, createdAt, updatedAt

// Payment table columns (camelCase)
id, rideId, customerId, driverId, amount, method, provider, status,
transactionId, initiatedAt, completedAt, createdAt, updatedAt

// Fare table columns (camelCase)
id, rideId, baseFare, distanceFare, timeFare, surgeMultiplier,
totalFare, distanceKm, durationMinutes, createdAt, updatedAt

// Booking table columns (camelCase)
id, customerId, pickupAddress, pickupLat, pickupLng,
dropoffAddress, dropoffLat, dropoffLng, vehicleType, paymentMethod,
estimatedFare, estimatedDistance, estimatedDuration,
status, confirmedAt, createdAt, updatedAt
```

### Option 2: Use Prisma Client (Alternative)
Rewrite the seed script to use Prisma Client instead of raw SQL queries. This automatically handles column mapping.

## After Fixing

Run the seed script:
```bash
cd scripts
seed-database.bat     # Windows
./seed-database.sh    # Linux/Mac
```

Or directly:
```bash
npx tsx scripts/seed-database-simple.ts
```

## Verify Seeding

Check data was inserted:
```bash
docker exec -it cab-postgres psql -U postgres -d auth_db -c "SELECT COUNT(*) FROM users;"
docker exec -it cab-postgres psql -U postgres -d ride_db -c "SELECT COUNT(*) FROM \"Ride\";"
docker exec -it cab-postgres psql -U postgres -d payment_db -c "SELECT COUNT(*) FROM \"Payment\";"
```

Expected counts:
- users: 12 (2 admins + 5 drivers + 5 customers)
- Ride: 5+ rides
- Payment: 3+ payments

## Then Run Backend Tests

```bash
cd scripts
test-backend.bat     # Windows
./test-backend.sh    # Linux/Mac
```

This will validate all API endpoints with the seeded data.

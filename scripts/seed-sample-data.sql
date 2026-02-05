-- ========================================
-- SAMPLE DATA SEED FILE
-- Cab Booking System - Development Data
-- Based on Prisma Schemas
-- ========================================
-- 
-- Password for all users: Password123
-- (bcrypt hash: $2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W)
--
-- ========================================

-- ========================================
-- AUTH SERVICE - auth_db
-- ========================================
\c auth_db

-- Insert users (embedded profiles in auth)
INSERT INTO users (id, email, phone, password_hash, role, status, first_name, last_name, avatar, created_at, updated_at) VALUES
-- Customers
('c1000001-0000-0000-0000-000000000001', 'customer1@example.com', '+84901234001', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'CUSTOMER', 'ACTIVE', 'John', 'Doe', 'https://i.pravatar.cc/150?img=1', NOW() - INTERVAL '30 days', NOW()),
('c1000002-0000-0000-0000-000000000002', 'customer2@example.com', '+84901234002', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'CUSTOMER', 'ACTIVE', 'Jane', 'Smith', 'https://i.pravatar.cc/150?img=2', NOW() - INTERVAL '25 days', NOW()),
('c1000003-0000-0000-0000-000000000003', 'nguyen.van.a@gmail.com', '+84901234003', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'CUSTOMER', 'ACTIVE', 'Nguyễn', 'Văn A', 'https://i.pravatar.cc/150?img=3', NOW() - INTERVAL '20 days', NOW()),
('c1000004-0000-0000-0000-000000000004', 'tran.thi.b@gmail.com', '+84901234004', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'CUSTOMER', 'ACTIVE', 'Trần', 'Thị B', 'https://i.pravatar.cc/150?img=4', NOW() - INTERVAL '15 days', NOW()),

-- Drivers
('d2000001-0000-0000-0000-000000000001', 'driver1@example.com', '+84902345001', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'DRIVER', 'ACTIVE', 'Mike', 'Johnson', 'https://i.pravatar.cc/150?img=11', NOW() - INTERVAL '60 days', NOW()),
('d2000002-0000-0000-0000-000000000002', 'driver2@example.com', '+84902345002', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'DRIVER', 'ACTIVE', 'Sarah', 'Williams', 'https://i.pravatar.cc/150?img=12', NOW() - INTERVAL '55 days', NOW()),
('d2000003-0000-0000-0000-000000000003', 'le.van.c@gmail.com', '+84902345003', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'DRIVER', 'ACTIVE', 'Lê', 'Văn C', 'https://i.pravatar.cc/150?img=13', NOW() - INTERVAL '50 days', NOW()),
('d2000004-0000-0000-0000-000000000004', 'pham.van.d@gmail.com', '+84902345004', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'DRIVER', 'ACTIVE', 'Phạm', 'Văn D', 'https://i.pravatar.cc/150?img=14', NOW() - INTERVAL '45 days', NOW()),

-- Admin
('a3000001-0000-0000-0000-000000000001', 'admin@cabsystem.com', '+84900000000', '$2b$10$rJZpYKZm5xNKp.r4vHVkOuZP7N8p1qQvT9V7kJXlZOqHxY9Vz9.3W', 'ADMIN', 'ACTIVE', 'System', 'Administrator', 'https://i.pravatar.cc/150?img=99', NOW() - INTERVAL '90 days', NOW());


-- ========================================
-- DRIVER SERVICE - driver_db
-- ========================================
\c driver_db

-- Insert drivers (with embedded vehicle info)
INSERT INTO drivers (id, user_id, status, availability_status, vehicle_type, vehicle_brand, vehicle_model, vehicle_plate, vehicle_color, vehicle_year, license_number, license_expiry_date, license_verified, rating_average, rating_count, current_ride_id, last_location_lat, last_location_lng, last_location_time, created_at, updated_at) VALUES
('d2000001-0000-0000-0000-000000000001', 'd2000001-0000-0000-0000-000000000001', 'APPROVED', 'ONLINE', 'CAR', 'Toyota', 'Vios', '51A-12345', 'White', 2022, 'DL12345678', NOW() + INTERVAL '2 years', true, 4.8, 245, NULL, 10.7729, 106.6980, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '60 days', NOW()),

('d2000002-0000-0000-0000-000000000002', 'd2000002-0000-0000-0000-000000000002', 'APPROVED', 'ONLINE', 'CAR', 'Honda', 'City', '51B-67890', 'Silver', 2023, 'DL87654321', NOW() + INTERVAL '2 years', true, 4.9, 312, NULL, 10.7756, 106.6898, NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '55 days', NOW()),

('d2000003-0000-0000-0000-000000000003', 'd2000003-0000-0000-0000-000000000003', 'APPROVED', 'OFFLINE', 'CAR', 'Hyundai', 'Accent', '51C-11111', 'Black', 2021, 'DL11111111', NOW() + INTERVAL '1 year', true, 4.7, 189, NULL, NULL, NULL, NULL, NOW() - INTERVAL '50 days', NOW()),

('d2000004-0000-0000-0000-000000000004', 'd2000004-0000-0000-0000-000000000004', 'APPROVED', 'BUSY', 'CAR', 'Toyota', 'Camry', '51D-22222', 'Blue', 2024, 'DL22222222', NOW() + INTERVAL '3 years', true, 4.6, 156, 'r1000003-0000-0000-0000-000000000003', 10.7730, 106.7020, NOW() - INTERVAL '1 minute', NOW() - INTERVAL '45 days', NOW());


-- ========================================
-- BOOKING SERVICE - booking_db
-- ========================================
\c booking_db

-- Insert bookings (camelCase columns)
INSERT INTO "Booking" (id, "customerId", "pickupAddress", "pickupLat", "pickupLng", "dropoffAddress", "dropoffLat", "dropoffLng", "vehicleType", "paymentMethod", "estimatedFare", "estimatedDistance", "estimatedDuration", "surgeMultiplier", status, notes, "customerPhone", "createdAt", "updatedAt", "confirmedAt", "cancelledAt") VALUES
-- Booking #1 (Completed ride)
('b1000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'Ben Thanh Market, District 1, HCMC', 10.7729, 106.6980, 'Tan Son Nhat Airport, HCMC', 10.8187, 106.6524, 'ECONOMY', 'CASH', 85000, 7.2, 1200, 1.0, 'CONFIRMED', NULL, '+84901234001', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NULL),

-- Booking #2 (Completed ride)
('b1000002-0000-0000-0000-000000000002', 'c1000002-0000-0000-0000-000000000002', 'District 3, HCMC', 10.7756, 106.6898, 'District 7, HCMC', 10.7329, 106.7172, 'COMFORT', 'CARD', 95000, 5.8, 900, 1.2, 'CONFIRMED', NULL, '+84901234002', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NULL),

-- Booking #3 (In-progress ride)
('b1000003-0000-0000-0000-000000000003', 'c1000003-0000-0000-0000-000000000003', 'Nguyen Hue Walking Street, District 1', 10.7744, 106.7012, 'Bitexco Tower, District 1', 10.7714, 106.7044, 'PREMIUM', 'CASH', 25000, 1.2, 300, 1.0, 'CONFIRMED', NULL, '+84901234003', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes', NULL);


-- ========================================
-- RIDE SERVICE - ride_db
-- ========================================
\c ride_db

-- Insert rides (camelCase columns, PascalCase table name)
INSERT INTO "Ride" (id, "customerId", "driverId", status, "vehicleType", "paymentMethod", "pickupAddress", "pickupLat", "pickupLng", "dropoffAddress", "dropoffLat", "dropoffLng", distance, duration, fare, "surgeMultiplier", "suggestedDriverIds", "offeredDriverIds", "rejectedDriverIds", "reassignAttempts", "acceptedDriverId", "requestedAt", "pickupAt", "offeredAt", "assignedAt", "acceptedAt", "startedAt", "completedAt", "cancelledAt", "cancelReason", "cancelledBy", "createdAt", "updatedAt") VALUES
-- Ride #1: Completed (Ben Thanh → Airport)
('r1000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'd2000001-0000-0000-0000-000000000001', 'COMPLETED', 'ECONOMY', 'CASH', 'Ben Thanh Market, District 1, HCMC', 10.7729, 106.6980, 'Tan Son Nhat Airport, HCMC', 10.8187, 106.6524, 7.2, 1200, 87000, 1.0, '{}', '{d2000001-0000-0000-0000-000000000001}', '{}', 0, 'd2000001-0000-0000-0000-000000000001', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 55 minutes', NOW() - INTERVAL '1 hour 58 minutes', NOW() - INTERVAL '1 hour 58 minutes', NOW() - INTERVAL '1 hour 57 minutes', NOW() - INTERVAL '1 hour 55 minutes', NOW() - INTERVAL '1 hour 40 minutes', NULL, NULL, NULL, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 40 minutes'),

-- Ride #2: Completed (District 3 → District 7)
('r1000002-0000-0000-0000-000000000002', 'c1000002-0000-0000-0000-000000000002', 'd2000002-0000-0000-0000-000000000002', 'COMPLETED', 'COMFORT', 'CARD', 'District 3, HCMC', 10.7756, 106.6898, 'District 7, HCMC', 10.7329, 106.7172, 5.8, 900, 98000, 1.2, '{}', '{d2000002-0000-0000-0000-000000000002}', '{}', 0, 'd2000002-0000-0000-0000-000000000002', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '55 minutes', NOW() - INTERVAL '58 minutes', NOW() - INTERVAL '58 minutes', NOW() - INTERVAL '57 minutes', NOW() - INTERVAL '55 minutes', NOW() - INTERVAL '45 minutes', NULL, NULL, NULL, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes'),

-- Ride #3: In Progress (Nguyen Hue → Bitexco)
('r1000003-0000-0000-0000-000000000003', 'c1000003-0000-0000-0000-000000000003', 'd2000004-0000-0000-0000-000000000004', 'IN_PROGRESS', 'PREMIUM', 'CASH', 'Nguyen Hue Walking Street, District 1', 10.7744, 106.7012, 'Bitexco Tower, District 1', 10.7714, 106.7044, NULL, NULL, NULL, 1.0, '{}', '{d2000004-0000-0000-0000-000000000004}', '{}', 0, 'd2000004-0000-0000-0000-000000000004', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '2 minutes', NULL, NULL, NULL, NULL, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '2 minutes');

-- Insert ride state transitions (camelCase columns)
INSERT INTO "RideStateTransition" (id, "rideId", "fromStatus", "toStatus", "actorId", "actorType", reason, "occurredAt") VALUES
-- Ride #1 transitions
('t1-001', 'r1000001-0000-0000-0000-000000000001', NULL, 'CREATED', 'c1000001-0000-0000-0000-000000000001', 'CUSTOMER', NULL, NOW() - INTERVAL '2 hours'),
('t1-002', 'r1000001-0000-0000-0000-000000000001', 'CREATED', 'OFFERED', NULL, 'SYSTEM', 'Driver matching', NOW() - INTERVAL '1 hour 58 minutes'),
('t1-003', 'r1000001-0000-0000-0000-000000000001', 'OFFERED', 'ASSIGNED', NULL, 'SYSTEM', 'Driver assigned', NOW() - INTERVAL '1 hour 58 minutes'),
('t1-004', 'r1000001-0000-0000-0000-000000000001', 'ASSIGNED', 'ACCEPTED', 'd2000001-0000-0000-0000-000000000001', 'DRIVER', 'Driver accepted', NOW() - INTERVAL '1 hour 57 minutes'),
('t1-005', 'r1000001-0000-0000-0000-000000000001', 'ACCEPTED', 'PICKING_UP', 'd2000001-0000-0000-0000-000000000001', 'DRIVER', 'En route to pickup', NOW() - INTERVAL '1 hour 55 minutes'),
('t1-006', 'r1000001-0000-0000-0000-000000000001', 'PICKING_UP', 'IN_PROGRESS', 'd2000001-0000-0000-0000-000000000001', 'DRIVER', 'Customer picked up', NOW() - INTERVAL '1 hour 55 minutes'),
('t1-007', 'r1000001-0000-0000-0000-000000000001', 'IN_PROGRESS', 'COMPLETED', 'd2000001-0000-0000-0000-000000000001', 'DRIVER', 'Ride completed', NOW() - INTERVAL '1 hour 40 minutes'),

-- Ride #2 transitions
('t2-001', 'r1000002-0000-0000-0000-000000000002', NULL, 'CREATED', 'c1000002-0000-0000-0000-000000000002', 'CUSTOMER', NULL, NOW() - INTERVAL '1 hour'),
('t2-002', 'r1000002-0000-0000-0000-000000000002', 'CREATED', 'OFFERED', NULL, 'SYSTEM', 'Driver matching', NOW() - INTERVAL '58 minutes'),
('t2-003', 'r1000002-0000-0000-0000-000000000002', 'OFFERED', 'ASSIGNED', NULL, 'SYSTEM', 'Driver assigned', NOW() - INTERVAL '58 minutes'),
('t2-004', 'r1000002-0000-0000-0000-000000000002', 'ASSIGNED', 'ACCEPTED', 'd2000002-0000-0000-0000-000000000002', 'DRIVER', 'Driver accepted', NOW() - INTERVAL '57 minutes'),
('t2-005', 'r1000002-0000-0000-0000-000000000002', 'ACCEPTED', 'PICKING_UP', 'd2000002-0000-0000-0000-000000000002', 'DRIVER', 'En route to pickup', NOW() - INTERVAL '55 minutes'),
('t2-006', 'r1000002-0000-0000-0000-000000000002', 'PICKING_UP', 'IN_PROGRESS', 'd2000002-0000-0000-0000-000000000002', 'DRIVER', 'Customer picked up', NOW() - INTERVAL '55 minutes'),
('t2-007', 'r1000002-0000-0000-0000-000000000002', 'IN_PROGRESS', 'COMPLETED', 'd2000002-0000-0000-0000-000000000002', 'DRIVER', 'Ride completed', NOW() - INTERVAL '45 minutes'),

-- Ride #3 transitions (in-progress)
('t3-001', 'r1000003-0000-0000-0000-000000000003', NULL, 'CREATED', 'c1000003-0000-0000-0000-000000000003', 'CUSTOMER', NULL, NOW() - INTERVAL '5 minutes'),
('t3-002', 'r1000003-0000-0000-0000-000000000003', 'CREATED', 'OFFERED', NULL, 'SYSTEM', 'Driver matching', NOW() - INTERVAL '4 minutes'),
('t3-003', 'r1000003-0000-0000-0000-000000000003', 'OFFERED', 'ASSIGNED', NULL, 'SYSTEM', 'Driver assigned', NOW() - INTERVAL '4 minutes'),
('t3-004', 'r1000003-0000-0000-0000-000000000003', 'ASSIGNED', 'ACCEPTED', 'd2000004-0000-0000-0000-000000000004', 'DRIVER', 'Driver accepted', NOW() - INTERVAL '3 minutes'),
('t3-005', 'r1000003-0000-0000-0000-000000000003', 'ACCEPTED', 'PICKING_UP', 'd2000004-0000-0000-0000-000000000004', 'DRIVER', 'En route to pickup', NOW() - INTERVAL '3 minutes'),
('t3-006', 'r1000003-0000-0000-0000-000000000003', 'PICKING_UP', 'IN_PROGRESS', 'd2000004-0000-0000-0000-000000000004', 'DRIVER', 'Customer picked up', NOW() - INTERVAL '2 minutes');


-- ========================================
-- PAYMENT SERVICE - payment_db
-- ========================================
\c payment_db

-- Insert fares (camelCase columns)
INSERT INTO "Fare" (id, "rideId", "baseFare", "distanceFare", "timeFare", "surgeMultiplier", "totalFare", "distanceKm", "durationMinutes", currency, "createdAt", "updatedAt") VALUES
('f1000001-0000-0000-0000-000000000001', 'r1000001-0000-0000-0000-000000000001', 15000, 60000, 12000, 1.0, 87000, 7.2, 20, 'VND', NOW() - INTERVAL '1 hour 40 minutes', NOW() - INTERVAL '1 hour 40 minutes'),
('f1000002-0000-0000-0000-000000000002', 'r1000002-0000-0000-0000-000000000002', 20000, 58000, 15000, 1.2, 98000, 5.8, 15, 'VND', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes');

-- Insert payments (only for completed rides, camelCase columns)
INSERT INTO "Payment" (id, "rideId", "customerId", "driverId", amount, currency, method, provider, status, "transactionId", "paymentIntentId", "paymentMethodId", "clientSecret", "idempotencyKey", "gatewayResponse", metadata, "initiatedAt", "completedAt", "failedAt", "refundedAt", "failureReason", "createdAt", "updatedAt") VALUES
-- Payment for Ride #1
('p1000001-0000-0000-0000-000000000001', 'r1000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'd2000001-0000-0000-0000-000000000001', 87000, 'VND', 'CASH', 'MOCK', 'COMPLETED', 'TXN-20260205-001', NULL, NULL, NULL, 'idem-r1000001', NULL, '{}', NOW() - INTERVAL '1 hour 40 minutes', NOW() - INTERVAL '1 hour 40 minutes', NULL, NULL, NULL, NOW() - INTERVAL '1 hour 40 minutes', NOW() - INTERVAL '1 hour 40 minutes'),

-- Payment for Ride #2
('p1000002-0000-0000-0000-000000000002', 'r1000002-0000-0000-0000-000000000002', 'c1000002-0000-0000-0000-000000000002', 'd2000002-0000-0000-0000-000000000002', 98000, 'VND', 'CARD', 'MOCK', 'COMPLETED', 'TXN-20260205-002', NULL, NULL, NULL, 'idem-r1000002', NULL, '{}', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes', NULL, NULL, NULL, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes');


-- ========================================
-- SEED COMPLETE
-- ========================================
-- Summary:
-- ✅ 9 users created (4 customers, 4 drivers, 1 admin)
-- ✅ 4 drivers registered with vehicles
-- ✅ 3 bookings created
-- ✅ 3 rides (2 completed, 1 in-progress)
-- ✅ 2 payments processed
-- 
-- Login credentials: 
-- - All passwords: Password123
-- - See SAMPLE-DATA.md for details
-- ========================================

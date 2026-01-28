-- ============================================
-- SEED DATA FOR CAB BOOKING SYSTEM (FIXED)
-- Dữ liệu mẫu để test hệ thống
-- ============================================

-- ============ AUTH_DB ============
\c auth_db;

-- Insert test users (Prisma schema)
-- Password cho tất cả: Test@123
-- Hash: $2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O
INSERT INTO users (id, email, password_hash, phone, role, status, first_name, last_name, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@cab.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0900000001', 'ADMIN', 'ACTIVE', 'Admin', 'Hệ thống', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440011', 'customer1@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0901234567', 'CUSTOMER', 'ACTIVE', 'Nguyễn Văn', 'An', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440012', 'customer2@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0901234568', 'CUSTOMER', 'ACTIVE', 'Trần Thị', 'Bình', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440013', 'customer3@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0901234569', 'CUSTOMER', 'ACTIVE', 'Lê Minh', 'Cường', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440021', 'driver1@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0902345671', 'DRIVER', 'ACTIVE', 'Phạm Công', 'Danh', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440022', 'driver2@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0902345672', 'DRIVER', 'ACTIVE', 'Hoàng Quốc', 'Em', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440023', 'driver3@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0902345673', 'DRIVER', 'ACTIVE', 'Vũ Đức', 'Phước', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440024', 'driver4@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0902345674', 'DRIVER', 'ACTIVE', 'Đặng Hữu', 'Giang', NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440025', 'driver5@test.com', '$2a$12$p4hjKuc/H3rQuhrhrIKL3OH175lZ07bPJVQUsFiUBqHL4M8ZOkc.O', '0902345675', 'DRIVER', 'ACTIVE', 'Mai Tuấn', 'Hùng', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- ============ USER_DB ============
\c user_db;

-- Insert user profiles với fixed UUIDs
INSERT INTO "UserProfile" (id, "userId", "firstName", "lastName", address, status, "createdAt", "updatedAt") VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Admin', 'Hệ thống', 'Văn phòng chính', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440011', 'Nguyễn Văn', 'An', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440012', 'Trần Thị', 'Bình', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440013', 'Lê Minh', 'Cường', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440021', 'Phạm Công', 'Danh', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440022', 'Hoàng Quốc', 'Em', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440023', 'Vũ Đức', 'Phước', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440024', '550e8400-e29b-41d4-a716-446655440024', 'Đặng Hữu', 'Giang', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW()),
('650e8400-e29b-41d4-a716-446655440025', '550e8400-e29b-41d4-a716-446655440025', 'Mai Tuấn', 'Hùng', 'TP. Hồ Chí Minh, Việt Nam', 'ACTIVE', NOW(), NOW())
ON CONFLICT ("userId") DO NOTHING;

-- ============ DRIVER_DB ============
\c driver_db;

-- Insert drivers
INSERT INTO drivers (
    id,
    user_id, 
    vehicle_type, 
    vehicle_brand, 
    vehicle_model, 
    vehicle_plate, 
    vehicle_color, 
    vehicle_year,
    license_number,
    license_expiry_date,
    license_verified,
    status,
    availability_status,
    rating_average,
    rating_count,
    last_location_lat,
    last_location_lng,
    created_at,
    updated_at
) VALUES
('750e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440021', 'CAR', 'Toyota', 'Vios', '29A-12345', 'Trắng', 2023, 'GPLX-D1', '2028-12-31', true, 'APPROVED', 'ONLINE', 4.8, 150, 10.7769, 106.7009, NOW(), NOW()),
('750e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440022', 'CAR', 'Toyota', 'Vios', '30B-23456', 'Bạc', 2023, 'GPLX-D2', '2028-12-31', true, 'APPROVED', 'ONLINE', 4.9, 160, 10.7780, 106.7020, NOW(), NOW()),
('750e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440023', 'CAR', 'Honda', 'City', '51C-34567', 'Trắng', 2023, 'GPLX-D3', '2028-12-31', true, 'APPROVED', 'ONLINE', 4.7, 140, 10.7790, 106.7030, NOW(), NOW()),
('750e8400-e29b-41d4-a716-446655440024', '550e8400-e29b-41d4-a716-446655440024', 'CAR', 'Honda', 'City', '59D-45678', 'Bạc', 2023, 'GPLX-D4', '2028-12-31', true, 'APPROVED', 'ONLINE', 4.8, 155, 10.7800, 106.7040, NOW(), NOW()),
('750e8400-e29b-41d4-a716-446655440025', '550e8400-e29b-41d4-a716-446655440025', 'SUV', 'Mercedes', 'E-Class', '79E-56789', 'Đen', 2023, 'GPLX-D5', '2028-12-31', true, 'APPROVED', 'ONLINE', 4.9, 180, 10.7810, 106.7050, NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- SEED DATA COMPLETED
-- ============================================

// @ts-nocheck
/**
 * ============================================
 * COMPREHENSIVE DATABASE SEEDING SCRIPT
 * ============================================
 * Seeds all databases with realistic Vietnamese data
 * for Admin, Driver, and Customer applications
 * 
 * NOTE: This script is deprecated and needs refactoring.
 * Each service has its own Prisma schema and should be seeded separately.
 */

import { PrismaClient as AuthPrismaClient } from '@prisma/client';
import { PrismaClient as UserPrismaClient } from '@prisma/client';
import { PrismaClient as DriverPrismaClient } from '@prisma/client';
import { PrismaClient as BookingPrismaClient } from '@prisma/client';
import { PrismaClient as RidePrismaClient } from '../services/ride-service/src/generated/prisma-client';
import { PrismaClient as PaymentPrismaClient } from '../services/payment-service/src/generated/prisma-client';
import * as bcrypt from 'bcryptjs';

// Initialize Prisma Clients
const authClient = new AuthPrismaClient();
const userClient = new UserPrismaClient();
const driverClient = new DriverPrismaClient();
const bookingClient = new BookingPrismaClient();
const rideClient = new RidePrismaClient();
const paymentClient = new PaymentPrismaClient();

// ============================================
// SEED DATA CONSTANTS
// ============================================

interface SeedAccount {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'DRIVER' | 'CUSTOMER';
}

const ACCOUNTS: SeedAccount[] = [
  // ADMIN ACCOUNTS
  {
    email: 'admin@cabsystem.vn',
    password: 'Admin@123',
    phone: '+84901000001',
    firstName: 'Nguyễn',
    lastName: 'Quản Trị',
    role: 'ADMIN',
  },
  {
    email: 'admin2@cabsystem.vn',
    password: 'Admin@123',
    phone: '+84901000002',
    firstName: 'Trần',
    lastName: 'Admin',
    role: 'ADMIN',
  },

  // DRIVER ACCOUNTS
  {
    email: 'driver1@cabsystem.vn',
    password: 'Driver@123',
    phone: '+84902000001',
    firstName: 'Lê',
    lastName: 'Văn Tài',
    role: 'DRIVER',
  },
  {
    email: 'driver2@cabsystem.vn',
    password: 'Driver@123',
    phone: '+84902000002',
    firstName: 'Phạm',
    lastName: 'Minh Đức',
    role: 'DRIVER',
  },
  {
    email: 'driver3@cabsystem.vn',
    password: 'Driver@123',
    phone: '+84902000003',
    firstName: 'Hoàng',
    lastName: 'Văn Sơn',
    role: 'DRIVER',
  },
  {
    email: 'driver4@cabsystem.vn',
    password: 'Driver@123',
    phone: '+84902000004',
    firstName: 'Vũ',
    lastName: 'Thanh Tùng',
    role: 'DRIVER',
  },
  {
    email: 'driver5@cabsystem.vn',
    password: 'Driver@123',
    phone: '+84902000005',
    firstName: 'Đặng',
    lastName: 'Quang Hải',
    role: 'DRIVER',
  },

  // CUSTOMER ACCOUNTS
  {
    email: 'customer1@gmail.com',
    password: 'Customer@123',
    phone: '+84903000001',
    firstName: 'Nguyễn',
    lastName: 'Thị Mai',
    role: 'CUSTOMER',
  },
  {
    email: 'customer2@gmail.com',
    password: 'Customer@123',
    phone: '+84903000002',
    firstName: 'Trần',
    lastName: 'Văn An',
    role: 'CUSTOMER',
  },
  {
    email: 'customer3@gmail.com',
    password: 'Customer@123',
    phone: '+84903000003',
    firstName: 'Lê',
    lastName: 'Hoàng Nam',
    role: 'CUSTOMER',
  },
  {
    email: 'customer4@gmail.com',
    password: 'Customer@123',
    phone: '+84903000004',
    firstName: 'Phạm',
    lastName: 'Thu Hương',
    role: 'CUSTOMER',
  },
  {
    email: 'customer5@gmail.com',
    password: 'Customer@123',
    phone: '+84903000005',
    firstName: 'Hoàng',
    lastName: 'Minh Tuấn',
    role: 'CUSTOMER',
  },
];

const VEHICLES = [
  {
    type: 'CAR' as const,
    brand: 'Toyota',
    model: 'Vios',
    plate: '59A-12345',
    color: 'Trắng',
    year: 2022,
  },
  {
    type: 'CAR' as const,
    brand: 'Hyundai',
    model: 'Accent',
    plate: '51B-67890',
    color: 'Bạc',
    year: 2021,
  },
  {
    type: 'SUV' as const,
    brand: 'Honda',
    model: 'CR-V',
    plate: '50C-11111',
    color: 'Đen',
    year: 2023,
  },
  {
    type: 'CAR' as const,
    brand: 'Mazda',
    model: 'Mazda 3',
    plate: '30D-22222',
    color: 'Đỏ',
    year: 2022,
  },
  {
    type: 'CAR' as const,
    brand: 'Kia',
    model: 'Cerato',
    plate: '92E-33333',
    color: 'Xanh',
    year: 2021,
  },
];

const LOCATIONS = [
  // Hồ Chí Minh
  { name: 'Sân bay Tân Sơn Nhất', lat: 10.8186, lng: 106.6517, city: 'Hồ Chí Minh' },
  { name: 'Bến Thành Market', lat: 10.7722, lng: 106.6980, city: 'Hồ Chí Minh' },
  { name: 'Landmark 81', lat: 10.7946, lng: 106.7218, city: 'Hồ Chí Minh' },
  { name: 'Nhà hát Thành phố', lat: 10.7768, lng: 106.7032, city: 'Hồ Chí Minh' },
  { name: 'Chợ Lớn', lat: 10.7546, lng: 106.6574, city: 'Hồ Chí Minh' },
  
  // Hà Nội
  { name: 'Sân bay Nội Bài', lat: 21.2212, lng: 105.8065, city: 'Hà Nội' },
  { name: 'Hồ Gươm', lat: 21.0285, lng: 105.8542, city: 'Hà Nội' },
  { name: 'Nhà hát Lớn Hà Nội', lat: 21.0245, lng: 105.8563, city: 'Hà Nội' },
  { name: 'Lăng Bác', lat: 21.0369, lng: 105.8345, city: 'Hà Nội' },
  { name: 'Phố cổ Hà Nội', lat: 21.0333, lng: 105.8525, city: 'Hà Nội' },
  
  // Đà Nẵng
  { name: 'Sân bay Đà Nẵng', lat: 16.0439, lng: 108.1993, city: 'Đà Nẵng' },
  { name: 'Cầu Rồng', lat: 16.0608, lng: 108.2278, city: 'Đà Nẵng' },
  { name: 'Bãi biển Mỹ Khê', lat: 16.0423, lng: 108.2482, city: 'Đà Nẵng' },
  { name: 'Bà Nà Hills', lat: 15.9969, lng: 107.9969, city: 'Đà Nẵng' },
  
  // Cần Thơ
  { name: 'Chợ nổi Cái Răng', lat: 10.0452, lng: 105.7702, city: 'Cần Thơ' },
  { name: 'Cầu Cần Thơ', lat: 10.0342, lng: 105.7670, city: 'Cần Thơ' },
];

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedAuthService() {
  console.log('📦 [1/6] Seeding Auth Service...');
  
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const users = [];
  
  for (const account of ACCOUNTS) {
    const hash = await bcrypt.hash(account.password, 10);
    const user = await authClient.user.create({
      data: {
        email: account.email,
        phone: account.phone,
        passwordHash: hash,
        role: account.role,
        status: 'ACTIVE',
        firstName: account.firstName,
        lastName: account.lastName,
      },
    });
    users.push(user);
    console.log(`   ✓ Created ${account.role}: ${account.email} (${account.firstName} ${account.lastName})`);
  }
  
  return users;
}

async function seedUserService(authUsers: any[]) {
  console.log('📦 [2/6] Seeding User Service...');
  
  for (const authUser of authUsers) {
    await userClient.userProfile.create({
      data: {
        userId: authUser.id,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        phone: authUser.phone,
        status: 'ACTIVE',
      },
    });
    console.log(`   ✓ Created profile for: ${authUser.email}`);
  }
}

async function seedDriverService(authUsers: any[]) {
  console.log('📦 [3/6] Seeding Driver Service...');
  
  const driverUsers = authUsers.filter((u) => u.role === 'DRIVER');
  const drivers = [];
  
  for (let i = 0; i < driverUsers.length; i++) {
    const user = driverUsers[i];
    const vehicle = VEHICLES[i];
    
    const driver = await driverClient.driver.create({
      data: {
        userId: user.id,
        status: i < 4 ? 'APPROVED' : 'PENDING', // First 4 approved, rest pending
        availabilityStatus: i < 3 ? 'ONLINE' : 'OFFLINE', // First 3 online
        vehicleType: vehicle.type,
        vehicleBrand: vehicle.brand,
        vehicleModel: vehicle.model,
        vehiclePlate: vehicle.plate,
        vehicleColor: vehicle.color,
        vehicleYear: vehicle.year,
        licenseNumber: `GPLX${String(i + 1).padStart(6, '0')}`,
        licenseExpiryDate: new Date('2026-12-31'),
        licenseVerified: i < 4,
        ratingAverage: 4.5 + Math.random() * 0.5,
        ratingCount: Math.floor(Math.random() * 50) + 10,
        lastLocationLat: LOCATIONS[i % LOCATIONS.length].lat,
        lastLocationLng: LOCATIONS[i % LOCATIONS.length].lng,
        lastLocationTime: new Date(),
      },
    });
    
    drivers.push(driver);
    console.log(`   ✓ Created driver: ${user.email} - ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`);
  }
  
  return drivers;
}

async function seedBookingsAndRides(authUsers: any[], drivers: any[]) {
  console.log('📦 [4/6] Seeding Bookings & Rides...');
  
  const customers = authUsers.filter((u) => u.role === 'CUSTOMER');
  const approvedDrivers = drivers.filter((d) => d.status === 'APPROVED');
  
  const rides = [];
  
  // Scenario 1: Completed rides
  for (let i = 0; i < 5; i++) {
    const customer = customers[i % customers.length];
    const driver = approvedDrivers[i % approvedDrivers.length];
    const pickup = LOCATIONS[i];
    const dropoff = LOCATIONS[(i + 3) % LOCATIONS.length];
    
    const distance = Math.random() * 15 + 5; // 5-20 km
    const duration = Math.floor(distance * 180); // ~3 min/km
    const fare = 15000 + distance * 12000; // Base + per km
    
    const ride = await rideClient.ride.create({
      data: {
        customerId: customer.id,
        driverId: driver.userId,
        status: 'COMPLETED',
        vehicleType: 'ECONOMY',
        paymentMethod: i % 2 === 0 ? 'CASH' : 'CARD',
        pickupAddress: pickup.name,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.name,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        distance,
        duration,
        fare,
        surgeMultiplier: 1.0,
        suggestedDriverIds: [driver.userId],
        offeredDriverIds: [driver.userId],
        acceptedDriverId: driver.userId,
        requestedAt: new Date(Date.now() - 3600000 * (i + 1)),
        assignedAt: new Date(Date.now() - 3600000 * (i + 1) + 120000),
        acceptedAt: new Date(Date.now() - 3600000 * (i + 1) + 180000),
        startedAt: new Date(Date.now() - 3600000 * (i + 1) + 600000),
        completedAt: new Date(Date.now() - 3600000 * (i + 1) + 600000 + duration * 1000),
      },
    });
    
    rides.push(ride);
    console.log(`   ✓ Created COMPLETED ride: ${pickup.name} → ${dropoff.name} (${distance.toFixed(1)}km, ${fare.toFixed(0)} VND)`);
  }
  
  // Scenario 2: Ongoing rides
  for (let i = 0; i < 2; i++) {
    const customer = customers[(i + 1) % customers.length];
    const driver = approvedDrivers[(i + 1) % approvedDrivers.length];
    const pickup = LOCATIONS[i + 5];
    const dropoff = LOCATIONS[(i + 10) % LOCATIONS.length];
    
    const distance = Math.random() * 10 + 3;
    const duration = Math.floor(distance * 180);
    const fare = 15000 + distance * 12000;
    
    const ride = await rideClient.ride.create({
      data: {
        customerId: customer.id,
        driverId: driver.userId,
        status: 'IN_PROGRESS',
        vehicleType: 'ECONOMY',
        paymentMethod: 'CASH',
        pickupAddress: pickup.name,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.name,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        distance,
        duration,
        fare,
        suggestedDriverIds: [driver.userId],
        offeredDriverIds: [driver.userId],
        acceptedDriverId: driver.userId,
        requestedAt: new Date(Date.now() - 1200000),
        assignedAt: new Date(Date.now() - 1000000),
        acceptedAt: new Date(Date.now() - 900000),
        startedAt: new Date(Date.now() - 600000),
      },
    });
    
    rides.push(ride);
    console.log(`   ✓ Created IN_PROGRESS ride: ${pickup.name} → ${dropoff.name}`);
  }
  
  // Scenario 3: Pending rides (waiting for driver)
  for (let i = 0; i < 2; i++) {
    const customer = customers[(i + 2) % customers.length];
    const pickup = LOCATIONS[i + 8];
    const dropoff = LOCATIONS[(i + 12) % LOCATIONS.length];
    
    const ride = await rideClient.ride.create({
      data: {
        customerId: customer.id,
        status: 'FINDING_DRIVER',
        vehicleType: 'ECONOMY',
        paymentMethod: 'CASH',
        pickupAddress: pickup.name,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.name,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        requestedAt: new Date(),
      },
    });
    
    rides.push(ride);
    console.log(`   ✓ Created FINDING_DRIVER ride: ${pickup.name} → ${dropoff.name}`);
  }
  
  // Scenario 4: Cancelled rides
  for (let i = 0; i < 2; i++) {
    const customer = customers[(i + 3) % customers.length];
    const pickup = LOCATIONS[i + 10];
    const dropoff = LOCATIONS[(i + 14) % LOCATIONS.length];
    
    const ride = await rideClient.ride.create({
      data: {
        customerId: customer.id,
        status: 'CANCELLED',
        vehicleType: 'ECONOMY',
        paymentMethod: 'CASH',
        pickupAddress: pickup.name,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.name,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        requestedAt: new Date(Date.now() - 7200000),
        cancelledAt: new Date(Date.now() - 7000000),
        cancelReason: i === 0 ? 'Customer cancelled' : 'No driver available',
        cancelledBy: i === 0 ? 'CUSTOMER' : 'SYSTEM',
      },
    });
    
    rides.push(ride);
    console.log(`   ✓ Created CANCELLED ride: ${pickup.name} → ${dropoff.name} (${ride.cancelReason})`);
  }
  
  return rides;
}

async function seedPayments(rides: any[]) {
  console.log('📦 [5/6] Seeding Payments...');
  
  const completedRides = rides.filter((r) => r.status === 'COMPLETED');
  const inProgressRides = rides.filter((r) => r.status === 'IN_PROGRESS');
  
  // Payments for completed rides
  for (const ride of completedRides) {
    // Create fare first
    await paymentClient.fare.create({
      data: {
        rideId: ride.id,
        baseFare: 15000,
        distanceFare: ride.distance! * 12000,
        timeFare: 0,
        surgeMultiplier: 1.0,
        totalFare: ride.fare!,
        distanceKm: ride.distance!,
        durationMinutes: Math.floor(ride.duration! / 60),
      },
    });
    
    // Create payment
    await paymentClient.payment.create({
      data: {
        rideId: ride.id,
        customerId: ride.customerId,
        driverId: ride.driverId!,
        amount: ride.fare!,
        method: ride.paymentMethod === 'CASH' ? 'CASH' : 'CARD',
        provider: 'MOCK',
        status: 'COMPLETED',
        transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        initiatedAt: ride.completedAt!,
        completedAt: ride.completedAt!,
      },
    });
    
    console.log(`   ✓ Created COMPLETED payment for ride ${ride.id.substring(0, 8)}... (${ride.fare!.toFixed(0)} VND)`);
  }
  
  // Pending payments for in-progress rides
  for (const ride of inProgressRides) {
    await paymentClient.fare.create({
      data: {
        rideId: ride.id,
        baseFare: 15000,
        distanceFare: ride.distance! * 12000,
        timeFare: 0,
        surgeMultiplier: 1.0,
        totalFare: ride.fare!,
        distanceKm: ride.distance!,
        durationMinutes: Math.floor(ride.duration! / 60),
      },
    });
    
    await paymentClient.payment.create({
      data: {
        rideId: ride.id,
        customerId: ride.customerId,
        driverId: ride.driverId!,
        amount: ride.fare!,
        method: 'CASH',
        provider: 'MOCK',
        status: 'PENDING',
        initiatedAt: new Date(),
      },
    });
    
    console.log(`   ✓ Created PENDING payment for ride ${ride.id.substring(0, 8)}...`);
  }
}

async function seedBookings(authUsers: any[]) {
  console.log('📦 [6/6] Seeding Bookings...');
  
  const customers = authUsers.filter((u) => u.role === 'CUSTOMER');
  
  // Create some pending bookings
  for (let i = 0; i < 3; i++) {
    const customer = customers[i % customers.length];
    const pickup = LOCATIONS[i];
    const dropoff = LOCATIONS[(i + 5) % LOCATIONS.length];
    
    const distance = Math.random() * 15 + 5;
    const duration = Math.floor(distance * 180);
    const fare = 15000 + distance * 12000;
    
    await bookingClient.booking.create({
      data: {
        customerId: customer.id,
        pickupAddress: pickup.name,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.name,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        vehicleType: i % 2 === 0 ? 'ECONOMY' : 'COMFORT',
        paymentMethod: 'CASH',
        estimatedFare: fare,
        estimatedDistance: distance,
        estimatedDuration: duration,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });
    
    console.log(`   ✓ Created CONFIRMED booking: ${pickup.name} → ${dropoff.name}`);
  }
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('\n🌱 ========================================');
  console.log('🌱 DATABASE SEEDING STARTED');
  console.log('🌱 ========================================\n');
  
  try {
    // Seed in order
    const authUsers = await seedAuthService();
    await seedUserService(authUsers);
    const drivers = await seedDriverService(authUsers);
    const rides = await seedBookingsAndRides(authUsers, drivers);
    await seedPayments(rides);
    await seedBookings(authUsers);
    
    console.log('\n✅ ========================================');
    console.log('✅ DATABASE SEEDING COMPLETE');
    console.log('✅ ========================================\n');
    
    console.log('📊 SUMMARY:');
    console.log(`   - Users: ${authUsers.length} (${authUsers.filter(u => u.role === 'ADMIN').length} admins, ${authUsers.filter(u => u.role === 'DRIVER').length} drivers, ${authUsers.filter(u => u.role === 'CUSTOMER').length} customers)`);
    console.log(`   - Drivers: ${drivers.length} (${drivers.filter(d => d.status === 'APPROVED').length} approved, ${drivers.filter(d => d.availabilityStatus === 'ONLINE').length} online)`);
    console.log(`   - Rides: ${rides.length} (${rides.filter(r => r.status === 'COMPLETED').length} completed, ${rides.filter(r => r.status === 'IN_PROGRESS').length} in-progress, ${rides.filter(r => r.status === 'FINDING_DRIVER').length} finding driver, ${rides.filter(r => r.status === 'CANCELLED').length} cancelled)`);
    console.log(`   - Locations: ${LOCATIONS.length} across Vietnam (TP.HCM, Hà Nội, Đà Nẵng, Cần Thơ)`);
    
    console.log('\n🔐 TEST ACCOUNTS:');
    console.log('   Admin: admin@cabsystem.vn / Admin@123');
    console.log('   Driver: driver1@cabsystem.vn / Driver@123');
    console.log('   Customer: customer1@gmail.com / Customer@123');
    
  } catch (error) {
    console.error('\n❌ ERROR during seeding:', error);
    throw error;
  } finally {
    await authClient.$disconnect();
    await userClient.$disconnect();
    await driverClient.$disconnect();
    await bookingClient.$disconnect();
    await rideClient.$disconnect();
    await paymentClient.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

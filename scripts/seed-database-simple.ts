/**
 * ============================================
 * SIMPLE DATABASE SEEDING SCRIPT
 * ============================================
 * Seeds all databases with realistic Vietnamese data
 * Works directly with database connections
 */

import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

// Database connection strings
const AUTH_DB = 'postgresql://postgres:postgres123@localhost:5433/auth_db';
const USER_DB = 'postgresql://postgres:postgres123@localhost:5433/user_db';
const DRIVER_DB = 'postgresql://postgres:postgres123@localhost:5433/driver_db';
const BOOKING_DB = 'postgresql://postgres:postgres123@localhost:5433/booking_db';
const RIDE_DB = 'postgresql://postgres:postgres123@localhost:5433/ride_db';
const PAYMENT_DB = 'postgresql://postgres:postgres123@localhost:5433/payment_db';

// Seed data
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
  { email: 'admin@cabsystem.vn', password: 'Admin@123', phone: '+84901000001', firstName: 'Nguyễn', lastName: 'Quản Trị', role: 'ADMIN' },
  { email: 'admin2@cabsystem.vn', password: 'Admin@123', phone: '+84901000002', firstName: 'Trần', lastName: 'Admin', role: 'ADMIN' },
  
  // DRIVER ACCOUNTS
  { email: 'driver1@cabsystem.vn', password: 'Driver@123', phone: '+84902000001', firstName: 'Lê', lastName: 'Văn Tài', role: 'DRIVER' },
  { email: 'driver2@cabsystem.vn', password: 'Driver@123', phone: '+84902000002', firstName: 'Phạm', lastName: 'Minh Đức', role: 'DRIVER' },
  { email: 'driver3@cabsystem.vn', password: 'Driver@123', phone: '+84902000003', firstName: 'Hoàng', lastName: 'Văn Sơn', role: 'DRIVER' },
  { email: 'driver4@cabsystem.vn', password: 'Driver@123', phone: '+84902000004', firstName: 'Vũ', lastName: 'Thanh Tùng', role: 'DRIVER' },
  { email: 'driver5@cabsystem.vn', password: 'Driver@123', phone: '+84902000005', firstName: 'Đặng', lastName: 'Quang Hải', role: 'DRIVER' },
  
  // CUSTOMER ACCOUNTS
  { email: 'customer1@gmail.com', password: 'Customer@123', phone: '+84903000001', firstName: 'Nguyễn', lastName: 'Thị Mai', role: 'CUSTOMER' },
  { email: 'customer2@gmail.com', password: 'Customer@123', phone: '+84903000002', firstName: 'Trần', lastName: 'Văn An', role: 'CUSTOMER' },
  { email: 'customer3@gmail.com', password: 'Customer@123', phone: '+84903000003', firstName: 'Lê', lastName: 'Hoàng Nam', role: 'CUSTOMER' },
  { email: 'customer4@gmail.com', password: 'Customer@123', phone: '+84903000004', firstName: 'Phạm', lastName: 'Thu Hương', role: 'CUSTOMER' },
  { email: 'customer5@gmail.com', password: 'Customer@123', phone: '+84903000005', firstName: 'Hoàng', lastName: 'Minh Tuấn', role: 'CUSTOMER' },
];

const VEHICLES = [
  { type: 'CAR', brand: 'Toyota', model: 'Vios', plate: '59A-12345', color: 'Trắng', year: 2022 },
  { type: 'CAR', brand: 'Hyundai', model: 'Accent', plate: '51B-67890', color: 'Bạc', year: 2021 },
  { type: 'SUV', brand: 'Honda', model: 'CR-V', plate: '50C-11111', color: 'Đen', year: 2023 },
  { type: 'CAR', brand: 'Mazda', model: 'Mazda 3', plate: '30D-22222', color: 'Đỏ', year: 2022 },
  { type: 'CAR', brand: 'Kia', model: 'Cerato', plate: '92E-33333', color: 'Xanh', year: 2021 },
];

const LOCATIONS = [
  { name: 'Sân bay Tân Sơn Nhất', lat: 10.8186, lng: 106.6517, city: 'Hồ Chí Minh' },
  { name: 'Bến Thành Market', lat: 10.7722, lng: 106.6980, city: 'Hồ Chí Minh' },
  { name: 'Landmark 81', lat: 10.7946, lng: 106.7218, city: 'Hồ Chí Minh' },
  { name: 'Nhà hát Thành phố', lat: 10.7768, lng: 106.7032, city: 'Hồ Chí Minh' },
];

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function clearDatabase() {
  console.log('\n🗑️  Clearing existing data...\n');
  
  const authClient = new Client({ connectionString: AUTH_DB });
  const userClient = new Client({ connectionString: USER_DB });
  const driverClient = new Client({ connectionString: DRIVER_DB });
  const bookingClient = new Client({ connectionString: BOOKING_DB });
  const rideClient = new Client({ connectionString: RIDE_DB });
  const paymentClient = new Client({ connectionString: PAYMENT_DB });
  
  try {
    await authClient.connect();
    await userClient.connect();
    await driverClient.connect();
    await bookingClient.connect();
    await rideClient.connect();
    await paymentClient.connect();
    
    await paymentClient.query('TRUNCATE TABLE "Payment", "Fare", "OutboxEvent" CASCADE');
    await rideClient.query('TRUNCATE TABLE "Ride", "RideStateTransition" CASCADE');
    await bookingClient.query('TRUNCATE TABLE "Booking" CASCADE');
    await driverClient.query('TRUNCATE TABLE "drivers" CASCADE');
    await userClient.query('TRUNCATE TABLE "user_profiles" CASCADE');
    await authClient.query('TRUNCATE TABLE "users", "refresh_tokens" CASCADE');
    
    console.log('   ✓ All tables cleared');
    
  } finally {
    await authClient.end();
    await userClient.end();
    await driverClient.end();
    await bookingClient.end();
    await rideClient.end();
    await paymentClient.end();
  }
}

async function seedAuthService() {
  console.log('📦 [1/6] Seeding Auth Service...');
  
  const client = new Client({ connectionString: AUTH_DB });
  await client.connect();
  
  const users = [];
  
  try {
    for (const account of ACCOUNTS) {
      const id = uuid();
      const hash = await bcrypt.hash(account.password, 10);
      
      await client.query(
        `INSERT INTO "users" (id, email, phone, password_hash, role, status, first_name, last_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [id, account.email, account.phone, hash, account.role, 'ACTIVE', account.firstName, account.lastName]
      );
      
      users.push({ id, ...account });
      console.log(`   ✓ Created ${account.role}: ${account.email} (${account.firstName} ${account.lastName})`);
    }
  } finally {
    await client.end();
  }
  
  return users;
}

async function seedUserService(authUsers: any[]) {
  console.log('📦 [2/6] Seeding User Service...');
  
  const client = new Client({ connectionString: USER_DB });
  await client.connect();
  
  try {
    for (const authUser of authUsers) {
      const id = uuid();
      await client.query(
        `INSERT INTO "user_profiles" (id, user_id, first_name, last_name, phone, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [id, authUser.id, authUser.firstName, authUser.lastName, authUser.phone, 'ACTIVE']
      );
      console.log(`   ✓ Created profile for: ${authUser.email}`);
    }
  } finally {
    await client.end();
  }
}

async function seedDriverService(authUsers: any[]) {
  console.log('📦 [3/6] Seeding Driver Service...');
  
  const client = new Client({ connectionString: DRIVER_DB });
  await client.connect();
  
  const driverUsers = authUsers.filter((u) => u.role === 'DRIVER');
  const drivers = [];
  
  try {
    for (let i = 0; i < driverUsers.length; i++) {
      const user = driverUsers[i];
      const vehicle = VEHICLES[i];
      const id = uuid();
      
      const status = i < 4 ? 'APPROVED' : 'PENDING';
      const availability = i < 3 ? 'ONLINE' : 'OFFLINE';
      const location = LOCATIONS[i % LOCATIONS.length];
      
      await client.query(
        `INSERT INTO "drivers" (
          id, user_id, status, availability_status, vehicle_type, vehicle_brand, vehicle_model,
          vehicle_plate, vehicle_color, vehicle_year, license_number, license_expiry_date,
          license_verified, rating_average, rating_count, last_location_lat, last_location_lng,
          last_location_time, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), NOW())`,
        [
          id,
          user.id,
          status,
          availability,
          vehicle.type,
          vehicle.brand,
          vehicle.model,
          vehicle.plate,
          vehicle.color,
          vehicle.year,
          `GPLX${String(i + 1).padStart(6, '0')}`,
          '2026-12-31',
          i < 4,
          4.5 + Math.random() * 0.5,
          Math.floor(Math.random() * 50) + 10,
          location.lat,
          location.lng,
        ]
      );
      
      drivers.push({ id, userId: user.id });
      console.log(`   ✓ Created driver: ${user.email} - ${vehicle.brand} ${vehicle.model} (${vehicle.plate})`);
    }
  } finally {
    await client.end();
  }
  
  return drivers;
}

async function seedRides(authUsers: any[], drivers: any[]) {
  console.log('📦 [4/6] Seeding Rides...');
  
  const client = new Client({ connectionString: RIDE_DB });
  await client.connect();
  
  const customers = authUsers.filter((u) => u.role === 'CUSTOMER');
  const rides = [];
  
  try {
    // COMPLETED rides
    for (let i = 0; i < 3; i++) {
      const rideId = uuid();
      const customer = customers[i % customers.length];
      const driver = drivers[i % drivers.length];
      const pickup = LOCATIONS[0];
      const dropoff = LOCATIONS[2];
      const distance = 10 + Math.random() * 5;
      const duration = Math.floor(distance * 200);
      const fare = 15000 + distance * 12000;
      
      const completedAt = new Date(Date.now() - 3600000 * (i + 1));
      const startedAt = new Date(completedAt.getTime() - duration * 1000);
      const requestedAt = new Date(startedAt.getTime() - 600000);
      
      await client.query(
        `INSERT INTO "Ride" (
          id, "customerId", "driverId", status, "vehicleType", "paymentMethod",
          "pickupAddress", "pickupLat", "pickupLng", "dropoffAddress", "dropoffLat", "dropoffLng",
          distance, duration, fare, "surgeMultiplier", "suggestedDriverIds", "offeredDriverIds",
          "requestedAt", "startedAt", "completedAt", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW())`,
        [
          rideId,
          customer.id,
          driver.userId,
          'COMPLETED',
          'ECONOMY',
          'CASH',
          pickup.name,
          pickup.lat,
          pickup.lng,
          dropoff.name,
          dropoff.lat,
          dropoff.lng,
          distance,
          duration,
          fare,
          1.0,
          `{${driver.userId}}`,
          `{${driver.userId}}`,
          requestedAt,
          startedAt,
          completedAt,
        ]
      );
      
      rides.push({ id: rideId, customerId: customer.id, driverId: driver.userId, status: 'COMPLETED', fare, distance, duration, completedAt });
      console.log(`   ✓ Created COMPLETED ride: ${pickup.name} → ${dropoff.name} (${distance.toFixed(1)}km, ${fare.toFixed(0)} VND)`);
    }
    
    // IN_PROGRESS ride
    const inProgressId = uuid();
    const customer = customers[1];
    const driver = drivers[1];
    const pickup = LOCATIONS[1];
    const dropoff = LOCATIONS[3];
    const distance = 8;
    const duration = 1600;
    const fare = 15000 + distance * 12000;
    
    await client.query(
      `INSERT INTO "Ride" (
        id, "customerId", "driverId", status, "vehicleType", "paymentMethod",
        "pickupAddress", "pickupLat", "pickupLng", "dropoffAddress", "dropoffLat", "dropoffLng",
        distance, duration, fare, "suggestedDriverIds", "offeredDriverIds",
        "requestedAt", "startedAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())`,
      [
        inProgressId,
        customer.id,
        driver.userId,
        'IN_PROGRESS',
        'ECONOMY',
        'CASH',
        pickup.name,
        pickup.lat,
        pickup.lng,
        dropoff.name,
        dropoff.lat,
        dropoff.lng,
        distance,
        duration,
        fare,
        `{${driver.userId}}`,
        `{${driver.userId}}`,
        new Date(Date.now() - 900000),
        new Date(Date.now() - 300000),
      ]
    );
    
    rides.push({ id: inProgressId, customerId: customer.id, driverId: driver.userId, status: 'IN_PROGRESS', fare, distance, duration });
    console.log(`   ✓ Created IN_PROGRESS ride: ${pickup.name} → ${dropoff.name}`);
    
    // FINDING_DRIVER ride
    const findingId = uuid();
    await client.query(
      `INSERT INTO "Ride" (
        id, "customerId", status, "vehicleType", "paymentMethod",
        "pickupAddress", "pickupLat", "pickupLng", "dropoffAddress", "dropoffLat", "dropoffLng",
        "requestedAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())`,
      [
        findingId,
        customers[2].id,
        'FINDING_DRIVER',
        'ECONOMY',
        'CASH',
        pickup.name,
        pickup.lat,
        pickup.lng,
        dropoff.name,
        dropoff.lat,
        dropoff.lng,
      ]
    );
    
    rides.push({ id: findingId, customerId: customers[2].id, status: 'FINDING_DRIVER' });
    console.log(`   ✓ Created FINDING_DRIVER ride`);
    
  } finally {
    await client.end();
  }
  
  return rides;
}

async function seedPayments(rides: any[]) {
  console.log('📦 [5/6] Seeding Payments...');
  
  const client = new Client({ connectionString: PAYMENT_DB });
  await client.connect();
  
  try {
    for (const ride of rides) {
      if (ride.status === 'COMPLETED' || ride.status === 'IN_PROGRESS') {
        const fareId = uuid();
        const paymentId = uuid();
        
        // Create fare
        await client.query(
          `INSERT INTO "Fare" (id, "rideId", "baseFare", "distanceFare", "timeFare", "surgeMultiplier", "totalFare", "distanceKm", "durationMinutes", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [fareId, ride.id, 15000, ride.distance * 12000, 0, 1.0, ride.fare, ride.distance, Math.floor(ride.duration / 60)]
        );
        
        // Create payment
        const status = ride.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING';
        await client.query(
          `INSERT INTO "Payment" (id, "rideId", "customerId", "driverId", amount, method, provider, status, "transactionId", "initiatedAt", "completedAt", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, NOW(), NOW())`,
          [paymentId, ride.id, ride.customerId, ride.driverId, ride.fare, 'CASH', 'MOCK', status, `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`, ride.completedAt]
        );
        
        console.log(`   ✓ Created ${status} payment for ride (${ride.fare?.toFixed(0) || 0} VND)`);
      }
    }
  } finally {
    await client.end();
  }
}

async function seedBookings(authUsers: any[]) {
  console.log('📦 [6/6] Seeding Bookings...');
  
  const client = new Client({ connectionString: BOOKING_DB });
  await client.connect();
  
  const customers = authUsers.filter((u) => u.role === 'CUSTOMER');
  
  try {
    const customer = customers[0];
    const bookingId = uuid();
    const pickup = LOCATIONS[0];
    const dropoff = LOCATIONS[1];
    const distance = 5.5;
    const duration = 1100;
    const fare = 15000 + distance * 12000;
    
    await client.query(
      `INSERT INTO "Booking" (
        id, "customerId", "pickupAddress", "pickupLat", "pickupLng", "dropoffAddress", "dropoffLat", "dropoffLng",
        "vehicleType", "paymentMethod", "estimatedFare", "estimatedDistance", "estimatedDuration",
        status, "confirmedAt", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW(), NOW())`,
      [
        bookingId,
        customer.id,
        pickup.name,
        pickup.lat,
        pickup.lng,
        dropoff.name,
        dropoff.lat,
        dropoff.lng,
        'ECONOMY',
        'CASH',
        fare,
        distance,
        duration,
        'CONFIRMED',
      ]
    );
    
    console.log(`   ✓ Created CONFIRMED booking: ${pickup.name} → ${dropoff.name}`);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('\n🌱 ========================================');
  console.log('🌱 DATABASE SEEDING STARTED');
  console.log('🌱 ========================================\n');
  
  try {
    await clearDatabase();
    
    const authUsers = await seedAuthService();
    await seedUserService(authUsers);
    const drivers = await seedDriverService(authUsers);
    const rides = await seedRides(authUsers, drivers);
    await seedPayments(rides);
    await seedBookings(authUsers);
    
    console.log('\n✅ ========================================');
    console.log('✅ DATABASE SEEDING COMPLETE');
    console.log('✅ ========================================\n');
    
    console.log('📊 SUMMARY:');
    console.log(`   - Users: ${authUsers.length} (${authUsers.filter(u => u.role === 'ADMIN').length} admins, ${authUsers.filter(u => u.role === 'DRIVER').length} drivers, ${authUsers.filter(u => u.role === 'CUSTOMER').length} customers)`);
    console.log(`   - Drivers: ${drivers.length}`);
    console.log(`   - Rides: ${rides.length}`);
    console.log(`   - Locations: ${LOCATIONS.length} across Vietnam`);
    
    console.log('\n🔐 TEST ACCOUNTS:');
    console.log('   Admin: admin@cabsystem.vn / Admin@123');
    console.log('   Driver: driver1@cabsystem.vn / Driver@123');
    console.log('   Customer: customer1@gmail.com / Customer@123\n');
    
  } catch (error: any) {
    console.error('\n❌ ERROR during seeding:', error.message);
    console.error(error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

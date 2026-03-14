/**
 * Cab Booking System - Database Seed Script
 * Seeds all databases with sample data for development/testing
 *
 * Usage: npx tsx scripts/seed-database.ts
 *
 * Prerequisites: All databases must exist and Prisma migrations applied
 */

import path from 'node:path';

// Use direct connection URLs for local development
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5433';
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
const PASSWORD_HASH =
  '$2a$10$bfRFBfVOiG/.RrxxAeQXIeltcib08rS0Lg2YUGvEh8rUD.8V2y7fi'; // password123

function pgUrl(db: string) {
  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${db}`;
}

function createServicePrismaClient(serviceName: string, dbName: string) {
  const clientModulePath = path.resolve(
    process.cwd(),
    'services',
    serviceName,
    'src',
    'generated',
    'prisma-client'
  );
  const { PrismaClient } = require(clientModulePath);

  return new PrismaClient({
    datasources: { db: { url: pgUrl(dbName) } },
  });
}

// ============ SEED DATA ============

const CUSTOMERS = [
  {
    email: 'customer1@example.com',
    phone: '+84901234561',
    password: PASSWORD_HASH,
    firstName: 'Nguyen',
    lastName: 'Van A',
  },
  {
    email: 'customer2@example.com',
    phone: '+84901234562',
    password: PASSWORD_HASH,
    firstName: 'Tran',
    lastName: 'Thi B',
  },
  {
    email: 'customer3@example.com',
    phone: '+84901234563',
    password: PASSWORD_HASH,
    firstName: 'Le',
    lastName: 'Van C',
  },
];

const DRIVERS = [
  {
    email: 'driver1@example.com',
    phone: '+84911234561',
    password: PASSWORD_HASH,
    firstName: 'Pham',
    lastName: 'Van D',
    vehicle: {
      type: 'CAR',
      brand: 'Toyota',
      model: 'Vios',
      plate: '51A-12345',
      color: 'White',
      year: 2022,
    },
    license: {
      number: 'GP-123456',
      expiryDate: new Date('2027-12-31'),
    },
  },
  {
    email: 'driver2@example.com',
    phone: '+84911234562',
    password: PASSWORD_HASH,
    firstName: 'Vo',
    lastName: 'Thi E',
    vehicle: {
      type: 'CAR',
      brand: 'Honda',
      model: 'City',
      plate: '51A-67890',
      color: 'Black',
      year: 2023,
    },
    license: {
      number: 'GP-654321',
      expiryDate: new Date('2028-06-30'),
    },
  },
  {
    email: 'driver3@example.com',
    phone: '+84911234563',
    password: PASSWORD_HASH,
    firstName: 'Hoang',
    lastName: 'Van F',
    vehicle: {
      type: 'SUV',
      brand: 'Ford',
      model: 'Everest',
      plate: '51A-11111',
      color: 'Silver',
      year: 2023,
    },
    license: {
      number: 'GP-111111',
      expiryDate: new Date('2028-12-31'),
    },
  },
];

const ADMIN = {
  email: 'admin@cabbooking.com',
  phone: '+84900000001',
  password: PASSWORD_HASH,
  firstName: 'System',
  lastName: 'Admin',
};

const BOOKINGS = [
  {
    pickupAddress: '227 Nguyen Van Cu, Q5, TP.HCM',
    pickupLat: 10.7628,
    pickupLng: 106.6825,
    dropoffAddress: 'Saigon Centre, Le Loi, Q1, TP.HCM',
    dropoffLat: 10.7721,
    dropoffLng: 106.7002,
    vehicleType: 'ECONOMY',
    paymentMethod: 'CASH',
    estimatedFare: 45000,
    estimatedDistance: 3.5,
    estimatedDuration: 900,
  },
  {
    pickupAddress: 'Ben Thanh Market, Q1, TP.HCM',
    pickupLat: 10.7726,
    pickupLng: 106.698,
    dropoffAddress: 'Tan Son Nhat Airport, TP.HCM',
    dropoffLat: 10.8185,
    dropoffLng: 106.6588,
    vehicleType: 'COMFORT',
    paymentMethod: 'CARD',
    estimatedFare: 120000,
    estimatedDistance: 8.2,
    estimatedDuration: 1800,
  },
  {
    pickupAddress: 'Phu My Hung, Q7, TP.HCM',
    pickupLat: 10.7294,
    pickupLng: 106.7187,
    dropoffAddress: 'Thu Thiem, Q2, TP.HCM',
    dropoffLat: 10.7875,
    dropoffLng: 106.7342,
    vehicleType: 'PREMIUM',
    paymentMethod: 'WALLET',
    estimatedFare: 85000,
    estimatedDistance: 12.5,
    estimatedDuration: 2400,
  },
];

// ============ SEED FUNCTIONS ============

async function seedAuthDB() {
  console.log('  Seeding auth_db...');
  const prisma = createServicePrismaClient('auth-service', 'auth_db');

  try {
    // Seed admin
    const admin = await prisma.user.upsert({
      where: { email: ADMIN.email },
      update: {},
      create: {
        email: ADMIN.email,
        phone: ADMIN.phone,
        passwordHash: ADMIN.password,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: ADMIN.firstName,
        lastName: ADMIN.lastName,
      },
    });
    console.log(`    Admin: ${admin.email} (${admin.id})`);

    // Seed customers
    const customerIds: string[] = [];
    for (const c of CUSTOMERS) {
      const user = await prisma.user.upsert({
        where: { email: c.email },
        update: {},
        create: {
          email: c.email,
          phone: c.phone,
          passwordHash: c.password,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          firstName: c.firstName,
          lastName: c.lastName,
        },
      });
      customerIds.push(user.id);
      console.log(`    Customer: ${user.email} (${user.id})`);
    }

    // Seed driver users
    const driverUserIds: string[] = [];
    for (const d of DRIVERS) {
      const user = await prisma.user.upsert({
        where: { email: d.email },
        update: {},
        create: {
          email: d.email,
          phone: d.phone,
          passwordHash: d.password,
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName: d.firstName,
          lastName: d.lastName,
        },
      });
      driverUserIds.push(user.id);
      console.log(`    Driver user: ${user.email} (${user.id})`);
    }

    await prisma.$disconnect();
    return { customerIds, driverUserIds, adminId: admin.id };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function seedUserDB(customerIds: string[], driverUserIds: string[]) {
  console.log('  Seeding user_db...');
  const prisma = createServicePrismaClient('user-service', 'user_db');

  try {
    // Seed customer profiles
    for (let i = 0; i < customerIds.length; i++) {
      await prisma.userProfile.upsert({
        where: { userId: customerIds[i] },
        update: {},
        create: {
          userId: customerIds[i],
          firstName: CUSTOMERS[i].firstName,
          lastName: CUSTOMERS[i].lastName,
          phone: CUSTOMERS[i].phone,
          status: 'ACTIVE',
        },
      });
    }

    // Seed driver profiles
    for (let i = 0; i < driverUserIds.length; i++) {
      await prisma.userProfile.upsert({
        where: { userId: driverUserIds[i] },
        update: {},
        create: {
          userId: driverUserIds[i],
          firstName: DRIVERS[i].firstName,
          lastName: DRIVERS[i].lastName,
          phone: DRIVERS[i].phone,
          status: 'ACTIVE',
        },
      });
    }

    console.log(`    ${customerIds.length + driverUserIds.length} profiles created`);
    await prisma.$disconnect();
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function seedDriverDB(driverUserIds: string[]) {
  console.log('  Seeding driver_db...');
  const prisma = createServicePrismaClient('driver-service', 'driver_db');

  try {
    const driverIds: string[] = [];

    for (let i = 0; i < driverUserIds.length; i++) {
      const d = DRIVERS[i];
      const driver = await prisma.driver.upsert({
        where: { userId: driverUserIds[i] },
        update: {},
        create: {
          userId: driverUserIds[i],
          status: 'APPROVED',
          availabilityStatus: 'ONLINE',
          vehicleType: d.vehicle.type,
          vehicleBrand: d.vehicle.brand,
          vehicleModel: d.vehicle.model,
          vehiclePlate: d.vehicle.plate,
          vehicleColor: d.vehicle.color,
          vehicleYear: d.vehicle.year,
          licenseNumber: d.license.number,
          licenseExpiryDate: d.license.expiryDate,
          licenseVerified: true,
          ratingAverage: 4.5 + Math.random() * 0.5,
          ratingCount: Math.floor(Math.random() * 100) + 10,
          lastLocationLat: 10.76 + Math.random() * 0.05,
          lastLocationLng: 106.68 + Math.random() * 0.05,
          lastLocationTime: new Date(),
        },
      });
      driverIds.push(driver.id);
      console.log(`    Driver: ${d.vehicle.plate} (${driver.id})`);
    }

    await prisma.$disconnect();
    return driverIds;
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function seedBookingDB(customerIds: string[]) {
  console.log('  Seeding booking_db...');
  const prisma = createServicePrismaClient('booking-service', 'booking_db');

  try {
    const bookingIds: string[] = [];

    for (let i = 0; i < BOOKINGS.length; i++) {
      const b = BOOKINGS[i];
      const booking = await prisma.booking.create({
        data: {
          customerId: customerIds[i % customerIds.length],
          pickupAddress: b.pickupAddress,
          pickupLat: b.pickupLat,
          pickupLng: b.pickupLng,
          dropoffAddress: b.dropoffAddress,
          dropoffLat: b.dropoffLat,
          dropoffLng: b.dropoffLng,
          vehicleType: b.vehicleType,
          paymentMethod: b.paymentMethod,
          estimatedFare: b.estimatedFare,
          estimatedDistance: b.estimatedDistance,
          estimatedDuration: b.estimatedDuration,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });
      bookingIds.push(booking.id);
      console.log(`    Booking: ${booking.id} (${b.pickupAddress} -> ${b.dropoffAddress})`);
    }

    await prisma.$disconnect();
    return bookingIds;
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function seedMongoDB() {
  console.log('  Seeding MongoDB (notification_db, review_db)...');

  const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
  const MONGO_PORT = process.env.MONGO_PORT || '27017';
  const MONGO_USER = process.env.MONGO_USER || 'mongo';
  const MONGO_PASSWORD = process.env.MONGO_PASSWORD || 'mongo';

  try {
    const mongoose = require('mongoose');

    // Seed notification_db
    const notifConn = await mongoose.createConnection(
      `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/notification_db?authSource=admin`
    );
    const NotifSchema = new mongoose.Schema({
      userId: String,
      type: String,
      recipient: String,
      subject: String,
      message: String,
      status: String,
      priority: String,
      retryCount: Number,
      sentAt: Date,
    }, { timestamps: true });
    const Notification = notifConn.model('Notification', NotifSchema);

    await Notification.create([
      {
        userId: 'seed-user-1',
        type: 'EMAIL',
        recipient: 'customer1@example.com',
        subject: 'Welcome to Cab Booking',
        message: 'Welcome to our cab booking service!',
        status: 'SENT',
        priority: 'MEDIUM',
        retryCount: 0,
        sentAt: new Date(),
      },
      {
        userId: 'seed-user-1',
        type: 'SMS',
        recipient: '+84901234561',
        message: 'Your booking BK001 is confirmed.',
        status: 'SENT',
        priority: 'HIGH',
        retryCount: 0,
        sentAt: new Date(),
      },
    ]);
    console.log('    2 sample notifications created');
    await notifConn.close();

    // Seed review_db
    const reviewConn = await mongoose.createConnection(
      `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/review_db?authSource=admin`
    );
    const ReviewSchema = new mongoose.Schema({
      rideId: String,
      bookingId: String,
      type: String,
      reviewerId: String,
      reviewerName: String,
      revieweeId: String,
      revieweeName: String,
      rating: Number,
      comment: String,
      tags: [String],
    }, { timestamps: true });
    const Review = reviewConn.model('Review', ReviewSchema);

    await Review.create([
      {
        rideId: 'seed-ride-1',
        bookingId: 'seed-booking-1',
        type: 'CUSTOMER_TO_DRIVER',
        reviewerId: 'seed-customer-1',
        reviewerName: 'Nguyen Van A',
        revieweeId: 'seed-driver-1',
        revieweeName: 'Pham Van D',
        rating: 5,
        comment: 'Excellent driver, very professional!',
        tags: ['professional', 'clean_car', 'safe_driving'],
      },
      {
        rideId: 'seed-ride-1',
        bookingId: 'seed-booking-1',
        type: 'DRIVER_TO_CUSTOMER',
        reviewerId: 'seed-driver-1',
        reviewerName: 'Pham Van D',
        revieweeId: 'seed-customer-1',
        revieweeName: 'Nguyen Van A',
        rating: 4,
        comment: 'Polite customer',
        tags: ['friendly'],
      },
    ]);
    console.log('    2 sample reviews created');
    await reviewConn.close();
  } catch (error: any) {
    console.log(`    MongoDB seed skipped: ${error.message}`);
  }
}

// ============ MAIN ============

async function main() {
  console.log('');
  console.log('========================================');
  console.log(' Cab Booking System - Database Seeding');
  console.log('========================================');
  console.log('');

  try {
    // 1. Seed auth database (creates users first)
    const { customerIds, driverUserIds, adminId } = await seedAuthDB();

    // 2. Seed user profiles
    await seedUserDB(customerIds, driverUserIds);

    // 3. Seed driver database
    const driverIds = await seedDriverDB(driverUserIds);

    // 4. Seed bookings
    const bookingIds = await seedBookingDB(customerIds);

    // 5. Seed MongoDB (notifications + reviews)
    await seedMongoDB();

    console.log('');
    console.log('========================================');
    console.log(' Seeding completed successfully!');
    console.log('========================================');
    console.log('');
    console.log(' Summary:');
    console.log(`   Admin:       1 (${adminId})`);
    console.log(`   Customers:   ${customerIds.length}`);
    console.log(`   Drivers:     ${driverIds.length}`);
    console.log(`   Bookings:    ${bookingIds.length}`);
    console.log(`   Notifications: 2 (sample)`);
    console.log(`   Reviews:     2 (sample)`);
    console.log('');
    console.log(' Test credentials:');
    console.log('   All users password: password123');
    console.log('   Admin: admin@cabbooking.com');
    console.log('   Customer: customer1@example.com');
    console.log('   Driver: driver1@example.com');
    console.log('');
  } catch (error: any) {
    console.error('');
    console.error('Seeding failed:', error.message);
    console.error('');
    console.error('Make sure:');
    console.error('  1. PostgreSQL is running on port 5433');
    console.error('  2. MongoDB is running on port 27017');
    console.error('  3. All databases exist (run reset-database script first)');
    console.error('  4. Prisma migrations have been applied');
    process.exit(1);
  }
}

main();

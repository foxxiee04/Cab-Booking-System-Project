/**
 * Cab Booking System - Database Seed Script
 * Seeds all databases with sample data for development/testing
 *
 * Usage: npx tsx scripts/seed-database.ts
 *
 * Prerequisites: All databases must exist and Prisma migrations applied
 */

import path from 'node:path';
import bcrypt from 'bcryptjs';

// Use direct connection URLs for local development
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5433';
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';

// Default password for all seed users: Password@1
const SEED_PASSWORD_HASH = bcrypt.hashSync('Password@1', 10);

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
    phone: '0901234561',
    firstName: 'Nguyen',
    lastName: 'Van A',
  },
  {
    email: 'customer2@example.com',
    phone: '0901234562',
    firstName: 'Tran',
    lastName: 'Thi B',
  },
  {
    email: 'customer3@example.com',
    phone: '0901234563',
    firstName: 'Le',
    lastName: 'Van C',
  },
  {
    email: 'customer4@example.com',
    phone: '0901234564',
    firstName: 'Pham',
    lastName: 'Minh D',
  },
  {
    email: 'customer5@example.com',
    phone: '0901234565',
    firstName: 'Hoang',
    lastName: 'Van E',
  },
  {
    email: 'customer6@example.com',
    phone: '0901234566',
    firstName: 'Dang',
    lastName: 'Thi F',
  },
  {
    email: 'customer7@example.com',
    phone: '0901234567',
    firstName: 'Vu',
    lastName: 'Minh G',
  },
  {
    email: 'customer8@example.com',
    phone: '0901234568',
    firstName: 'Bui',
    lastName: 'Thi H',
  },
  {
    email: 'customer9@example.com',
    phone: '0901234569',
    firstName: 'Ngo',
    lastName: 'Van I',
  },
  {
    email: 'customer10@example.com',
    phone: '0901234570',
    firstName: 'Dinh',
    lastName: 'Thi J',
  },
];

const DRIVERS = [
  {
    email: 'driver1@example.com',
    phone: '0911234561',
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
    phone: '0911234562',
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
    phone: '0911234563',
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
  {
    email: 'driver4@example.com',
    phone: '0911234564',
    firstName: 'Dang',
    lastName: 'Thi G',
    vehicle: {
      type: 'MOTORCYCLE',
      brand: 'Honda',
      model: 'Vision',
      plate: '59X3-24680',
      color: 'Red',
      year: 2024,
    },
    license: {
      number: 'GP-246810',
      expiryDate: new Date('2029-03-31'),
    },
  },
  {
    email: 'driver5@example.com',
    phone: '0911234565',
    firstName: 'Nguyen',
    lastName: 'Van H',
    vehicle: {
      type: 'CAR',
      brand: 'Toyota',
      model: 'Innova',
      plate: '51B-11111',
      color: 'Gray',
      year: 2022,
    },
    license: {
      number: 'GP-555555',
      expiryDate: new Date('2028-09-30'),
    },
  },
  {
    email: 'driver6@example.com',
    phone: '0911234566',
    firstName: 'Tran',
    lastName: 'Van K',
    vehicle: {
      type: 'SUV',
      brand: 'Mitsubishi',
      model: 'Xpander',
      plate: '51B-22222',
      color: 'Blue',
      year: 2023,
    },
    license: {
      number: 'GP-666666',
      expiryDate: new Date('2027-06-30'),
    },
  },
  {
    email: 'driver7@example.com',
    phone: '0911234567',
    firstName: 'Le',
    lastName: 'Thi L',
    vehicle: {
      type: 'MOTORCYCLE',
      brand: 'Honda',
      model: 'Wave Alpha',
      plate: '59B1-33333',
      color: 'Blue',
      year: 2023,
    },
    license: {
      number: 'GP-777777',
      expiryDate: new Date('2029-12-31'),
    },
  },
  {
    email: 'driver8@example.com',
    phone: '0911234568',
    firstName: 'Pham',
    lastName: 'Van M',
    vehicle: {
      type: 'CAR',
      brand: 'Hyundai',
      model: 'Accent',
      plate: '51B-44444',
      color: 'White',
      year: 2024,
    },
    license: {
      number: 'GP-888888',
      expiryDate: new Date('2029-06-30'),
    },
  },
  {
    email: 'driver9@example.com',
    phone: '0911234569',
    firstName: 'Vo',
    lastName: 'Thi N',
    vehicle: {
      type: 'SUV',
      brand: 'Kia',
      model: 'Sorento',
      plate: '51B-55555',
      color: 'Black',
      year: 2023,
    },
    license: {
      number: 'GP-999999',
      expiryDate: new Date('2028-03-31'),
    },
  },
  {
    email: 'driver10@example.com',
    phone: '0911234570',
    firstName: 'Dao',
    lastName: 'Van O',
    vehicle: {
      type: 'SUV',
      brand: 'Toyota',
      model: 'Fortuner',
      plate: '51B-66666',
      color: 'Silver',
      year: 2022,
    },
    license: {
      number: 'GP-000000',
      expiryDate: new Date('2027-09-30'),
    },
  },
];

const ADMIN = {
  email: 'admin@cabbooking.com',
  phone: '0900000001',
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
  {
    pickupAddress: 'Landmark 81, Binh Thanh, TP.HCM',
    pickupLat: 10.7949,
    pickupLng: 106.7219,
    dropoffAddress: 'District 7 Crescent Mall, TP.HCM',
    dropoffLat: 10.7299,
    dropoffLng: 106.7212,
    vehicleType: 'COMFORT',
    paymentMethod: 'CARD',
    estimatedFare: 135000,
    estimatedDistance: 10.7,
    estimatedDuration: 2100,
  },
  {
    pickupAddress: 'Vinhomes Grand Park, Thu Duc, TP.HCM',
    pickupLat: 10.8434,
    pickupLng: 106.8287,
    dropoffAddress: 'Ben Xe Mien Dong Moi, Thu Duc, TP.HCM',
    dropoffLat: 10.8412,
    dropoffLng: 106.8098,
    vehicleType: 'ECONOMY',
    paymentMethod: 'CASH',
    estimatedFare: 52000,
    estimatedDistance: 6.4,
    estimatedDuration: 960,
  },
  {
    pickupAddress: 'Aeon Mall Tan Phu, TP.HCM',
    pickupLat: 10.8018,
    pickupLng: 106.6187,
    dropoffAddress: 'University of Economics HCMC, Q10, TP.HCM',
    dropoffLat: 10.7623,
    dropoffLng: 106.6825,
    vehicleType: 'PREMIUM',
    paymentMethod: 'WALLET',
    estimatedFare: 148000,
    estimatedDistance: 14.2,
    estimatedDuration: 2280,
  },
];

const RIDE_SEEDS = [
  {
    customerIndex: 0,
    driverIndex: 0,
    status: 'COMPLETED',
    vehicleType: 'ECONOMY',
    paymentMethod: 'CASH',
    pickupAddress: '227 Nguyen Van Cu, Q5, TP.HCM',
    pickupLat: 10.7628,
    pickupLng: 106.6825,
    dropoffAddress: 'Saigon Centre, Le Loi, Q1, TP.HCM',
    dropoffLat: 10.7721,
    dropoffLng: 106.7002,
    distance: 3.5,
    duration: 900,
    fare: 45000,
    paymentStatus: 'COMPLETED',
    paymentProvider: 'MOCK',
    paymentCompleted: true,
  },
  {
    customerIndex: 1,
    driverIndex: 1,
    status: 'COMPLETED',
    vehicleType: 'COMFORT',
    paymentMethod: 'MOMO',
    pickupAddress: 'Ben Thanh Market, Q1, TP.HCM',
    pickupLat: 10.7726,
    pickupLng: 106.698,
    dropoffAddress: 'Tan Son Nhat Airport, TP.HCM',
    dropoffLat: 10.8185,
    dropoffLng: 106.6588,
    distance: 8.2,
    duration: 1800,
    fare: 120000,
    paymentStatus: 'COMPLETED',
    paymentProvider: 'MOMO',
    paymentCompleted: true,
  },
  {
    customerIndex: 2,
    driverIndex: 2,
    status: 'CANCELLED',
    vehicleType: 'PREMIUM',
    paymentMethod: 'VNPAY',
    pickupAddress: 'Phu My Hung, Q7, TP.HCM',
    pickupLat: 10.7294,
    pickupLng: 106.7187,
    dropoffAddress: 'Thu Thiem, Q2, TP.HCM',
    dropoffLat: 10.7875,
    dropoffLng: 106.7342,
    distance: 12.5,
    duration: 2400,
    fare: 85000,
    paymentStatus: 'FAILED',
    paymentProvider: 'VNPAY',
    paymentCompleted: false,
  },
  {
    customerIndex: 3,
    driverIndex: 3,
    status: 'ASSIGNED',
    vehicleType: 'ECONOMY',
    paymentMethod: 'CASH',
    pickupAddress: 'Vinhomes Central Park, Binh Thanh, TP.HCM',
    pickupLat: 10.7941,
    pickupLng: 106.7207,
    dropoffAddress: 'Bach Dang Wharf, Q1, TP.HCM',
    dropoffLat: 10.7768,
    dropoffLng: 106.7067,
    distance: 5.1,
    duration: 840,
    fare: 56000,
    paymentStatus: 'PENDING',
    paymentProvider: 'MOCK',
    paymentCompleted: false,
  },
  {
    customerIndex: 0,
    driverIndex: 1,
    status: 'IN_PROGRESS',
    vehicleType: 'COMFORT',
    paymentMethod: 'CARD',
    pickupAddress: 'Landmark 81, Binh Thanh, TP.HCM',
    pickupLat: 10.7949,
    pickupLng: 106.7219,
    dropoffAddress: 'District 7 Crescent Mall, TP.HCM',
    dropoffLat: 10.7299,
    dropoffLng: 106.7212,
    distance: 10.7,
    duration: 2100,
    fare: 135000,
    paymentStatus: 'PROCESSING',
    paymentProvider: 'STRIPE',
    paymentCompleted: false,
  },
  {
    customerIndex: 1,
    driverIndex: undefined,
    status: 'FINDING_DRIVER',
    vehicleType: 'PREMIUM',
    paymentMethod: 'MOMO',
    pickupAddress: 'Aeon Mall Tan Phu, TP.HCM',
    pickupLat: 10.8018,
    pickupLng: 106.6187,
    dropoffAddress: 'University of Economics HCMC, Q10, TP.HCM',
    dropoffLat: 10.7623,
    dropoffLng: 106.6825,
    distance: 14.2,
    duration: 2280,
    fare: 148000,
    paymentStatus: 'REQUIRES_ACTION',
    paymentProvider: 'MOMO',
    paymentCompleted: false,
  },
];

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

// ============ SEED FUNCTIONS ============

async function seedAuthDB() {
  console.log('  Seeding auth_db...');
  const prisma = createServicePrismaClient('auth-service', 'auth_db');

  try {
    // Seed admin
    const admin = await prisma.user.upsert({
      where: { phone: ADMIN.phone },
      update: { passwordHash: SEED_PASSWORD_HASH, status: 'ACTIVE' },
      create: {
        email: ADMIN.email,
        phone: ADMIN.phone,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: ADMIN.firstName,
        lastName: ADMIN.lastName,
        passwordHash: SEED_PASSWORD_HASH,
      },
    });
    console.log(`    Admin: ${admin.phone} (${admin.id})`);

    // Seed customers
    const customerIds: string[] = [];
    for (const c of CUSTOMERS) {
      const user = await prisma.user.upsert({
        where: { phone: c.phone },
        update: { passwordHash: SEED_PASSWORD_HASH, status: 'ACTIVE' },
        create: {
          email: c.email,
          phone: c.phone,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          firstName: c.firstName,
          lastName: c.lastName,
          passwordHash: SEED_PASSWORD_HASH,
        },
      });
      customerIds.push(user.id);
      console.log(`    Customer: ${user.phone} (${user.id})`);
    }

    // Seed driver users
    const driverUserIds: string[] = [];
    for (const d of DRIVERS) {
      const user = await prisma.user.upsert({
        where: { phone: d.phone },
        update: { passwordHash: SEED_PASSWORD_HASH, status: 'ACTIVE' },
        create: {
          email: d.email,
          phone: d.phone,
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName: d.firstName,
          lastName: d.lastName,
          passwordHash: SEED_PASSWORD_HASH,
        },
      });
      driverUserIds.push(user.id);
      console.log(`    Driver user: ${user.phone} (${user.id})`);
    }

    await prisma.$disconnect();
    return { customerIds, driverUserIds, adminId: admin.id };
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function seedUserDB(customerIds: string[], driverUserIds: string[], adminId: string) {
  console.log('  Seeding user_db...');
  const prisma = createServicePrismaClient('user-service', 'user_db');

  try {
    await prisma.userProfile.upsert({
      where: { userId: adminId },
      update: {},
      create: {
        userId: adminId,
        firstName: ADMIN.firstName,
        lastName: ADMIN.lastName,
        phone: ADMIN.phone,
        status: 'ACTIVE',
      },
    });

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

    console.log(`    ${1 + customerIds.length + driverUserIds.length} profiles created`);
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

async function seedRideDB(customerIds: string[], driverIds: string[]) {
  console.log('  Seeding ride_db...');
  const prisma = createServicePrismaClient('ride-service', 'ride_db');

  try {
    const rides: Array<{ id: string; status: string }> = [];

    for (let index = 0; index < RIDE_SEEDS.length; index += 1) {
      const rideSeed = RIDE_SEEDS[index];
      const requestedAt = hoursAgo(24 - index * 3);
      const assignedAt = rideSeed.driverIndex !== undefined ? new Date(requestedAt.getTime() + 5 * 60 * 1000) : null;
      const startedAt = rideSeed.status === 'IN_PROGRESS' || rideSeed.status === 'COMPLETED'
        ? new Date(requestedAt.getTime() + 18 * 60 * 1000)
        : null;
      const completedAt = rideSeed.status === 'COMPLETED'
        ? new Date(requestedAt.getTime() + (rideSeed.duration + 25 * 60) * 1000)
        : null;
      const cancelledAt = rideSeed.status === 'CANCELLED'
        ? new Date(requestedAt.getTime() + 9 * 60 * 1000)
        : null;

      const ride = await prisma.ride.create({
        data: {
          customerId: customerIds[rideSeed.customerIndex],
          driverId: rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null,
          status: rideSeed.status,
          vehicleType: rideSeed.vehicleType,
          paymentMethod: rideSeed.paymentMethod,
          pickupAddress: rideSeed.pickupAddress,
          pickupLat: rideSeed.pickupLat,
          pickupLng: rideSeed.pickupLng,
          dropoffAddress: rideSeed.dropoffAddress,
          dropoffLat: rideSeed.dropoffLat,
          dropoffLng: rideSeed.dropoffLng,
          distance: rideSeed.distance,
          duration: rideSeed.duration,
          fare: rideSeed.fare,
          surgeMultiplier: rideSeed.status === 'FINDING_DRIVER' ? 1.2 : 1,
          suggestedDriverIds: rideSeed.driverIndex !== undefined ? [driverIds[rideSeed.driverIndex]] : [],
          offeredDriverIds: rideSeed.driverIndex !== undefined ? [driverIds[rideSeed.driverIndex]] : [],
          acceptedDriverId: rideSeed.status === 'COMPLETED' || rideSeed.status === 'IN_PROGRESS' || rideSeed.status === 'ASSIGNED'
            ? (rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null)
            : null,
          requestedAt,
          offeredAt: assignedAt,
          assignedAt,
          acceptedAt: rideSeed.status === 'COMPLETED' || rideSeed.status === 'IN_PROGRESS' ? assignedAt : null,
          startedAt,
          completedAt,
          cancelledAt,
          cancelReason: rideSeed.status === 'CANCELLED' ? 'Khách hàng đổi kế hoạch' : null,
          cancelledBy: rideSeed.status === 'CANCELLED' ? 'CUSTOMER' : null,
        },
      });

      rides.push({ id: ride.id, status: rideSeed.status });

      await prisma.rideStateTransition.createMany({
        data: [
          {
            rideId: ride.id,
            fromStatus: null,
            toStatus: 'CREATED',
            actorId: customerIds[rideSeed.customerIndex],
            actorType: 'CUSTOMER',
            occurredAt: requestedAt,
          },
          ...(rideSeed.status === 'FINDING_DRIVER' || rideSeed.status === 'ASSIGNED' || rideSeed.status === 'IN_PROGRESS' || rideSeed.status === 'COMPLETED' || rideSeed.status === 'CANCELLED'
            ? [{
                rideId: ride.id,
                fromStatus: 'CREATED',
                toStatus: rideSeed.status === 'FINDING_DRIVER' ? 'FINDING_DRIVER' : 'ASSIGNED',
                actorId: rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null,
                actorType: rideSeed.driverIndex !== undefined ? 'SYSTEM' : 'SYSTEM',
                occurredAt: assignedAt || requestedAt,
              }]
            : []),
        ],
      });

      console.log(`    Ride: ${ride.id} (${rideSeed.status})`);
    }

    await prisma.$disconnect();
    return rides;
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function seedPaymentDB(rides: Array<{ id: string; status: string }>, customerIds: string[], driverIds: string[]) {
  console.log('  Seeding payment_db...');
  const prisma = createServicePrismaClient('payment-service', 'payment_db');

  try {
    for (let index = 0; index < RIDE_SEEDS.length; index += 1) {
      const rideSeed = RIDE_SEEDS[index];
      const ride = rides[index];
      const initiatedAt = hoursAgo(23 - index * 3);

      await prisma.fare.create({
        data: {
          rideId: ride.id,
          baseFare: Math.round(rideSeed.fare * 0.45),
          distanceFare: Math.round(rideSeed.fare * 0.4),
          timeFare: Math.round(rideSeed.fare * 0.15),
          surgeMultiplier: rideSeed.status === 'FINDING_DRIVER' ? 1.2 : 1,
          totalFare: rideSeed.fare,
          distanceKm: rideSeed.distance,
          durationMinutes: Math.max(1, Math.round(rideSeed.duration / 60)),
          currency: 'VND',
        },
      });

      await prisma.payment.create({
        data: {
          rideId: ride.id,
          customerId: customerIds[rideSeed.customerIndex],
          driverId: rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null,
          amount: rideSeed.fare,
          currency: 'VND',
          method: rideSeed.paymentMethod,
          provider: rideSeed.paymentProvider,
          status: rideSeed.paymentStatus,
          transactionId: rideSeed.paymentStatus === 'COMPLETED' ? `TXN-${ride.id.slice(0, 8).toUpperCase()}` : null,
          paymentIntentId: `PI-${ride.id.slice(0, 12)}`,
          initiatedAt,
          completedAt: rideSeed.paymentCompleted ? new Date(initiatedAt.getTime() + 7 * 60 * 1000) : null,
          failedAt: rideSeed.paymentStatus === 'FAILED' ? new Date(initiatedAt.getTime() + 5 * 60 * 1000) : null,
          failureReason: rideSeed.paymentStatus === 'FAILED' ? 'Khách hàng hủy thanh toán tại cổng' : null,
          metadata: {
            seeded: true,
            source: 'seed-database',
            rideStatus: ride.status,
          },
        },
      });
    }

    console.log(`    ${RIDE_SEEDS.length} fares created`);
    console.log(`    ${RIDE_SEEDS.length} payments created`);
    await prisma.$disconnect();
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function syncDriverRideAssignments(driverIds: string[], rides: Array<{ id: string; status: string }>) {
  console.log('  Syncing driver current rides...');
  const prisma = createServicePrismaClient('driver-service', 'driver_db');

  try {
    for (let index = 0; index < RIDE_SEEDS.length; index += 1) {
      const rideSeed = RIDE_SEEDS[index];
      if (rideSeed.driverIndex === undefined) {
        continue;
      }

      const availabilityStatus = rideSeed.status === 'IN_PROGRESS' || rideSeed.status === 'ASSIGNED'
        ? 'BUSY'
        : 'ONLINE';

      await prisma.driver.update({
        where: { id: driverIds[rideSeed.driverIndex] },
        data: {
          currentRideId: rideSeed.status === 'IN_PROGRESS' || rideSeed.status === 'ASSIGNED' ? rides[index].id : null,
          availabilityStatus,
        },
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

async function seedMongoDB(rides: Array<{ id: string; status: string }>, bookingIds: string[], customerIds: string[], driverIds: string[]) {
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
        rideId: rides[0]?.id,
        bookingId: bookingIds[0],
        type: 'CUSTOMER_TO_DRIVER',
        reviewerId: customerIds[0],
        reviewerName: 'Nguyen Van A',
        revieweeId: driverIds[0],
        revieweeName: 'Pham Van D',
        rating: 5,
        comment: 'Excellent driver, very professional!',
        tags: ['professional', 'clean_car', 'safe_driving'],
      },
      {
        rideId: rides[0]?.id,
        bookingId: bookingIds[0],
        type: 'DRIVER_TO_CUSTOMER',
        reviewerId: driverIds[0],
        reviewerName: 'Pham Van D',
        revieweeId: customerIds[0],
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
    await seedUserDB(customerIds, driverUserIds, adminId);

    // 3. Seed driver database
    const driverIds = await seedDriverDB(driverUserIds);

    // 4. Seed bookings
    const bookingIds = await seedBookingDB(customerIds);

    // 5. Seed rides + payment lifecycle data
    const rides = await seedRideDB(customerIds, driverIds);
    await seedPaymentDB(rides, customerIds, driverIds);
    await syncDriverRideAssignments(driverIds, rides);

    // 6. Seed MongoDB (notifications + reviews)
    await seedMongoDB(rides, bookingIds, customerIds, driverIds);

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
    console.log(`   Rides:       ${rides.length}`);
    console.log(`   Payments:    ${RIDE_SEEDS.length}`);
    console.log(`   Notifications: 2 (sample)`);
    console.log(`   Reviews:     2 (sample)`);
    console.log('');
    console.log(' Test credentials:');
  console.log('   All users password: Password@1');
  console.log('   Admin: admin@cabbooking.com / 0900000001');
  console.log('   Customers: 0901234561 – 0901234570');
  console.log('   Drivers:   0911234561 – 0911234570');
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

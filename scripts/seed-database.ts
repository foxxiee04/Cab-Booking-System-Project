/// <reference types="node" />

/**
 * Cab Booking System - Database Seed Script
 * Seeds all databases with sample data for development/testing
 *
 * Usage: npx tsx scripts/seed-database.ts
 *
 * Prerequisites: All databases must exist and Prisma migrations applied
 */

import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

// Use direct connection URLs for local development
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5433';
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const DRIVER_GEO_KEY = 'drivers:geo:online';
const SEED_REFERENCE_OUTPUT = path.resolve(process.cwd(), 'docs', 'seed-accounts-reference.md');

type SeededDriverLocation = {
  driverId: string;
  lat: number;
  lng: number;
  isOnline: boolean;
};

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

function createRedisClient() {
  const driverRedisModulePath = path.resolve(
    process.cwd(),
    'services',
    'driver-service',
    'node_modules',
    'ioredis'
  );

  let Redis: any;

  try {
    // Prefer service-local dependency resolution.
    Redis = require(driverRedisModulePath);
  } catch {
    Redis = require('ioredis');
  }

  return new Redis(REDIS_URL);
}

async function seedDriverGeoIndex(
  locations: SeededDriverLocation[]
) {
  const redis = createRedisClient();

  try {
    await redis.del(DRIVER_GEO_KEY);

    const onlineLocations = locations.filter((item) => item.isOnline);
    if (onlineLocations.length === 0) {
      console.log('    Redis geo index skipped (no online drivers)');
      return;
    }

    const geoArgs: Array<string | number> = [];
    for (const item of onlineLocations) {
      geoArgs.push(item.lng, item.lat, item.driverId);
    }

    await redis.geoadd(DRIVER_GEO_KEY, ...geoArgs);
    console.log(`    Redis geo index seeded: ${onlineLocations.length} online drivers`);
  } finally {
    redis.disconnect();
  }
}

// ============ SEED DATA ============

const CUSTOMERS = [
  { email: 'customer1@example.com',  phone: '0901234561', firstName: 'Nguyen', lastName: 'Van A' },
  { email: 'customer2@example.com',  phone: '0901234562', firstName: 'Tran',   lastName: 'Thi B' },
  { email: 'customer3@example.com',  phone: '0901234563', firstName: 'Le',     lastName: 'Van C' },
  { email: 'customer4@example.com',  phone: '0901234564', firstName: 'Pham',   lastName: 'Minh D' },
  { email: 'customer5@example.com',  phone: '0901234565', firstName: 'Hoang',  lastName: 'Van E' },
  { email: 'customer6@example.com',  phone: '0901234566', firstName: 'Dang',   lastName: 'Thi F' },
  { email: 'customer7@example.com',  phone: '0901234567', firstName: 'Vu',     lastName: 'Minh G' },
  { email: 'customer8@example.com',  phone: '0901234568', firstName: 'Bui',    lastName: 'Thi H' },
  { email: 'customer9@example.com',  phone: '0901234569', firstName: 'Ngo',    lastName: 'Van I' },
  { email: 'customer10@example.com', phone: '0901234570', firstName: 'Dinh',   lastName: 'Thi J' },
  { email: 'customer11@example.com', phone: '0901234571', firstName: 'Ly',     lastName: 'Van K' },
  { email: 'customer12@example.com', phone: '0901234572', firstName: 'Do',     lastName: 'Thi L' },
  { email: 'customer13@example.com', phone: '0901234573', firstName: 'Trinh',  lastName: 'Van M' },
  { email: 'customer14@example.com', phone: '0901234574', firstName: 'Ha',     lastName: 'Thi N' },
  { email: 'customer15@example.com', phone: '0901234575', firstName: 'Cao',    lastName: 'Van O' },
  { email: 'customer16@example.com', phone: '0901234576', firstName: 'Duong',  lastName: 'Thi P' },
  { email: 'customer17@example.com', phone: '0901234577', firstName: 'Mai',    lastName: 'Van Q' },
  { email: 'customer18@example.com', phone: '0901234578', firstName: 'Truong', lastName: 'Thi R' },
  { email: 'customer19@example.com', phone: '0901234579', firstName: 'Lam',    lastName: 'Van S' },
  { email: 'customer20@example.com', phone: '0901234580', firstName: 'Huynh',  lastName: 'Thi T' },
];

const DRIVERS = [
  {
    email: 'driver1@example.com',
    phone: '0911234561',
    firstName: 'Pham',
    lastName: 'Van D',
    vehicle: {
      type: 'CAR_4',
      brand: 'Toyota',
      model: 'Vios',
      plate: '51A-12345',
      color: 'White',
      year: 2022,
    },
    license: {
      class: 'B',
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
      type: 'CAR_4',
      brand: 'Honda',
      model: 'City',
      plate: '51A-67890',
      color: 'Black',
      year: 2023,
    },
    license: {
      class: 'B',
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
      type: 'CAR_7',
      brand: 'Ford',
      model: 'Everest',
      plate: '51A-11111',
      color: 'Silver',
      year: 2023,
    },
    license: {
      class: 'D2',
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
      type: 'SCOOTER',
      brand: 'Honda',
      model: 'Vision',
      plate: '59X3-24680',
      color: 'Red',
      year: 2024,
    },
    license: {
      class: 'A1',
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
      type: 'CAR_7',
      brand: 'Toyota',
      model: 'Innova',
      plate: '51B-11111',
      color: 'Gray',
      year: 2022,
    },
    license: {
      class: 'D2',
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
      type: 'CAR_7',
      brand: 'Mitsubishi',
      model: 'Xpander',
      plate: '51B-22222',
      color: 'Blue',
      year: 2023,
    },
    license: {
      class: 'D2',
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
      type: 'MOTORBIKE',
      brand: 'Honda',
      model: 'Wave Alpha',
      plate: '59B1-33333',
      color: 'Blue',
      year: 2023,
    },
    license: {
      class: 'A1',
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
      type: 'CAR_4',
      brand: 'Hyundai',
      model: 'Accent',
      plate: '51B-44444',
      color: 'White',
      year: 2024,
    },
    license: {
      class: 'B',
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
      type: 'CAR_7',
      brand: 'Kia',
      model: 'Sorento',
      plate: '51B-55555',
      color: 'Black',
      year: 2023,
    },
    license: {
      class: 'D2',
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
      type: 'CAR_7',
      brand: 'Toyota',
      model: 'Fortuner',
      plate: '51B-66666',
      color: 'Silver',
      year: 2022,
    },
    license: {
      class: 'D2',
      number: 'GP-000000',
      expiryDate: new Date('2027-09-30'),
    },
  },
];

const VEHICLE_IMAGE_BY_TYPE: Record<string, string> = {
  MOTORBIKE: 'xe-may.jpg',
  SCOOTER: 'xe-ga.jpg',
  CAR_4: '4-cho.jpg',
  CAR_7: '7-cho.jpg',
};

const VEHICLE_IMAGE_BY_MODEL: Record<string, string> = {
  'Wave Alpha': 'wave-alpha.jpg',
  'Winner X': 'winner-x.jpg',
  'Sirius': 'sirius.jpg',
  'Raider': 'raider.jpg',
  'Vios': 'vios.jpg',
  'City': 'city.jpg',
  'Accent': 'accent.jpg',
  'Elantra': 'elantra.jpg',
  'K3': 'k3.jpg',
  'Civic': 'civic.jpg',
  'Mazda2': 'mazda2.jpg',
  'Mazda3': 'mazda3.jpg',
  'Vision': 'vision.jpg',
  'Air Blade': 'air-blade.jpg',
  'Lead': 'lead.jpg',
  'Janus': 'janus.jpg',
  'Corolla Altis': 'altis.jpg',
  'Yaris Cross': 'yaris.jpg',
  'Innova': 'innova.jpg',
  'Fortuner': 'fortuner.jpg',
  'Stargazer': 'stargazer.jpg',
  'Xpander': 'xpander.jpg',
  'Everest': 'everest.jpg',
  'Sorento': 'sorento.jpg',
  'VF e34': 'vin34.jpg',
  'VF 6': 'vin6.jpg',
};

function resolveVehicleImagePath(vehicle: { type: string; model: string }) {
  const fileName = VEHICLE_IMAGE_BY_MODEL[vehicle.model] || VEHICLE_IMAGE_BY_TYPE[vehicle.type] || '4-cho.jpg';
  return `/vehicle-images/${fileName}`;
}

function getLicenseClassByVehicleType(vehicleType: string) {
  if (vehicleType === 'MOTORBIKE' || vehicleType === 'SCOOTER') {
    return 'A1';
  }

  if (vehicleType === 'CAR_7') {
    return 'D2';
  }

  return 'B';
}

const EXTRA_DRIVER_COUNT = 30;
const EXTRA_VEHICLE_TYPES = ['CAR_4', 'CAR_7', 'MOTORBIKE', 'SCOOTER'] as const;
const EXTRA_VEHICLE_COLORS = ['White', 'Black', 'Silver', 'Blue', 'Red'] as const;

const EXTRA_VEHICLES_BY_TYPE: Record<typeof EXTRA_VEHICLE_TYPES[number], Array<{ brand: string; model: string }>> = {
  CAR_4: [
    { brand: 'Toyota', model: 'Vios' },
    { brand: 'Toyota', model: 'Corolla Altis' },
    { brand: 'Toyota', model: 'Yaris Cross' },
    { brand: 'Hyundai', model: 'Accent' },
    { brand: 'Hyundai', model: 'Elantra' },
    { brand: 'Kia', model: 'K3' },
    { brand: 'Honda', model: 'City' },
    { brand: 'Honda', model: 'Civic' },
    { brand: 'Mazda', model: 'Mazda2' },
    { brand: 'Mazda', model: 'Mazda3' },
    { brand: 'VinFast', model: 'VF e34' },
    { brand: 'VinFast', model: 'VF 6' },
  ],
  CAR_7: [
    { brand: 'Toyota', model: 'Innova' },
    { brand: 'Toyota', model: 'Fortuner' },
    { brand: 'Hyundai', model: 'Stargazer' },
    { brand: 'Mitsubishi', model: 'Xpander' },
    { brand: 'Ford', model: 'Everest' },
    { brand: 'Kia', model: 'Sorento' },
  ],
  MOTORBIKE: [
    { brand: 'Honda', model: 'Wave Alpha' },
    { brand: 'Honda', model: 'Winner X' },
    { brand: 'Yamaha', model: 'Sirius' },
    { brand: 'Suzuki', model: 'Raider' },
  ],
  SCOOTER: [
    { brand: 'Honda', model: 'Vision' },
    { brand: 'Honda', model: 'Air Blade' },
    { brand: 'Honda', model: 'Lead' },
    { brand: 'Yamaha', model: 'Janus' },
  ],
};

for (let i = 0; i < EXTRA_DRIVER_COUNT; i += 1) {
  const serial = i + 11;
  const phone = `0919${String(100000 + i).slice(-6)}`;
  const email = `driver${serial}@example.com`;
  const vehicleType = EXTRA_VEHICLE_TYPES[i % EXTRA_VEHICLE_TYPES.length];
  const vehicleOptions = EXTRA_VEHICLES_BY_TYPE[vehicleType];
  const selectedVehicle = vehicleOptions[i % vehicleOptions.length];

  DRIVERS.push({
    email,
    phone,
    firstName: `Seed${serial}`,
    lastName: 'Driver',
    vehicle: {
      type: vehicleType,
      brand: selectedVehicle.brand,
      model: selectedVehicle.model,
      plate: `59Z-${String(10000 + serial).slice(-5)}`,
      color: EXTRA_VEHICLE_COLORS[i % EXTRA_VEHICLE_COLORS.length],
      year: 2021 + (i % 4),
    },
    license: {
      class: getLicenseClassByVehicleType(vehicleType),
      number: `GP-EXTRA-${String(serial).padStart(4, '0')}`,
      expiryDate: new Date('2029-12-31'),
    },
  });
}

const DRIVER_LOCATION_HUBS = [
  { name: 'Cụm Bến Thành - Quận 1', lat: 10.7726, lng: 106.6980 },
  { name: 'Cụm Tân Sơn Nhất - Tân Bình', lat: 10.8185, lng: 106.6588 },
  { name: 'Cụm Phú Mỹ Hưng - Quận 7', lat: 10.7294, lng: 106.7187 },
  { name: 'Cụm Thủ Đức', lat: 10.8495, lng: 106.7718 },
  { name: 'Cụm Quận 5 - Chợ Rẫy', lat: 10.7628, lng: 106.6825 },
  { name: 'Cụm Tân Phú', lat: 10.8018, lng: 106.6187 },
];

function seededDriverLocation(index: number) {
  const hub = DRIVER_LOCATION_HUBS[index % DRIVER_LOCATION_HUBS.length];
  const ring = 0.003 + (index % 7) * 0.0016;
  const angle = (index * 37 * Math.PI) / 180;
  return {
    lat: hub.lat + Math.sin(angle) * ring,
    lng: hub.lng + Math.cos(angle) * ring,
  };
}

const ADMIN = {
  email: 'admin@cabbooking.com',
  phone: '0900000001',
  firstName: 'System',
  lastName: 'Admin',
};

const BOOKINGS = [
  {
    pickupAddress: '227 Nguyen Van Cu, Q5, TP.HCM',
    pickupLat: 10.7628, pickupLng: 106.6825,
    dropoffAddress: 'Saigon Centre, Le Loi, Q1, TP.HCM',
    dropoffLat: 10.7721, dropoffLng: 106.7002,
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    estimatedFare: 45000, estimatedDistance: 3.5, estimatedDuration: 900,
  },
  {
    pickupAddress: 'Ben Thanh Market, Q1, TP.HCM',
    pickupLat: 10.7726, pickupLng: 106.698,
    dropoffAddress: 'Tan Son Nhat Airport, TP.HCM',
    dropoffLat: 10.8185, dropoffLng: 106.6588,
    vehicleType: 'CAR_4', paymentMethod: 'CARD',
    estimatedFare: 120000, estimatedDistance: 8.2, estimatedDuration: 1800,
  },
  {
    pickupAddress: 'Phu My Hung, Q7, TP.HCM',
    pickupLat: 10.7294, pickupLng: 106.7187,
    dropoffAddress: 'Thu Thiem, TP.HCM',
    dropoffLat: 10.7875, dropoffLng: 106.7342,
    vehicleType: 'CAR_7', paymentMethod: 'WALLET',
    estimatedFare: 85000, estimatedDistance: 12.5, estimatedDuration: 2400,
  },
  {
    pickupAddress: 'Landmark 81, Binh Thanh, TP.HCM',
    pickupLat: 10.7949, pickupLng: 106.7219,
    dropoffAddress: 'Crescent Mall, Q7, TP.HCM',
    dropoffLat: 10.7299, dropoffLng: 106.7212,
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    estimatedFare: 135000, estimatedDistance: 10.7, estimatedDuration: 2100,
  },
  {
    pickupAddress: 'Vinhomes Grand Park, Thu Duc, TP.HCM',
    pickupLat: 10.8434, pickupLng: 106.8287,
    dropoffAddress: 'Ben Xe Mien Dong Moi, Thu Duc, TP.HCM',
    dropoffLat: 10.8412, dropoffLng: 106.8098,
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    estimatedFare: 52000, estimatedDistance: 6.4, estimatedDuration: 960,
  },
  {
    pickupAddress: 'Aeon Mall Tan Phu, TP.HCM',
    pickupLat: 10.8018, pickupLng: 106.6187,
    dropoffAddress: 'University of Economics HCMC, Q10, TP.HCM',
    dropoffLat: 10.7623, dropoffLng: 106.6825,
    vehicleType: 'CAR_7', paymentMethod: 'WALLET',
    estimatedFare: 148000, estimatedDistance: 14.2, estimatedDuration: 2280,
  },
  {
    pickupAddress: 'Bệnh viện Chợ Rẫy, Q5, TP.HCM',
    pickupLat: 10.7555, pickupLng: 106.6721,
    dropoffAddress: 'Bệnh viện Đại học Y Dược, Q5, TP.HCM',
    dropoffLat: 10.7614, dropoffLng: 106.6779,
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    estimatedFare: 22000, estimatedDistance: 1.8, estimatedDuration: 420,
  },
  {
    pickupAddress: 'Đại học Bách Khoa TPHCM, Q10',
    pickupLat: 10.7721, pickupLng: 106.6589,
    dropoffAddress: 'Hồ Con Rùa, Q3, TP.HCM',
    dropoffLat: 10.7793, dropoffLng: 106.6957,
    vehicleType: 'SCOOTER', paymentMethod: 'CARD',
    estimatedFare: 35000, estimatedDistance: 2.4, estimatedDuration: 600,
  },
  {
    pickupAddress: 'Sân vận động Thống Nhất, Q10',
    pickupLat: 10.7817, pickupLng: 106.6834,
    dropoffAddress: 'Dinh Độc Lập, Q1, TP.HCM',
    dropoffLat: 10.7793, dropoffLng: 106.6957,
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    estimatedFare: 38000, estimatedDistance: 2.9, estimatedDuration: 720,
  },
  {
    pickupAddress: 'Lotte Mart Gò Vấp, TP.HCM',
    pickupLat: 10.8312, pickupLng: 106.6837,
    dropoffAddress: 'Công viên Hoàng Văn Thụ, Tân Bình',
    dropoffLat: 10.8013, dropoffLng: 106.6571,
    vehicleType: 'CAR_7', paymentMethod: 'WALLET',
    estimatedFare: 72000, estimatedDistance: 5.8, estimatedDuration: 1200,
  },
];

const RIDE_SEEDS = [
  // ---- COMPLETED rides (cash/momo/vnpay) ----
  {
    customerIndex: 0, driverIndex: 0, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: '227 Nguyen Van Cu, Q5, TP.HCM', pickupLat: 10.7628, pickupLng: 106.6825,
    dropoffAddress: 'Saigon Centre, Le Loi, Q1, TP.HCM', dropoffLat: 10.7721, dropoffLng: 106.7002,
    distance: 3.5, duration: 900, fare: 45000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 1, driverIndex: 1, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Ben Thanh Market, Q1, TP.HCM', pickupLat: 10.7726, pickupLng: 106.698,
    dropoffAddress: 'Tan Son Nhat Airport, TP.HCM', dropoffLat: 10.8185, dropoffLng: 106.6588,
    distance: 8.2, duration: 1800, fare: 120000, paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 2, driverIndex: 2, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'Phu My Hung, Q7, TP.HCM', pickupLat: 10.7294, pickupLng: 106.7187,
    dropoffAddress: 'Thu Thiem, TP.HCM', dropoffLat: 10.7875, dropoffLng: 106.7342,
    distance: 12.5, duration: 2400, fare: 85000, paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  {
    customerIndex: 3, driverIndex: 3, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Chợ Bến Thành, Q1, TP.HCM', pickupLat: 10.7726, pickupLng: 106.6981,
    dropoffAddress: 'Nhà thờ Đức Bà, Q1, TP.HCM', dropoffLat: 10.7798, dropoffLng: 106.699,
    distance: 1.2, duration: 360, fare: 18000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 4, driverIndex: 4, status: 'COMPLETED', vehicleType: 'SCOOTER', paymentMethod: 'MOMO',
    pickupAddress: 'Đại học Bách Khoa TPHCM, Q10', pickupLat: 10.7721, pickupLng: 106.6589,
    dropoffAddress: 'Công viên 23/9, Q1, TP.HCM', dropoffLat: 10.7707, dropoffLng: 106.6972,
    distance: 3.8, duration: 780, fare: 32000, paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 5, driverIndex: 5, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Landmark 81, Binh Thanh, TP.HCM', pickupLat: 10.7949, pickupLng: 106.7219,
    dropoffAddress: 'Crescent Mall, Q7, TP.HCM', dropoffLat: 10.7299, dropoffLng: 106.7212,
    distance: 10.7, duration: 2100, fare: 135000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 6, driverIndex: 6, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'VNPAY',
    pickupAddress: 'Lotte Mart Gò Vấp, TP.HCM', pickupLat: 10.8312, pickupLng: 106.6837,
    dropoffAddress: 'Bệnh viện Gia Định, Bình Thạnh',
    dropoffLat: 10.8156, dropoffLng: 106.7021,
    distance: 5.8, duration: 1080, fare: 63000, paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  {
    customerIndex: 7, driverIndex: 7, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Ga Sài Gòn, Q3, TP.HCM', pickupLat: 10.7814, pickupLng: 106.6819,
    dropoffAddress: 'Hồ Con Rùa, Q3, TP.HCM', dropoffLat: 10.7793, dropoffLng: 106.6957,
    distance: 1.5, duration: 480, fare: 20000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 8, driverIndex: 8, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'MOMO',
    pickupAddress: 'Vinhomes Grand Park, Thu Duc, TP.HCM', pickupLat: 10.8434, pickupLng: 106.8287,
    dropoffAddress: 'Ben Xe Mien Dong Moi, Thu Duc', dropoffLat: 10.8412, dropoffLng: 106.8098,
    distance: 6.4, duration: 960, fare: 52000, paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 9, driverIndex: 9, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Aeon Mall Tan Phu, TP.HCM', pickupLat: 10.8018, pickupLng: 106.6187,
    dropoffAddress: 'Trường ĐH Kinh Tế TP.HCM, Q10', dropoffLat: 10.7623, dropoffLng: 106.6825,
    distance: 14.2, duration: 2280, fare: 148000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 10, driverIndex: 0, status: 'COMPLETED', vehicleType: 'SCOOTER', paymentMethod: 'VNPAY',
    pickupAddress: 'RMIT Sài Gòn, Q7, TP.HCM', pickupLat: 10.7316, pickupLng: 106.7222,
    dropoffAddress: 'Phú Mỹ Hưng, Q7, TP.HCM', dropoffLat: 10.7294, dropoffLng: 106.7187,
    distance: 2.1, duration: 540, fare: 27000, paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  {
    customerIndex: 11, driverIndex: 1, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Dinh Độc Lập, Q1, TP.HCM', pickupLat: 10.7793, pickupLng: 106.6957,
    dropoffAddress: 'Bảo tàng Chiến tranh, Q3, TP.HCM', dropoffLat: 10.7785, dropoffLng: 106.6896,
    distance: 0.9, duration: 300, fare: 25000, paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 12, driverIndex: 2, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Sân vận động Thống Nhất, Q10', pickupLat: 10.7817, pickupLng: 106.6834,
    dropoffAddress: 'Bệnh viện Chợ Rẫy, Q5, TP.HCM', dropoffLat: 10.7555, dropoffLng: 106.6721,
    distance: 4.1, duration: 840, fare: 38000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 13, driverIndex: 3, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'Bến cảng Nhà Rồng, Q4, TP.HCM', pickupLat: 10.7647, pickupLng: 106.7046,
    dropoffAddress: 'Khu đô thị Sala, TP.Thủ Đức', dropoffLat: 10.7857, dropoffLng: 106.7466,
    distance: 7.3, duration: 1380, fare: 78000, paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  {
    customerIndex: 14, driverIndex: 4, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Chợ Tân Bình, TP.HCM', pickupLat: 10.7967, pickupLng: 106.6516,
    dropoffAddress: 'Sân bay Tân Sơn Nhất, TP.HCM', dropoffLat: 10.8185, dropoffLng: 106.6588,
    distance: 3.2, duration: 720, fare: 55000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // ---- CANCELLED rides ----
  {
    customerIndex: 15, driverIndex: 5, status: 'CANCELLED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Nhà hàng Phở Hòa, Q10, TP.HCM', pickupLat: 10.7762, pickupLng: 106.6751,
    dropoffAddress: 'Chợ Bình Thới, Q11, TP.HCM', dropoffLat: 10.7688, dropoffLng: 106.6573,
    distance: 2.8, duration: 660, fare: 40000, paymentStatus: 'FAILED', paymentProvider: 'MOMO', paymentCompleted: false,
  },
  {
    customerIndex: 16, driverIndex: undefined, status: 'CANCELLED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Trường THPT Lê Hồng Phong, Q5', pickupLat: 10.7519, pickupLng: 106.6742,
    dropoffAddress: 'Công viên Lê Văn Tám, Q1', dropoffLat: 10.7838, dropoffLng: 106.7013,
    distance: 4.7, duration: 900, fare: 42000, paymentStatus: 'FAILED', paymentProvider: 'MOCK', paymentCompleted: false,
  },
  // ---- ASSIGNED (driver matched, not picked up yet) ----
  {
    customerIndex: 17, driverIndex: 6, status: 'ASSIGNED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Vinhomes Central Park, Bình Thạnh', pickupLat: 10.7941, pickupLng: 106.7207,
    dropoffAddress: 'Bạch Đằng Wharf, Q1, TP.HCM', dropoffLat: 10.7768, dropoffLng: 106.7067,
    distance: 5.1, duration: 840, fare: 56000, paymentStatus: 'PENDING', paymentProvider: 'MOCK', paymentCompleted: false,
  },
  // ---- PICKING_UP (driver on the way to customer) ----
  {
    customerIndex: 18, driverIndex: 7, status: 'PICKING_UP', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'BigC An Lạc, Bình Tân, TP.HCM', pickupLat: 10.7521, pickupLng: 106.6092,
    dropoffAddress: 'Đầm Sen, Q11, TP.HCM', dropoffLat: 10.7666, dropoffLng: 106.6382,
    distance: 5.4, duration: 1020, fare: 60000, paymentStatus: 'PENDING', paymentProvider: 'VNPAY', paymentCompleted: false,
  },
  // ---- IN_PROGRESS (ride currently happening) ----
  {
    customerIndex: 19, driverIndex: 8, status: 'IN_PROGRESS', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Landmark 81, Bình Thạnh, TP.HCM', pickupLat: 10.7949, pickupLng: 106.7219,
    dropoffAddress: 'Crescent Mall, Q7, TP.HCM', dropoffLat: 10.7299, dropoffLng: 106.7212,
    distance: 10.7, duration: 2100, fare: 135000, paymentStatus: 'PROCESSING', paymentProvider: 'MOMO', paymentCompleted: false,
  },
  // ---- FINDING_DRIVER ----
  {
    customerIndex: 0, driverIndex: undefined, status: 'FINDING_DRIVER', vehicleType: 'CAR_7', paymentMethod: 'MOMO',
    pickupAddress: 'Aeon Mall Tân Phú, TP.HCM', pickupLat: 10.8018, pickupLng: 106.6187,
    dropoffAddress: 'Trường ĐH Kinh Tế TP.HCM, Q10', dropoffLat: 10.7623, dropoffLng: 106.6825,
    distance: 14.2, duration: 2280, fare: 148000, paymentStatus: 'REQUIRES_ACTION', paymentProvider: 'MOMO', paymentCompleted: false,
  },
  // ---- More COMPLETED ----
  {
    customerIndex: 1, driverIndex: 9, status: 'COMPLETED', vehicleType: 'SCOOTER', paymentMethod: 'CASH',
    pickupAddress: 'Trường ĐH Sư Phạm TPHCM, Q5', pickupLat: 10.7627, pickupLng: 106.6844,
    dropoffAddress: 'Siêu thị Co.opmart Đinh Tiên Hoàng, Bình Thạnh', dropoffLat: 10.8024, dropoffLng: 106.7113,
    distance: 5.9, duration: 1140, fare: 48000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 2, driverIndex: 0, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'VNPAY',
    pickupAddress: 'Bệnh viện Đại học Y Dược, Q5, TP.HCM', pickupLat: 10.7614, pickupLng: 106.6779,
    dropoffAddress: 'Trung tâm thương mại Bitexco, Q1', dropoffLat: 10.7722, dropoffLng: 106.7047,
    distance: 2.7, duration: 660, fare: 42000, paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  {
    customerIndex: 3, driverIndex: 1, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'MOMO',
    pickupAddress: 'Công viên Hoàng Văn Thụ, Tân Bình', pickupLat: 10.8013, pickupLng: 106.6571,
    dropoffAddress: 'Chợ Phạm Văn Hai, Tân Bình', dropoffLat: 10.7986, dropoffLng: 106.6493,
    distance: 1.0, duration: 300, fare: 16000, paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 4, driverIndex: 2, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Đại học Quốc gia TP.HCM, Thu Duc', pickupLat: 10.8701, pickupLng: 106.8037,
    dropoffAddress: 'QTSC, Quận 12, TP.HCM', dropoffLat: 10.8642, dropoffLng: 106.7978,
    distance: 2.3, duration: 480, fare: 30000, paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 5, driverIndex: 3, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'Khu đô thị Sala, TP.Thủ Đức', pickupLat: 10.7857, pickupLng: 106.7466,
    dropoffAddress: 'Bảo tàng TP.HCM, Q1', dropoffLat: 10.7773, dropoffLng: 106.7008,
    distance: 8.6, duration: 1560, fare: 95000, paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
];

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const startLat = toRad(lat1);
  const endLat = toRad(lat2);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function formatCoordinate(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function getVehicleTypeLabel(vehicleType: string) {
  if (vehicleType === 'MOTORBIKE') {
    return 'Xe máy số';
  }
  if (vehicleType === 'SCOOTER') {
    return 'Xe tay ga';
  }
  if (vehicleType === 'CAR_4') {
    return 'Ô tô 4 chỗ';
  }
  if (vehicleType === 'CAR_7') {
    return 'Ô tô 7 chỗ';
  }
  return vehicleType;
}

function getNearestDriverHub(lat: number, lng: number) {
  return DRIVER_LOCATION_HUBS
    .map((hub) => ({
      ...hub,
      distanceKm: haversineKm(lat, lng, hub.lat, hub.lng),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0];
}

function getCustomerReference(index: number) {
  const rideSeed = RIDE_SEEDS.find((item) => item.customerIndex === index);
  if (rideSeed) {
    return {
      address: rideSeed.pickupAddress,
      lat: rideSeed.pickupLat,
      lng: rideSeed.pickupLng,
    };
  }

  const booking = BOOKINGS[index % BOOKINGS.length];
  return {
    address: booking.pickupAddress,
    lat: booking.pickupLat,
    lng: booking.pickupLng,
  };
}

async function generateSeedReferenceReport(
  adminId: string,
  customerIds: string[],
  driverUserIds: string[],
  driverIds: string[]
) {
  const authPrisma = createServicePrismaClient('auth-service', 'auth_db');
  const driverPrisma = createServicePrismaClient('driver-service', 'driver_db');

  try {
    const [customerUsers, driverUsers, drivers]: [any[], any[], any[]] = await Promise.all([
      authPrisma.user.findMany({ where: { id: { in: customerIds } } }),
      authPrisma.user.findMany({ where: { id: { in: driverUserIds } } }),
      driverPrisma.driver.findMany({ where: { id: { in: driverIds } } }),
    ]);

    const customerUsersById = new Map(customerUsers.map((user: any) => [user.id, user]));
    const driverUsersById = new Map(driverUsers.map((user: any) => [user.id, user]));
    const driversById = new Map(drivers.map((driver: any) => [driver.id, driver]));

    const driverRows = driverIds.map((driverId, index) => {
      const driver = driversById.get(driverId) as any;
      const authUser = driverUsersById.get(driver?.userId || driverUserIds[index]);
      const nearestHub = getNearestDriverHub(driver.lastLocationLat, driver.lastLocationLng);

      return {
        index: index + 1,
        id: driverId,
        name: `${authUser?.firstName || DRIVERS[index].firstName} ${authUser?.lastName || DRIVERS[index].lastName}`,
        email: authUser?.email || DRIVERS[index].email,
        phone: authUser?.phone || DRIVERS[index].phone,
        status: driver.status,
        availabilityStatus: driver.availabilityStatus,
        vehicleType: driver.vehicleType,
        vehicleLabel: getVehicleTypeLabel(driver.vehicleType),
        vehicleName: `${driver.vehicleBrand} ${driver.vehicleModel}`,
        plate: driver.vehiclePlate,
        imageUrl: driver.vehicleImageUrl,
        lat: Number(driver.lastLocationLat),
        lng: Number(driver.lastLocationLng),
        nearestHubName: nearestHub.name,
        nearestHubDistanceKm: nearestHub.distanceKm,
      };
    });

    const customerRows = customerIds.map((customerId, index) => {
      const authUser = customerUsersById.get(customerId) as any;
      const reference = getCustomerReference(index);

      return {
        index: index + 1,
        id: customerId,
        name: `${authUser?.firstName || CUSTOMERS[index].firstName} ${authUser?.lastName || CUSTOMERS[index].lastName}`,
        email: authUser?.email || CUSTOMERS[index].email,
        phone: authUser?.phone || CUSTOMERS[index].phone,
        address: reference.address,
        lat: reference.lat,
        lng: reference.lng,
      };
    });

    const clusterRows = DRIVER_LOCATION_HUBS.map((hub) => {
      const driversInCluster = driverRows.filter((driver) => driver.nearestHubName === hub.name);
      return {
        hub,
        drivers: driversInCluster,
      };
    });

    const nearbyScenarioRows = customerRows.map((customer) => {
      const distances = driverRows
        .filter((driver) => driver.status === 'APPROVED')
        .map((driver) => ({
          ...driver,
          distanceKm: haversineKm(customer.lat, customer.lng, driver.lat, driver.lng),
        }))
        .sort((left, right) => left.distanceKm - right.distanceKm);

      return {
        customer,
        within3km: distances.filter((driver) => driver.distanceKm <= 3).slice(0, 5),
        outside3km: distances.filter((driver) => driver.distanceKm > 3).slice(0, 5),
      };
    });

    const lines: string[] = [];
    lines.push('# Seed Account Reference');
    lines.push('');
    lines.push(`Generated at: ${new Date().toLocaleString('vi-VN')}`);
    lines.push('');
    lines.push('## Credentials');
    lines.push('');
    lines.push(`- Admin: ${ADMIN.email} / ${ADMIN.phone}`);
    lines.push('- Password chung: Password@1');
    lines.push(`- Admin userId: ${adminId}`);
    lines.push('');
    lines.push('## Driver Accounts');
    lines.push('');
    lines.push('| # | Tài xế | Điện thoại | Trạng thái | Loại xe | Xe | Biển số | Ảnh | Vị trí hiện tại | Cụm gần nhất |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const driver of driverRows) {
      lines.push(`| ${driver.index} | ${driver.name} | ${driver.phone} | ${driver.status} / ${driver.availabilityStatus} | ${driver.vehicleLabel} | ${driver.vehicleName} | ${driver.plate} | ${driver.imageUrl} | ${formatCoordinate(driver.lat, driver.lng)} | ${driver.nearestHubName} (${driver.nearestHubDistanceKm.toFixed(2)} km) |`);
    }
    lines.push('');
    lines.push('## Customer Accounts');
    lines.push('');
    lines.push('| # | Khách hàng | Điện thoại | Email | Điểm seed tham chiếu | Tọa độ |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const customer of customerRows) {
      lines.push(`| ${customer.index} | ${customer.name} | ${customer.phone} | ${customer.email} | ${customer.address} | ${formatCoordinate(customer.lat, customer.lng)} |`);
    }
    lines.push('');
    lines.push('## Driver Clusters');
    lines.push('');
    for (const cluster of clusterRows) {
      lines.push(`### ${cluster.hub.name}`);
      lines.push('');
      if (cluster.drivers.length === 0) {
        lines.push('- Không có tài xế trong cụm này.');
        lines.push('');
        continue;
      }

      for (const driver of cluster.drivers) {
        lines.push(`- ${driver.phone} - ${driver.name} - ${driver.vehicleName} - ${driver.plate} - ${formatCoordinate(driver.lat, driver.lng)}`);
      }
      lines.push('');
    }
    lines.push('## Kịch bản tài xế trong và ngoài 3 km theo từng khách hàng');
    lines.push('');
    for (const scenario of nearbyScenarioRows) {
      lines.push(`### ${scenario.customer.phone} - ${scenario.customer.name}`);
      lines.push(`- Điểm tham chiếu: ${scenario.customer.address} (${formatCoordinate(scenario.customer.lat, scenario.customer.lng)})`);
      lines.push('- Tài xế trong 3 km:');
      if (scenario.within3km.length === 0) {
        lines.push('  Không có tài xế nào trong bán kính 3 km.');
      } else {
        for (const driver of scenario.within3km) {
          lines.push(`  ${driver.phone} - ${driver.vehicleName} - ${driver.plate} - ${driver.distanceKm.toFixed(2)} km - ${driver.nearestHubName}`);
        }
      }
      lines.push('- Tài xế ngoài 3 km gần nhất:');
      if (scenario.outside3km.length === 0) {
        lines.push('  Không có tài xế ngoài 3 km.');
      } else {
        for (const driver of scenario.outside3km) {
          lines.push(`  ${driver.phone} - ${driver.vehicleName} - ${driver.plate} - ${driver.distanceKm.toFixed(2)} km - ${driver.nearestHubName}`);
        }
      }
      lines.push('');
    }

    fs.writeFileSync(SEED_REFERENCE_OUTPUT, `${lines.join('\n')}\n`, 'utf8');
    console.log(`   Seed account reference: ${SEED_REFERENCE_OUTPUT}`);
  } finally {
    await authPrisma.$disconnect();
    await driverPrisma.$disconnect();
  }
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
        where: { email: d.email },
        update: {
          phone: d.phone,
          role: 'DRIVER',
          status: 'ACTIVE',
          firstName: d.firstName,
          lastName: d.lastName,
          passwordHash: SEED_PASSWORD_HASH,
        },
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
    const seededLocations: SeededDriverLocation[] = [];

    for (let i = 0; i < driverUserIds.length; i++) {
      const d = DRIVERS[i];
      const location = seededDriverLocation(i);
      const seedPendingApproval = i >= driverUserIds.length - 3;
      const availabilityStatus = seedPendingApproval ? 'OFFLINE' : (i % 9 === 0 ? 'OFFLINE' : 'ONLINE');
      const status = seedPendingApproval ? 'PENDING' : 'APPROVED';
      const ratingAverage = seedPendingApproval ? 0 : 4.3 + (i % 7) * 0.08;
      const ratingCount = seedPendingApproval ? 0 : 25 + i * 3;

      const driver = await prisma.driver.upsert({
        where: { userId: driverUserIds[i] },
        update: {
          status,
          availabilityStatus,
          vehicleType: d.vehicle.type,
          vehicleBrand: d.vehicle.brand,
          vehicleModel: d.vehicle.model,
          vehiclePlate: d.vehicle.plate,
          vehicleColor: d.vehicle.color,
          vehicleYear: d.vehicle.year,
          vehicleImageUrl: resolveVehicleImagePath(d.vehicle),
          licenseClass: d.license.class || getLicenseClassByVehicleType(d.vehicle.type),
          licenseNumber: d.license.number,
          licenseExpiryDate: d.license.expiryDate,
          licenseVerified: !seedPendingApproval,
          ratingAverage,
          ratingCount,
          lastLocationLat: location.lat,
          lastLocationLng: location.lng,
          lastLocationTime: new Date(),
        },
        create: {
          userId: driverUserIds[i],
          status,
          availabilityStatus,
          vehicleType: d.vehicle.type,
          vehicleBrand: d.vehicle.brand,
          vehicleModel: d.vehicle.model,
          vehiclePlate: d.vehicle.plate,
          vehicleColor: d.vehicle.color,
          vehicleYear: d.vehicle.year,
          vehicleImageUrl: resolveVehicleImagePath(d.vehicle),
          licenseClass: d.license.class || getLicenseClassByVehicleType(d.vehicle.type),
          licenseNumber: d.license.number,
          licenseExpiryDate: d.license.expiryDate,
          licenseVerified: !seedPendingApproval,
          ratingAverage,
          ratingCount,
          lastLocationLat: location.lat,
          lastLocationLng: location.lng,
          lastLocationTime: new Date(),
        },
      });
      driverIds.push(driver.id);
      seededLocations.push({
        driverId: driver.id,
        lat: location.lat,
        lng: location.lng,
        isOnline: availabilityStatus === 'ONLINE',
      });
      console.log(`    Driver: ${d.vehicle.plate} (${driver.id})`);
    }

    await seedDriverGeoIndex(seededLocations);

    await prisma.$disconnect();
    return { driverIds, seededLocations };
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

    const notifRecords: any[] = [];
    // Welcome emails for first 10 customers
    for (let i = 0; i < Math.min(10, customerIds.length); i++) {
      notifRecords.push({
        userId: customerIds[i],
        type: 'EMAIL',
        recipient: `customer${i + 1}@example.com`,
        subject: 'Chào mừng đến với Cab Booking',
        message: `Xin chào! Tài khoản của bạn đã được tạo thành công. Chúc bạn có những chuyến đi tuyệt vời.`,
        status: 'SENT',
        priority: 'MEDIUM',
        retryCount: 0,
        sentAt: new Date(Date.now() - (10 - i) * 3600_000),
      });
    }
    // Booking confirmation SMS for each booking
    for (let i = 0; i < Math.min(bookingIds.length, customerIds.length); i++) {
      notifRecords.push({
        userId: customerIds[i % customerIds.length],
        type: 'SMS',
        recipient: `+849012345${61 + (i % 20)}`,
        message: `Đặt xe thành công! Tài xế đang trên đường đến đón bạn.`,
        status: 'SENT',
        priority: 'HIGH',
        retryCount: 0,
        sentAt: new Date(Date.now() - (bookingIds.length - i) * 1800_000),
      });
    }
    // Ride completed push notifications for completed rides
    const completedRideIds = rides.filter(r => r.status === 'COMPLETED').map(r => r.id);
    for (let i = 0; i < completedRideIds.length; i++) {
      notifRecords.push({
        userId: customerIds[i % customerIds.length],
        type: 'PUSH',
        recipient: customerIds[i % customerIds.length],
        subject: 'Chuyến đi hoàn thành',
        message: `Chuyến đi của bạn đã hoàn thành. Cảm ơn bạn đã sử dụng dịch vụ!`,
        status: 'SENT',
        priority: 'MEDIUM',
        retryCount: 0,
        sentAt: new Date(Date.now() - (completedRideIds.length - i + 1) * 900_000),
      });
    }
    // Promo notification
    notifRecords.push({
      userId: customerIds[0],
      type: 'EMAIL',
      recipient: 'customer1@example.com',
      subject: 'Ưu đãi đặc biệt cho bạn',
      message: 'Nhân dịp cuối tuần, giảm 20% cho tất cả chuyến đi từ 11:00 - 14:00. Sử dụng mã WEEKEND20.',
      status: 'SENT',
      priority: 'LOW',
      retryCount: 0,
      sentAt: new Date(Date.now() - 2 * 3600_000),
    });
    // Failed payment notification
    notifRecords.push({
      userId: customerIds[2],
      type: 'PUSH',
      recipient: customerIds[2],
      subject: 'Thanh toán thất bại',
      message: 'Thanh toán cho chuyến đi của bạn thất bại. Vui lòng kiểm tra lại thông tin thanh toán.',
      status: 'SENT',
      priority: 'HIGH',
      retryCount: 1,
      sentAt: new Date(Date.now() - 1800_000),
    });
    await Notification.create(notifRecords);
    console.log(`    ${notifRecords.length} notifications created`);
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

    const reviewRecords: any[] = [];
    const customerNames = [
      'Nguyễn Văn A','Trần Thị B','Lê Văn C','Phạm Thị D','Hoàng Văn E',
      'Ngô Thị F','Đặng Văn G','Bùi Thị H','Vũ Văn I','Đỗ Thị J',
      'Lý Văn K','Đỗ Thị L','Trịnh Văn M','Hà Thị N','Cao Văn O',
      'Dương Thị P','Mai Văn Q','Trương Thị R','Lâm Văn S','Huỳnh Thị T',
    ];
    const driverNames = [
      'Pham Van D1','Nguyen Van E1','Tran Thi F1','Le Van G1','Hoang Thi H1',
      'Ngo Van I1','Dang Van J1','Bui Thi K1','Vu Van L1','Do Van M1',
    ];
    const positiveComments = [
      'Tài xế rất chuyên nghiệp, phong cách phục vụ tốt!',
      'Xe sạch sẽ, tài xế lái cẩn thận. Rất hài lòng!',
      'Đúng giờ, thái độ thân thiện. Sẽ đặt lại lần sau.',
      'Chuyến đi tuyệt vời, không gian xe thoải mái.',
      'Tài xế biết đường, không đi vòng. Giá hợp lý.',
    ];
    const neutralComments = [
      'Chuyến đi bình thường, không có gì đặc biệt.',
      'Tài xế tạm ổn, xe cũ một chút nhưng an toàn.',
      'Đúng giờ, đi đúng đường. Ổn.',
    ];
    for (let i = 0; i < completedRideIds.length && i < 15; i++) {
      const custIdx = i % customerIds.length;
      const drvIdx = i % driverIds.length;
      const rating = i % 5 === 0 ? 4 : i % 7 === 0 ? 3 : 5;
      const comment = rating >= 5 ? positiveComments[i % positiveComments.length] : neutralComments[i % neutralComments.length];
      const tags = rating >= 5
        ? ['professional', 'safe_driving', 'clean_car'].slice(0, (i % 3) + 1)
        : ['on_time'];
      // Customer → Driver review
      reviewRecords.push({
        rideId: completedRideIds[i],
        bookingId: bookingIds[i % bookingIds.length],
        type: 'CUSTOMER_TO_DRIVER',
        reviewerId: customerIds[custIdx],
        reviewerName: customerNames[custIdx] || `Customer ${custIdx + 1}`,
        revieweeId: driverIds[drvIdx],
        revieweeName: driverNames[drvIdx] || `Driver ${drvIdx + 1}`,
        rating,
        comment,
        tags,
      });
      // Driver → Customer review (for every other ride)
      if (i % 2 === 0) {
        reviewRecords.push({
          rideId: completedRideIds[i],
          bookingId: bookingIds[i % bookingIds.length],
          type: 'DRIVER_TO_CUSTOMER',
          reviewerId: driverIds[drvIdx],
          reviewerName: driverNames[drvIdx] || `Driver ${drvIdx + 1}`,
          revieweeId: customerIds[custIdx],
          revieweeName: customerNames[custIdx] || `Customer ${custIdx + 1}`,
          rating: rating >= 5 ? 5 : 4,
          comment: 'Khách hàng lịch sự, đúng giờ.',
          tags: ['friendly', 'punctual'],
        });
      }
    }
    await Review.create(reviewRecords);
    console.log(`    ${reviewRecords.length} reviews created`);
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
    const { driverIds } = await seedDriverDB(driverUserIds);

    // 4. Seed bookings
    const bookingIds = await seedBookingDB(customerIds);

    // 5. Seed rides + payment lifecycle data
    const rides = await seedRideDB(customerIds, driverIds);
    await seedPaymentDB(rides, customerIds, driverIds);
    await syncDriverRideAssignments(driverIds, rides);

    // 6. Seed MongoDB (notifications + reviews)
    await seedMongoDB(rides, bookingIds, customerIds, driverIds);
    await generateSeedReferenceReport(adminId, customerIds, driverUserIds, driverIds);

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
  console.log('   Drivers:   0911234561 – 0911234570, plus 30 seeded phones (prefix 0919xxxxxx)');
  console.log(`   Seed report: ${SEED_REFERENCE_OUTPUT}`);
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

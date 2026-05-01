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

// ─── Pricing formula (mirrors services/pricing-service/src/config/index.ts) ──
// baseFare + vehicleServiceFee + distance×perKmRate + minutes×perMinuteRate + shortTripFee
// shortTripFee applies when distance < 2.5 km (only for SCOOTER and CAR variants)
const PRICING = {
  MOTORBIKE: { base: 10_000, svc: 0,      perKm: 6_200,  perMin: 450,   stFee: 0 },
  SCOOTER:   { base: 14_000, svc: 1_500,  perKm: 8_400,  perMin: 700,   stFee: 1_500 },
  CAR_4:     { base: 24_000, svc: 6_000,  perKm: 15_000, perMin: 1_900, stFee: 6_000 },
  CAR_7:     { base: 32_000, svc: 10_000, perKm: 18_500, perMin: 2_400, stFee: 9_000 },
} as const;
const SHORT_TRIP_THRESHOLD_KM = 2.5;
const MINIMUM_FARE = 15_000;

function calcFare(
  vehicleType: keyof typeof PRICING,
  distanceKm: number,
  durationSeconds: number,
  surgeMultiplier = 1.0,
): number {
  const cfg = PRICING[vehicleType];
  const mins = durationSeconds / 60;
  const isShort = distanceKm < SHORT_TRIP_THRESHOLD_KM;
  const subtotal =
    cfg.base + cfg.svc +
    distanceKm * cfg.perKm +
    mins * cfg.perMin +
    (isShort ? cfg.stFee : 0);
  // Round to nearest 1 000 VND, then apply minimum fare
  return Math.max(Math.round((subtotal * surgeMultiplier) / 1_000) * 1_000, MINIMUM_FARE);
}

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

// Biển số format: ô tô (1 chữ cái) XX A-NNN.NN, xe máy/ga (2 chữ cái) XX AB-NNN.NN
// Số GPLX: đúng 12 chữ số
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
      plate: '51A-123.45',
      color: 'White',
      year: 2022,
    },
    license: {
      class: 'B',
      number: '100000000001',
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
      plate: '51A-678.90',
      color: 'Black',
      year: 2023,
    },
    license: {
      class: 'B',
      number: '100000000002',
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
      plate: '51A-111.11',
      color: 'Silver',
      year: 2023,
    },
    license: {
      class: 'D2',
      number: '100000000003',
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
      plate: '59XA-246.80',   // SCOOTER: 2-letter prefix
      color: 'Red',
      year: 2024,
    },
    license: {
      class: 'A1',
      number: '100000000004',
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
      plate: '51B-111.11',
      color: 'Gray',
      year: 2022,
    },
    license: {
      class: 'D2',
      number: '100000000005',
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
      plate: '51B-222.22',
      color: 'Blue',
      year: 2023,
    },
    license: {
      class: 'D2',
      number: '100000000006',
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
      plate: '59BA-333.33',   // MOTORBIKE: 2-letter prefix
      color: 'Blue',
      year: 2023,
    },
    license: {
      class: 'A1',
      number: '100000000007',
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
      plate: '51B-444.44',
      color: 'White',
      year: 2024,
    },
    license: {
      class: 'B',
      number: '100000000008',
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
      plate: '51B-555.55',
      color: 'Black',
      year: 2023,
    },
    license: {
      class: 'D2',
      number: '100000000009',
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
      plate: '51B-666.66',
      color: 'Silver',
      year: 2022,
    },
    license: {
      class: 'D2',
      number: '100000000010',
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

  // Biển số: ô tô/7 chỗ dùng 1 chữ cái (59Z-NNN.NN), xe máy/ga dùng 2 chữ cái (59ZA-NNN.NN)
  const isTwoWheeler = vehicleType === 'MOTORBIKE' || vehicleType === 'SCOOTER';
  const platePrefix = isTwoWheeler ? '59ZA' : '59Z';
  const serialDigits = String(10000 + serial).slice(-5); // 5 digits: 10011..10040
  const plateNumber = `${serialDigits.slice(0, 3)}.${serialDigits.slice(3)}`; // NNN.NN
  const plate = `${platePrefix}-${plateNumber}`;

  // Số GPLX: 12 chữ số, bắt đầu từ 200000000011
  const licenseNumber = String(200000000000 + serial);

  DRIVERS.push({
    email,
    phone,
    firstName: `Seed${serial}`,
    lastName: 'Driver',
    vehicle: {
      type: vehicleType,
      brand: selectedVehicle.brand,
      model: selectedVehicle.model,
      plate,
      color: EXTRA_VEHICLE_COLORS[i % EXTRA_VEHICLE_COLORS.length],
      year: 2021 + (i % 4),
    },
    license: {
      class: getLicenseClassByVehicleType(vehicleType),
      number: licenseNumber,
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

const FOCUSED_TEST_GROUPS = [
  {
    label: 'Bến Thành',
    hubName: 'Cụm Bến Thành - Quận 1',
    vehicleType: 'CAR_4',
    customers: [
      { index: 0, address: 'Cửa Nam Chợ Bến Thành, Q1, TP.HCM', lat: 10.77255, lng: 106.69815 },
      { index: 1, address: 'Ga Metro Bến Thành, Q1, TP.HCM', lat: 10.77305, lng: 106.69775 },
      { index: 2, address: 'Công viên 23/9 - Bến Thành, Q1, TP.HCM', lat: 10.77095, lng: 106.69710 },
    ],
    drivers: [
      { index: 0, lat: 10.77295, lng: 106.69905, ratingAverage: 1, ratingCount: 12 },
      { index: 1, lat: 10.77195, lng: 106.69855, ratingAverage: 2, ratingCount: 15 },
      { index: 7, lat: 10.77215, lng: 106.69675, ratingAverage: 3, ratingCount: 18 },
    ],
  },
  {
    label: 'Tân Sơn Nhất',
    hubName: 'Cụm Tân Sơn Nhất - Tân Bình',
    vehicleType: 'CAR_4',
    customers: [
      { index: 3, address: 'Ga Quốc Nội - Sân bay Tân Sơn Nhất, TP.HCM', lat: 10.81895, lng: 106.65840 },
      { index: 4, address: 'Ga Quốc Tế - Sân bay Tân Sơn Nhất, TP.HCM', lat: 10.81785, lng: 106.66455 },
      { index: 5, address: 'Đường Trường Sơn - cổng sân bay Tân Sơn Nhất, TP.HCM', lat: 10.81265, lng: 106.66410 },
    ],
    drivers: [
      { index: 10, lat: 10.81925, lng: 106.65795, ratingAverage: 1, ratingCount: 12 },
      { index: 14, lat: 10.81745, lng: 106.66085, ratingAverage: 2, ratingCount: 15 },
      { index: 18, lat: 10.81325, lng: 106.66295, ratingAverage: 3, ratingCount: 18 },
    ],
  },
] as const;

const FOCUSED_DRIVER_OVERRIDES = new Map<number, {
  label: string;
  hubName: string;
  vehicleType: string;
  lat: number;
  lng: number;
  ratingAverage: number;
  ratingCount: number;
}>();

const FOCUSED_CUSTOMER_REFERENCES = new Map<number, {
  label: string;
  hubName: string;
  address: string;
  lat: number;
  lng: number;
}>();

const FOCUSED_REVIEW_RATINGS: number[] = [];

for (const group of FOCUSED_TEST_GROUPS) {
  for (const customer of group.customers) {
    FOCUSED_CUSTOMER_REFERENCES.set(customer.index, {
      label: group.label,
      hubName: group.hubName,
      address: customer.address,
      lat: customer.lat,
      lng: customer.lng,
    });
  }

  for (const driver of group.drivers) {
    FOCUSED_DRIVER_OVERRIDES.set(driver.index, {
      label: group.label,
      hubName: group.hubName,
      vehicleType: group.vehicleType,
      lat: driver.lat,
      lng: driver.lng,
      ratingAverage: driver.ratingAverage,
      ratingCount: driver.ratingCount,
    });
    FOCUSED_REVIEW_RATINGS.push(driver.ratingAverage);
  }
}

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
    estimatedDistance: 3.5, estimatedDuration: 900,
    estimatedFare: calcFare('CAR_4', 3.5, 900),           // ~111 000
  },
  {
    pickupAddress: 'Ben Thanh Market, Q1, TP.HCM',
    pickupLat: 10.7726, pickupLng: 106.698,
    dropoffAddress: 'Tan Son Nhat Airport, TP.HCM',
    dropoffLat: 10.8185, dropoffLng: 106.6588,
    vehicleType: 'CAR_4', paymentMethod: 'CARD',
    estimatedDistance: 8.2, estimatedDuration: 1800,
    estimatedFare: calcFare('CAR_4', 8.2, 1800),          // ~210 000
  },
  {
    pickupAddress: 'Phu My Hung, Q7, TP.HCM',
    pickupLat: 10.7294, pickupLng: 106.7187,
    dropoffAddress: 'Thu Thiem, TP.HCM',
    dropoffLat: 10.7875, dropoffLng: 106.7342,
    vehicleType: 'CAR_7', paymentMethod: 'WALLET',
    estimatedDistance: 12.5, estimatedDuration: 2400,
    estimatedFare: calcFare('CAR_7', 12.5, 2400),         // ~369 000
  },
  {
    pickupAddress: 'Landmark 81, Binh Thanh, TP.HCM',
    pickupLat: 10.7949, pickupLng: 106.7219,
    dropoffAddress: 'Crescent Mall, Q7, TP.HCM',
    dropoffLat: 10.7299, dropoffLng: 106.7212,
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    estimatedDistance: 10.7, estimatedDuration: 2100,
    estimatedFare: calcFare('CAR_4', 10.7, 2100),         // ~257 000
  },
  {
    pickupAddress: 'Vinhomes Grand Park, Thu Duc, TP.HCM',
    pickupLat: 10.8434, pickupLng: 106.8287,
    dropoffAddress: 'Ben Xe Mien Dong Moi, Thu Duc, TP.HCM',
    dropoffLat: 10.8412, dropoffLng: 106.8098,
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    estimatedDistance: 6.4, estimatedDuration: 960,
    estimatedFare: calcFare('CAR_4', 6.4, 960),           // ~156 000
  },
  {
    pickupAddress: 'Aeon Mall Tan Phu, TP.HCM',
    pickupLat: 10.8018, pickupLng: 106.6187,
    dropoffAddress: 'University of Economics HCMC, Q10, TP.HCM',
    dropoffLat: 10.7623, dropoffLng: 106.6825,
    vehicleType: 'CAR_7', paymentMethod: 'WALLET',
    estimatedDistance: 14.2, estimatedDuration: 2280,
    estimatedFare: calcFare('CAR_7', 14.2, 2280),         // ~396 000
  },
  {
    pickupAddress: 'Bệnh viện Chợ Rẫy, Q5, TP.HCM',
    pickupLat: 10.7555, pickupLng: 106.6721,
    dropoffAddress: 'Bệnh viện Đại học Y Dược, Q5, TP.HCM',
    dropoffLat: 10.7614, dropoffLng: 106.6779,
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    estimatedDistance: 1.8, estimatedDuration: 420,
    estimatedFare: calcFare('MOTORBIKE', 1.8, 420),       // ~24 000
  },
  {
    pickupAddress: 'Đại học Bách Khoa TPHCM, Q10',
    pickupLat: 10.7721, pickupLng: 106.6589,
    dropoffAddress: 'Hồ Con Rùa, Q3, TP.HCM',
    dropoffLat: 10.7793, dropoffLng: 106.6957,
    vehicleType: 'SCOOTER', paymentMethod: 'CARD',
    estimatedDistance: 2.4, estimatedDuration: 600,
    estimatedFare: calcFare('SCOOTER', 2.4, 600),         // ~44 000 (short trip)
  },
  {
    pickupAddress: 'Sân vận động Thống Nhất, Q10',
    pickupLat: 10.7817, pickupLng: 106.6834,
    dropoffAddress: 'Dinh Độc Lập, Q1, TP.HCM',
    dropoffLat: 10.7793, dropoffLng: 106.6957,
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    estimatedDistance: 2.9, estimatedDuration: 720,
    estimatedFare: calcFare('CAR_4', 2.9, 720),           // ~96 000
  },
  {
    pickupAddress: 'Lotte Mart Gò Vấp, TP.HCM',
    pickupLat: 10.8312, pickupLng: 106.6837,
    dropoffAddress: 'Công viên Hoàng Văn Thụ, Tân Bình',
    dropoffLat: 10.8013, dropoffLng: 106.6571,
    vehicleType: 'CAR_7', paymentMethod: 'WALLET',
    estimatedDistance: 5.8, estimatedDuration: 1200,
    estimatedFare: calcFare('CAR_7', 5.8, 1200),          // ~197 000
  },
];

const RIDE_SEEDS = [
  // ---- COMPLETED rides ----
  // [AI coverage] off-peak short trip, cash, CAR_4
  {
    customerIndex: 0, driverIndex: 0, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: '227 Nguyen Van Cu, Q5, TP.HCM', pickupLat: 10.7628, pickupLng: 106.6825,
    dropoffAddress: 'Saigon Centre, Le Loi, Q1, TP.HCM', dropoffLat: 10.7721, dropoffLng: 106.7002,
    distance: 3.5, duration: 900,
    fare: calcFare('CAR_4', 3.5, 900),                    // 111 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // [AI coverage] rush-hour medium trip, MOMO, CAR_4
  {
    customerIndex: 1, driverIndex: 1, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Ben Thanh Market, Q1, TP.HCM', pickupLat: 10.7726, pickupLng: 106.698,
    dropoffAddress: 'Tan Son Nhat Airport, TP.HCM', dropoffLat: 10.8185, dropoffLng: 106.6588,
    distance: 8.2, duration: 1800,
    fare: calcFare('CAR_4', 8.2, 1800),                   // 210 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  // [AI coverage] rush-hour long trip, VNPAY, CAR_7
  {
    customerIndex: 2, driverIndex: 2, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'Phu My Hung, Q7, TP.HCM', pickupLat: 10.7294, pickupLng: 106.7187,
    dropoffAddress: 'Thu Thiem, TP.HCM', dropoffLat: 10.7875, dropoffLng: 106.7342,
    distance: 12.5, duration: 2400,
    fare: calcFare('CAR_7', 12.5, 2400),                  // 369 000
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  // [AI coverage] off-peak very short trip, cash, MOTORBIKE
  {
    customerIndex: 3, driverIndex: 3, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Chợ Bến Thành, Q1, TP.HCM', pickupLat: 10.7726, pickupLng: 106.6981,
    dropoffAddress: 'Nhà thờ Đức Bà, Q1, TP.HCM', dropoffLat: 10.7798, dropoffLng: 106.699,
    distance: 1.2, duration: 360,
    fare: calcFare('MOTORBIKE', 1.2, 360),                // 20 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // [AI coverage] off-peak medium trip, MOMO, SCOOTER
  {
    customerIndex: 4, driverIndex: 4, status: 'COMPLETED', vehicleType: 'SCOOTER', paymentMethod: 'MOMO',
    pickupAddress: 'Đại học Bách Khoa TPHCM, Q10', pickupLat: 10.7721, pickupLng: 106.6589,
    dropoffAddress: 'Công viên 23/9, Q1, TP.HCM', dropoffLat: 10.7707, dropoffLng: 106.6972,
    distance: 3.8, duration: 780,
    fare: calcFare('SCOOTER', 3.8, 780),                  // 57 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  // [AI coverage] rush-hour long trip, cash, CAR_4
  {
    customerIndex: 5, driverIndex: 5, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Landmark 81, Binh Thanh, TP.HCM', pickupLat: 10.7949, pickupLng: 106.7219,
    dropoffAddress: 'Crescent Mall, Q7, TP.HCM', dropoffLat: 10.7299, dropoffLng: 106.7212,
    distance: 10.7, duration: 2100,
    fare: calcFare('CAR_4', 10.7, 2100),                  // 257 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // [AI coverage] off-peak medium trip, VNPAY, CAR_4
  {
    customerIndex: 6, driverIndex: 6, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'VNPAY',
    pickupAddress: 'Lotte Mart Gò Vấp, TP.HCM', pickupLat: 10.8312, pickupLng: 106.6837,
    dropoffAddress: 'Bệnh viện Gia Định, Bình Thạnh', dropoffLat: 10.8156, dropoffLng: 106.7021,
    distance: 5.8, duration: 1080,
    fare: calcFare('CAR_4', 5.8, 1080),                   // 151 000
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  // [AI coverage] off-peak very short trip, cash, MOTORBIKE
  {
    customerIndex: 7, driverIndex: 7, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Ga Sài Gòn, Q3, TP.HCM', pickupLat: 10.7814, pickupLng: 106.6819,
    dropoffAddress: 'Hồ Con Rùa, Q3, TP.HCM', dropoffLat: 10.7793, dropoffLng: 106.6957,
    distance: 1.5, duration: 480,
    fare: calcFare('MOTORBIKE', 1.5, 480),                // 23 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // [AI coverage] off-peak medium trip, MOMO, CAR_7
  {
    customerIndex: 8, driverIndex: 8, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'MOMO',
    pickupAddress: 'Vinhomes Grand Park, Thu Duc, TP.HCM', pickupLat: 10.8434, pickupLng: 106.8287,
    dropoffAddress: 'Ben Xe Mien Dong Moi, Thu Duc', dropoffLat: 10.8412, dropoffLng: 106.8098,
    distance: 6.4, duration: 960,
    fare: calcFare('CAR_7', 6.4, 960),                    // 199 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  // [AI coverage] rush-hour very long trip, cash, CAR_4
  {
    customerIndex: 9, driverIndex: 9, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Aeon Mall Tan Phu, TP.HCM', pickupLat: 10.8018, pickupLng: 106.6187,
    dropoffAddress: 'Trường ĐH Kinh Tế TP.HCM, Q10', dropoffLat: 10.7623, dropoffLng: 106.6825,
    distance: 14.2, duration: 2280,
    fare: calcFare('CAR_4', 14.2, 2280),                  // 315 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // [AI coverage] off-peak short trip (<2.5km), VNPAY, SCOOTER
  {
    customerIndex: 10, driverIndex: 0, status: 'COMPLETED', vehicleType: 'SCOOTER', paymentMethod: 'VNPAY',
    pickupAddress: 'RMIT Sài Gòn, Q7, TP.HCM', pickupLat: 10.7316, pickupLng: 106.7222,
    dropoffAddress: 'Phú Mỹ Hưng, Q7, TP.HCM', dropoffLat: 10.7294, dropoffLng: 106.7187,
    distance: 2.1, duration: 540,
    fare: calcFare('SCOOTER', 2.1, 540),                  // 41 000 (short trip)
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  // [AI coverage] off-peak ultra-short trip (<2.5km), MOMO, CAR_4
  {
    customerIndex: 11, driverIndex: 1, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Dinh Độc Lập, Q1, TP.HCM', pickupLat: 10.7793, pickupLng: 106.6957,
    dropoffAddress: 'Bảo tàng Chiến tranh, Q3, TP.HCM', dropoffLat: 10.7785, dropoffLng: 106.6896,
    distance: 0.9, duration: 300,
    fare: calcFare('CAR_4', 0.9, 300),                    // 59 000 (short trip)
    paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  // [AI coverage] off-peak medium trip, cash, MOTORBIKE
  {
    customerIndex: 12, driverIndex: 2, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Sân vận động Thống Nhất, Q10', pickupLat: 10.7817, pickupLng: 106.6834,
    dropoffAddress: 'Bệnh viện Chợ Rẫy, Q5, TP.HCM', dropoffLat: 10.7555, dropoffLng: 106.6721,
    distance: 4.1, duration: 840,
    fare: calcFare('MOTORBIKE', 4.1, 840),                // 42 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // [AI coverage] rush-hour medium trip, VNPAY, CAR_7
  {
    customerIndex: 13, driverIndex: 3, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'Bến cảng Nhà Rồng, Q4, TP.HCM', pickupLat: 10.7647, pickupLng: 106.7046,
    dropoffAddress: 'Khu đô thị Sala, TP.Thủ Đức', dropoffLat: 10.7857, dropoffLng: 106.7466,
    distance: 7.3, duration: 1380,
    fare: calcFare('CAR_7', 7.3, 1380),                   // 232 000
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  // [AI coverage] off-peak short trip, cash, CAR_4
  {
    customerIndex: 14, driverIndex: 4, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Chợ Tân Bình, TP.HCM', pickupLat: 10.7967, pickupLng: 106.6516,
    dropoffAddress: 'Sân bay Tân Sơn Nhất, TP.HCM', dropoffLat: 10.8185, dropoffLng: 106.6588,
    distance: 3.2, duration: 720,
    fare: calcFare('CAR_4', 3.2, 720),                    // 101 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  // ---- CANCELLED rides ----
  {
    customerIndex: 15, driverIndex: 5, status: 'CANCELLED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Nhà hàng Phở Hòa, Q10, TP.HCM', pickupLat: 10.7762, pickupLng: 106.6751,
    dropoffAddress: 'Chợ Bình Thới, Q11, TP.HCM', dropoffLat: 10.7688, dropoffLng: 106.6573,
    distance: 2.8, duration: 660,
    fare: calcFare('CAR_4', 2.8, 660),                    // 93 000
    paymentStatus: 'FAILED', paymentProvider: 'MOMO', paymentCompleted: false,
  },
  {
    customerIndex: 16, driverIndex: undefined, status: 'CANCELLED', vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickupAddress: 'Trường THPT Lê Hồng Phong, Q5', pickupLat: 10.7519, pickupLng: 106.6742,
    dropoffAddress: 'Công viên Lê Văn Tám, Q1', dropoffLat: 10.7838, dropoffLng: 106.7013,
    distance: 4.7, duration: 900,
    fare: calcFare('MOTORBIKE', 4.7, 900),                // 46 000
    paymentStatus: 'FAILED', paymentProvider: 'MOCK', paymentCompleted: false,
  },
  // ---- ASSIGNED (driver matched, not picked up yet) ----
  {
    customerIndex: 17, driverIndex: 6, status: 'ASSIGNED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Vinhomes Central Park, Bình Thạnh', pickupLat: 10.7941, pickupLng: 106.7207,
    dropoffAddress: 'Bạch Đằng Wharf, Q1, TP.HCM', dropoffLat: 10.7768, dropoffLng: 106.7067,
    distance: 5.1, duration: 840,
    fare: calcFare('CAR_4', 5.1, 840),                    // 133 000
    paymentStatus: 'PENDING', paymentProvider: 'MOCK', paymentCompleted: false,
  },
  // ---- PICKING_UP (driver on the way to customer) ----
  {
    customerIndex: 18, driverIndex: 7, status: 'PICKING_UP', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'BigC An Lạc, Bình Tân, TP.HCM', pickupLat: 10.7521, pickupLng: 106.6092,
    dropoffAddress: 'Đầm Sen, Q11, TP.HCM', dropoffLat: 10.7666, dropoffLng: 106.6382,
    distance: 5.4, duration: 1020,
    fare: calcFare('CAR_7', 5.4, 1020),                   // 183 000
    paymentStatus: 'PENDING', paymentProvider: 'VNPAY', paymentCompleted: false,
  },
  // ---- IN_PROGRESS (ride currently happening) ----
  {
    customerIndex: 19, driverIndex: 8, status: 'IN_PROGRESS', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Landmark 81, Bình Thạnh, TP.HCM', pickupLat: 10.7949, pickupLng: 106.7219,
    dropoffAddress: 'Crescent Mall, Q7, TP.HCM', dropoffLat: 10.7299, dropoffLng: 106.7212,
    distance: 10.7, duration: 2100,
    fare: calcFare('CAR_4', 10.7, 2100),                  // 257 000
    paymentStatus: 'PROCESSING', paymentProvider: 'MOMO', paymentCompleted: false,
  },
  // ---- FINDING_DRIVER (surge 1.2 — rush-hour demand spike) ----
  {
    customerIndex: 0, driverIndex: undefined, status: 'FINDING_DRIVER', vehicleType: 'CAR_7', paymentMethod: 'MOMO',
    pickupAddress: 'Aeon Mall Tân Phú, TP.HCM', pickupLat: 10.8018, pickupLng: 106.6187,
    dropoffAddress: 'Trường ĐH Kinh Tế TP.HCM, Q10', dropoffLat: 10.7623, dropoffLng: 106.6825,
    distance: 14.2, duration: 2280,
    fare: calcFare('CAR_7', 14.2, 2280, 1.2),             // 475 000 (surge 1.2)
    paymentStatus: 'REQUIRES_ACTION', paymentProvider: 'MOMO', paymentCompleted: false,
  },
  // ---- More COMPLETED (varied distances, all vehicle types) ----
  {
    customerIndex: 1, driverIndex: 9, status: 'COMPLETED', vehicleType: 'SCOOTER', paymentMethod: 'CASH',
    pickupAddress: 'Trường ĐH Sư Phạm TPHCM, Q5', pickupLat: 10.7627, pickupLng: 106.6844,
    dropoffAddress: 'Siêu thị Co.opmart Đinh Tiên Hoàng, Bình Thạnh', dropoffLat: 10.8024, dropoffLng: 106.7113,
    distance: 5.9, duration: 1140,
    fare: calcFare('SCOOTER', 5.9, 1140),                 // 78 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 2, driverIndex: 0, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'VNPAY',
    pickupAddress: 'Bệnh viện Đại học Y Dược, Q5, TP.HCM', pickupLat: 10.7614, pickupLng: 106.6779,
    dropoffAddress: 'Trung tâm thương mại Bitexco, Q1', dropoffLat: 10.7722, dropoffLng: 106.7047,
    distance: 2.7, duration: 660,
    fare: calcFare('CAR_4', 2.7, 660),                    // 91 000
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  {
    customerIndex: 3, driverIndex: 1, status: 'COMPLETED', vehicleType: 'MOTORBIKE', paymentMethod: 'MOMO',
    pickupAddress: 'Công viên Hoàng Văn Thụ, Tân Bình', pickupLat: 10.8013, pickupLng: 106.6571,
    dropoffAddress: 'Chợ Phạm Văn Hai, Tân Bình', dropoffLat: 10.7986, dropoffLng: 106.6493,
    distance: 1.0, duration: 300,
    fare: calcFare('MOTORBIKE', 1.0, 300),                // 18 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 4, driverIndex: 2, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Đại học Quốc gia TP.HCM, Thu Duc', pickupLat: 10.8701, pickupLng: 106.8037,
    dropoffAddress: 'QTSC, Quận 12, TP.HCM', dropoffLat: 10.8642, dropoffLng: 106.7978,
    distance: 2.3, duration: 480,
    fare: calcFare('CAR_4', 2.3, 480),                    // 86 000 (short trip)
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 5, driverIndex: 3, status: 'COMPLETED', vehicleType: 'CAR_7', paymentMethod: 'VNPAY',
    pickupAddress: 'Khu đô thị Sala, TP.Thủ Đức', pickupLat: 10.7857, pickupLng: 106.7466,
    dropoffAddress: 'Bảo tàng TP.HCM, Q1', dropoffLat: 10.7773, dropoffLng: 106.7008,
    distance: 8.6, duration: 1560,
    fare: calcFare('CAR_7', 8.6, 1560),                   // 264 000
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
];

const FOCUSED_COMPLETED_RIDE_SEEDS: typeof RIDE_SEEDS = [
  // Bến Thành cluster — short trips for UI distance/rating test
  {
    customerIndex: 0, driverIndex: 0, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Cửa Nam Chợ Bến Thành, Q1, TP.HCM', pickupLat: 10.77255, pickupLng: 106.69815,
    dropoffAddress: 'Dinh Độc Lập, Q1, TP.HCM', dropoffLat: 10.77930, dropoffLng: 106.69570,
    distance: 1.1, duration: 360,
    fare: calcFare('CAR_4', 1.1, 360),                    // 64 000 (short trip)
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 1, driverIndex: 1, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Ga Metro Bến Thành, Q1, TP.HCM', pickupLat: 10.77305, pickupLng: 106.69775,
    dropoffAddress: 'Saigon Centre, Q1, TP.HCM', dropoffLat: 10.77210, dropoffLng: 106.70020,
    distance: 1.4, duration: 420,
    fare: calcFare('CAR_4', 1.4, 420),                    // 70 000 (short trip)
    paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 2, driverIndex: 7, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'VNPAY',
    pickupAddress: 'Công viên 23/9 - Bến Thành, Q1, TP.HCM', pickupLat: 10.77095, pickupLng: 106.69710,
    dropoffAddress: 'Hồ Con Rùa, Q3, TP.HCM', dropoffLat: 10.77930, dropoffLng: 106.69570,
    distance: 2.0, duration: 540,
    fare: calcFare('CAR_4', 2.0, 540),                    // 83 000 (short trip)
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
  // Tân Sơn Nhất cluster
  {
    customerIndex: 3, driverIndex: 10, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickupAddress: 'Ga Quốc Nội - Sân bay Tân Sơn Nhất, TP.HCM', pickupLat: 10.81895, pickupLng: 106.65840,
    dropoffAddress: 'Công viên Hoàng Văn Thụ, Tân Bình, TP.HCM', dropoffLat: 10.80130, dropoffLng: 106.65710,
    distance: 2.3, duration: 600,
    fare: calcFare('CAR_4', 2.3, 600),                    // 90 000 (short trip)
    paymentStatus: 'COMPLETED', paymentProvider: 'MOCK', paymentCompleted: true,
  },
  {
    customerIndex: 4, driverIndex: 14, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickupAddress: 'Ga Quốc Tế - Sân bay Tân Sơn Nhất, TP.HCM', pickupLat: 10.81785, pickupLng: 106.66455,
    dropoffAddress: 'Lăng Cha Cả, Tân Bình, TP.HCM', dropoffLat: 10.80455, dropoffLng: 106.65635,
    distance: 2.8, duration: 720,
    fare: calcFare('CAR_4', 2.8, 720),                    // 95 000
    paymentStatus: 'COMPLETED', paymentProvider: 'MOMO', paymentCompleted: true,
  },
  {
    customerIndex: 5, driverIndex: 18, status: 'COMPLETED', vehicleType: 'CAR_4', paymentMethod: 'VNPAY',
    pickupAddress: 'Đường Trường Sơn - cổng sân bay Tân Sơn Nhất, TP.HCM', pickupLat: 10.81265, pickupLng: 106.66410,
    dropoffAddress: 'E.Town Cộng Hòa, Tân Bình, TP.HCM', dropoffLat: 10.80120, dropoffLng: 106.65320,
    distance: 3.1, duration: 780,
    fare: calcFare('CAR_4', 3.1, 780),                    // 101 000
    paymentStatus: 'COMPLETED', paymentProvider: 'VNPAY', paymentCompleted: true,
  },
];

RIDE_SEEDS.splice(0, FOCUSED_COMPLETED_RIDE_SEEDS.length, ...FOCUSED_COMPLETED_RIDE_SEEDS);

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
  const focusedReference = FOCUSED_CUSTOMER_REFERENCES.get(index);
  if (focusedReference) {
    return {
      address: focusedReference.address,
      lat: focusedReference.lat,
      lng: focusedReference.lng,
    };
  }

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

function getSeedRideTimeline(index: number, rideSeed: typeof RIDE_SEEDS[number]) {
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

  return {
    requestedAt,
    assignedAt,
    startedAt,
    completedAt,
    cancelledAt,
  };
}

function getSeedCommissionRate(vehicleType: string) {
  switch (vehicleType) {
    case 'CAR_7':    return 0.15;
    case 'CAR_4':    return 0.18;
    case 'SCOOTER':  return 0.18;
    default:         return 0.20; // MOTORBIKE
  }
}

function getSeedRideBonus(index: number, rideSeed: typeof RIDE_SEEDS[number]) {
  let bonus = 0;

  if (rideSeed.fare >= 100_000) {
    bonus += 6_000;
  }

  if (index % 5 === 0) {
    bonus += 4_000;
  }

  return bonus;
}

function getSeedRidePenalty(index: number) {
  return index % 7 === 0 ? 2_000 : 0;
}

function getSeedDriverEarnings(index: number, rideSeed: typeof RIDE_SEEDS[number]) {
  const grossFare = rideSeed.fare;
  const commissionRate = getSeedCommissionRate(rideSeed.vehicleType);
  const platformFee = Math.round(grossFare * commissionRate);
  const bonus = getSeedRideBonus(index, rideSeed);
  const penalty = getSeedRidePenalty(index);
  const netEarnings = Math.max(0, grossFare - platformFee + bonus - penalty);
  const driverCollected = rideSeed.paymentMethod === 'CASH';
  const cashDebt = driverCollected ? Math.max(0, platformFee - bonus + penalty) : 0;

  return {
    grossFare,
    commissionRate,
    platformFee,
    bonus,
    penalty,
    netEarnings,
    driverCollected,
    cashDebt,
  };
}

function isSeedPeakHour(date: Date) {
  const vnHour = (date.getUTCHours() + 7) % 24;
  return (vnHour >= 6 && vnHour < 9) || (vnHour >= 16 && vnHour < 19);
}

function getVietnamCalendarDate(date: Date) {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ));
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
      const focusedDriver = FOCUSED_DRIVER_OVERRIDES.get(index);

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
        ratingAverage: Number(driver.ratingAverage || 0),
        ratingCount: Number(driver.ratingCount || 0),
        lat: Number(driver.lastLocationLat),
        lng: Number(driver.lastLocationLng),
        nearestHubName: nearestHub.name,
        nearestHubDistanceKm: nearestHub.distanceKm,
        focusedScenarioLabel: focusedDriver?.label || null,
      };
    });

    const customerRows = customerIds.map((customerId, index) => {
      const authUser = customerUsersById.get(customerId) as any;
      const reference = getCustomerReference(index);
      const focusedCustomer = FOCUSED_CUSTOMER_REFERENCES.get(index);

      return {
        index: index + 1,
        id: customerId,
        name: `${authUser?.firstName || CUSTOMERS[index].firstName} ${authUser?.lastName || CUSTOMERS[index].lastName}`,
        email: authUser?.email || CUSTOMERS[index].email,
        phone: authUser?.phone || CUSTOMERS[index].phone,
        address: reference.address,
        lat: reference.lat,
        lng: reference.lng,
        focusedScenarioLabel: focusedCustomer?.label || null,
      };
    });

    const driverRowsByIndex = new Map(driverRows.map((driver) => [driver.index - 1, driver]));
    const customerRowsByIndex = new Map(customerRows.map((customer) => [customer.index - 1, customer]));

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
    lines.push('## Tài khoản test trọng điểm');
    lines.push('');
    lines.push('- 6 tài xế ưu tiên đều dùng chung loại xe Ô tô 4 chỗ để test ghép chuyến và popup khoảng cách.');
    lines.push('- Bộ rating trọng điểm theo từng cụm là 1 sao, 2 sao, 3 sao.');
    lines.push('');
    for (const group of FOCUSED_TEST_GROUPS) {
      lines.push(`### ${group.label}`);
      lines.push('');
      lines.push('| Vai trò | Họ tên | Điện thoại | Email | Rating | Ghi chú |');
      lines.push('| --- | --- | --- | --- | --- | --- |');

      for (let i = 0; i < group.drivers.length; i++) {
        const driver = driverRowsByIndex.get(group.drivers[i].index);
        const customer = customerRowsByIndex.get(group.customers[i].index);

        if (driver) {
          lines.push(`| Driver ${i + 1} | ${driver.name} | ${driver.phone} | ${driver.email} | ${driver.ratingAverage.toFixed(1)} (${driver.ratingCount}) | ${driver.vehicleName} - ${driver.plate} |`);
        }

        if (customer) {
          lines.push(`| Customer ${i + 1} | ${customer.name} | ${customer.phone} | ${customer.email} | ${group.drivers[i].ratingAverage} sao | ${customer.address} |`);
        }
      }

      lines.push('');
    }

    lines.push('## Driver Accounts');
    lines.push('');
    lines.push('| # | Tài xế | Điện thoại | Trạng thái | Loại xe | Xe | Biển số | Rating | Ảnh | Vị trí hiện tại | Cụm gần nhất |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const driver of driverRows) {
      lines.push(`| ${driver.index} | ${driver.name} | ${driver.phone} | ${driver.status} / ${driver.availabilityStatus} | ${driver.vehicleLabel} | ${driver.vehicleName} | ${driver.plate} | ${driver.ratingAverage.toFixed(1)} (${driver.ratingCount}) | ${driver.imageUrl} | ${formatCoordinate(driver.lat, driver.lng)} | ${driver.nearestHubName} (${driver.nearestHubDistanceKm.toFixed(2)} km) |`);
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
      const focusedDriver = FOCUSED_DRIVER_OVERRIDES.get(i);
      const location = focusedDriver
        ? { lat: focusedDriver.lat, lng: focusedDriver.lng }
        : seededDriverLocation(i);
      const seedPendingApproval = i >= driverUserIds.length - 3;
      const availabilityStatus = seedPendingApproval ? 'OFFLINE' : (focusedDriver ? 'ONLINE' : (i % 9 === 0 ? 'OFFLINE' : 'ONLINE'));
      const status = seedPendingApproval ? 'PENDING' : 'APPROVED';
      const ratingAverage = seedPendingApproval ? 0 : (focusedDriver?.ratingAverage ?? (4.3 + (i % 7) * 0.08));
      const ratingCount = seedPendingApproval ? 0 : (focusedDriver?.ratingCount ?? (25 + i * 3));

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
      const timeline = getSeedRideTimeline(index, rideSeed);
      const acceptedAt = rideSeed.driverIndex !== undefined
        && ['ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED'].includes(rideSeed.status)
        && timeline.assignedAt
        ? new Date(timeline.assignedAt.getTime() + 2 * 60 * 1000)
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
          acceptedDriverId: ['ASSIGNED', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED'].includes(rideSeed.status)
            ? (rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null)
            : null,
          requestedAt: timeline.requestedAt,
          offeredAt: timeline.assignedAt,
          assignedAt: timeline.assignedAt,
          acceptedAt,
          startedAt: timeline.startedAt,
          completedAt: timeline.completedAt,
          cancelledAt: timeline.cancelledAt,
          cancelReason: rideSeed.status === 'CANCELLED' ? 'Khách hàng đổi kế hoạch' : null,
          cancelledBy: rideSeed.status === 'CANCELLED' ? 'CUSTOMER' : null,
        },
      });

      rides.push({ id: ride.id, status: rideSeed.status });

      const transitions = [
        {
          rideId: ride.id,
          fromStatus: null,
          toStatus: 'CREATED',
          actorId: customerIds[rideSeed.customerIndex],
          actorType: 'CUSTOMER',
          occurredAt: timeline.requestedAt,
        },
      ];

      if (rideSeed.status === 'FINDING_DRIVER') {
        transitions.push({
          rideId: ride.id,
          fromStatus: 'CREATED',
          toStatus: 'FINDING_DRIVER',
          actorId: null,
          actorType: 'SYSTEM',
          occurredAt: timeline.requestedAt,
        });
      }

      if (rideSeed.driverIndex !== undefined && timeline.assignedAt) {
        transitions.push({
          rideId: ride.id,
          fromStatus: 'CREATED',
          toStatus: 'ASSIGNED',
          actorId: driverIds[rideSeed.driverIndex],
          actorType: 'SYSTEM',
          occurredAt: timeline.assignedAt,
        });
      }

      if (acceptedAt && ['ACCEPTED', 'PICKING_UP', 'IN_PROGRESS', 'COMPLETED'].includes(rideSeed.status)) {
        transitions.push({
          rideId: ride.id,
          fromStatus: 'ASSIGNED',
          toStatus: 'ACCEPTED',
          actorId: rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null,
          actorType: 'DRIVER',
          occurredAt: acceptedAt,
        });
      }

      if (acceptedAt && ['PICKING_UP', 'IN_PROGRESS', 'COMPLETED'].includes(rideSeed.status)) {
        transitions.push({
          rideId: ride.id,
          fromStatus: 'ACCEPTED',
          toStatus: 'PICKING_UP',
          actorId: rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null,
          actorType: 'DRIVER',
          occurredAt: new Date(acceptedAt.getTime() + 4 * 60 * 1000),
        });
      }

      if (timeline.startedAt && ['IN_PROGRESS', 'COMPLETED'].includes(rideSeed.status)) {
        transitions.push({
          rideId: ride.id,
          fromStatus: 'PICKING_UP',
          toStatus: 'IN_PROGRESS',
          actorId: rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null,
          actorType: 'DRIVER',
          occurredAt: timeline.startedAt,
        });
      }

      if (timeline.completedAt && rideSeed.status === 'COMPLETED') {
        transitions.push({
          rideId: ride.id,
          fromStatus: 'IN_PROGRESS',
          toStatus: 'COMPLETED',
          actorId: rideSeed.driverIndex !== undefined ? driverIds[rideSeed.driverIndex] : null,
          actorType: 'DRIVER',
          occurredAt: timeline.completedAt,
        });
      }

      if (timeline.cancelledAt && rideSeed.status === 'CANCELLED') {
        transitions.push({
          rideId: ride.id,
          fromStatus: rideSeed.driverIndex !== undefined ? 'ASSIGNED' : 'CREATED',
          toStatus: 'CANCELLED',
          actorId: customerIds[rideSeed.customerIndex],
          actorType: 'CUSTOMER',
          occurredAt: timeline.cancelledAt,
        });
      }

      await prisma.rideStateTransition.createMany({
        data: transitions,
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

// ─── Seed wallet-service (wallet_db) ─────────────────────────────────────────
// Seeds the wallet-service database for the deposit-based wallet model,
// including driver wallets, top-up orders, merchant ledger snapshot,
// bank simulation data, incentive rules, and daily stats.
async function seedWalletDB(driverIds: string[]) {
  console.log('  Seeding wallet_db (wallet-service)...');
  const prisma = createServicePrismaClient('wallet-service', 'wallet_db');

  const ACTIVATION_BALANCE = 300_000;
  const DEMO_WITHDRAWABLE_BALANCE = 150_000;
  const DEMO_NET_EARNINGS = DEMO_WITHDRAWABLE_BALANCE;
  const DEMO_COMMISSION_RATE = 0.2;
  const DEMO_GROSS_FARE = Math.round(DEMO_NET_EARNINGS / (1 - DEMO_COMMISSION_RATE));
  const DEMO_PLATFORM_FEE = DEMO_GROSS_FARE - DEMO_NET_EARNINGS;

  const systemBankAccounts = [
    {
      id: 'MAIN_ACCOUNT',
      bankName: 'Techcombank',
      accountNumber: '8000511204',
      accountHolder: 'CONG TY TNHH CAB BOOKING SYSTEM',
      type: 'SETTLEMENT_ACCOUNT',
      description: 'Tài khoản nhận thanh toán online và nạp ví tài xế',
      isActive: true,
    },
    {
      id: 'PAYOUT_ACCOUNT',
      bankName: 'Techcombank',
      accountNumber: '8000511204',
      accountHolder: 'CONG TY TNHH CAB BOOKING SYSTEM',
      type: 'PAYOUT_ACCOUNT',
      description: 'Tài khoản chi trả khi tài xế rút tiền',
      isActive: true,
    },
  ];

  const rules = [
    { type: 'TRIP_COUNT', conditionValue: 10, rewardAmount: 50_000, isActive: true, description: 'Chạy >= 10 cuốc/ngày thưởng 50.000 đ' },
    { type: 'TRIP_COUNT', conditionValue: 20, rewardAmount: 120_000, isActive: true, description: 'Chạy >= 20 cuốc/ngày thưởng 120.000 đ' },
    { type: 'DISTANCE_KM', conditionValue: 50, rewardAmount: 30_000, isActive: true, description: 'Đạt >= 50 km/ngày thưởng 30.000 đ' },
    { type: 'PEAK_HOUR', conditionValue: 0, rewardAmount: 10_000, isActive: true, description: 'Mỗi cuốc trong giờ cao điểm thưởng 10.000 đ' },
  ];

  try {
    const upsertSeedBankTransaction = async (data: {
      fromAccount: string;
      toAccount: string;
      amount: number;
      type: string;
      referenceId: string;
      description: string;
      metadata?: Record<string, unknown>;
      createdAt: Date;
    }) => {
      const existing = await (prisma as any).bankTransaction.findFirst({
        where: {
          referenceId: data.referenceId,
          type: data.type,
        },
      });

      if (existing) {
        await (prisma as any).bankTransaction.update({
          where: { id: existing.id },
          data,
        });
        return;
      }

      await (prisma as any).bankTransaction.create({ data });
    };

    const upsertSeedIncentiveRule = async (rule: typeof rules[number]) => {
      const existingRules = await (prisma as any).incentiveRule.findMany({
        where: {
          type: rule.type,
          conditionValue: rule.conditionValue,
          rewardAmount: rule.rewardAmount,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (existingRules.length === 0) {
        await (prisma as any).incentiveRule.create({ data: rule });
        return;
      }

      await (prisma as any).incentiveRule.update({
        where: { id: existingRules[0].id },
        data: {
          isActive: rule.isActive,
          description: rule.description,
          conditionValue: rule.conditionValue,
          rewardAmount: rule.rewardAmount,
        },
      });

      if (existingRules.length > 1) {
        await (prisma as any).incentiveRule.deleteMany({
          where: {
            id: {
              in: existingRules.slice(1).map((item: any) => item.id),
            },
          },
        });
      }
    };

    for (const account of systemBankAccounts) {
      await (prisma as any).systemBankAccount.upsert({
        where: { id: account.id },
        create: account,
        update: {
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          accountHolder: account.accountHolder,
          type: account.type,
          description: account.description,
          isActive: account.isActive,
        },
      });
    }

    for (const rule of rules) {
      await upsertSeedIncentiveRule(rule);
    }

    for (const [index, driverId] of driverIds.entries()) {
      const provider = index % 2 === 0 ? 'MOMO' : 'VNPAY';
      const activationOrderId = `seed_wallet_activation_order_${driverId}`;
      const activationGatewayTxnId = `SEED_${provider}_${driverId.slice(0, 8).toUpperCase()}`;
      const activationCreatedAt = hoursAgo(120 - Math.min(index, 48));
      const activationCompletedAt = new Date(activationCreatedAt.getTime() + 5 * 60 * 1000);
      const earningReferenceId = `seed_wallet_earning_${driverId}`;
      const earningCreatedAt = hoursAgo(24 - (index % 6));
      const totalBalance = ACTIVATION_BALANCE + DEMO_WITHDRAWABLE_BALANCE;
      const statsDate = getVietnamCalendarDate(earningCreatedAt);

      await prisma.$transaction(async (tx: any) => {
        await tx.driverWallet.upsert({
          where: { driverId },
          update: {
            balance: totalBalance,
            availableBalance: totalBalance,
            lockedBalance: ACTIVATION_BALANCE,
            debt: 0,
            status: 'ACTIVE',
            initialActivationCompleted: true,
          },
          create: {
            driverId,
            balance: totalBalance,
            availableBalance: totalBalance,
            lockedBalance: ACTIVATION_BALANCE,
            debt: 0,
            status: 'ACTIVE',
            initialActivationCompleted: true,
          },
        });

        await tx.walletTopUpOrder.upsert({
          where: { orderId: activationOrderId },
          update: {
            driverId,
            amount: ACTIVATION_BALANCE,
            provider,
            status: 'COMPLETED',
            gatewayTxnId: activationGatewayTxnId,
            gatewayResponse: {
              seeded: true,
              source: 'seed-database',
              provider,
            },
            completedAt: activationCompletedAt,
            failedAt: null,
            createdAt: activationCreatedAt,
          },
          create: {
            driverId,
            amount: ACTIVATION_BALANCE,
            provider,
            status: 'COMPLETED',
            orderId: activationOrderId,
            gatewayTxnId: activationGatewayTxnId,
            gatewayResponse: {
              seeded: true,
              source: 'seed-database',
              provider,
            },
            createdAt: activationCreatedAt,
            completedAt: activationCompletedAt,
          },
        });

        await tx.walletTransaction.upsert({
          where: { idempotencyKey: `seed_wallet_activation_${driverId}` },
          update: {
            driverId,
            type: 'TOP_UP',
            direction: 'CREDIT',
            amount: ACTIVATION_BALANCE,
            balanceAfter: ACTIVATION_BALANCE,
            description: 'Nạp ký quỹ kích hoạt tài khoản tài xế',
            referenceId: activationOrderId,
            metadata: {
              seeded: true,
              source: 'seed-database',
              provider,
              activation: true,
            },
            createdAt: activationCompletedAt,
          },
          create: {
            driverId,
            type: 'TOP_UP',
            direction: 'CREDIT',
            amount: ACTIVATION_BALANCE,
            balanceAfter: ACTIVATION_BALANCE,
            description: 'Nạp ký quỹ kích hoạt tài khoản tài xế',
            referenceId: activationOrderId,
            idempotencyKey: `seed_wallet_activation_${driverId}`,
            metadata: {
              seeded: true,
              source: 'seed-database',
              provider,
              activation: true,
            },
            createdAt: activationCompletedAt,
          },
        });

        await tx.walletTransaction.upsert({
          where: { idempotencyKey: `seed_wallet_earn_${driverId}` },
          update: {
            driverId,
            type: 'EARN',
            direction: 'CREDIT',
            amount: DEMO_NET_EARNINGS,
            balanceAfter: totalBalance,
            description: 'Thu nhập cuốc xe online mẫu cho ví tài xế',
            referenceId: earningReferenceId,
            metadata: {
              seeded: true,
              source: 'seed-database',
              grossFare: DEMO_GROSS_FARE,
              platformFee: DEMO_PLATFORM_FEE,
            },
            createdAt: earningCreatedAt,
          },
          create: {
            driverId,
            type: 'EARN',
            direction: 'CREDIT',
            amount: DEMO_NET_EARNINGS,
            balanceAfter: totalBalance,
            description: 'Thu nhập cuốc xe online mẫu cho ví tài xế',
            referenceId: earningReferenceId,
            idempotencyKey: `seed_wallet_earn_${driverId}`,
            metadata: {
              seeded: true,
              source: 'seed-database',
              grossFare: DEMO_GROSS_FARE,
              platformFee: DEMO_PLATFORM_FEE,
            },
            createdAt: earningCreatedAt,
          },
        });

        await tx.merchantLedger.upsert({
          where: { idempotencyKey: `seed_wallet_ledger_topup_${driverId}` },
          update: {
            type: 'IN',
            category: 'TOP_UP',
            amount: ACTIVATION_BALANCE,
            referenceId: activationOrderId,
            description: 'Nạp tiền ký quỹ tài xế',
            metadata: {
              seeded: true,
              source: 'seed-database',
              provider,
            },
            createdAt: activationCompletedAt,
          },
          create: {
            type: 'IN',
            category: 'TOP_UP',
            amount: ACTIVATION_BALANCE,
            referenceId: activationOrderId,
            description: 'Nạp tiền ký quỹ tài xế',
            idempotencyKey: `seed_wallet_ledger_topup_${driverId}`,
            metadata: {
              seeded: true,
              source: 'seed-database',
              provider,
            },
            createdAt: activationCompletedAt,
          },
        });

        await tx.merchantLedger.upsert({
          where: { idempotencyKey: `seed_wallet_ledger_payment_${driverId}` },
          update: {
            type: 'IN',
            category: 'PAYMENT',
            amount: DEMO_GROSS_FARE,
            referenceId: earningReferenceId,
            description: 'Khách thanh toán chuyến đi online mẫu',
            metadata: {
              seeded: true,
              source: 'seed-database',
              grossFare: DEMO_GROSS_FARE,
              platformFee: DEMO_PLATFORM_FEE,
              netEarnings: DEMO_NET_EARNINGS,
              voucherDiscount: 0,
            },
            createdAt: earningCreatedAt,
          },
          create: {
            type: 'IN',
            category: 'PAYMENT',
            amount: DEMO_GROSS_FARE,
            referenceId: earningReferenceId,
            description: 'Khách thanh toán chuyến đi online mẫu',
            idempotencyKey: `seed_wallet_ledger_payment_${driverId}`,
            metadata: {
              seeded: true,
              source: 'seed-database',
              grossFare: DEMO_GROSS_FARE,
              platformFee: DEMO_PLATFORM_FEE,
              netEarnings: DEMO_NET_EARNINGS,
              voucherDiscount: 0,
            },
            createdAt: earningCreatedAt,
          },
        });

        await tx.merchantLedger.upsert({
          where: { idempotencyKey: `seed_wallet_ledger_payout_${driverId}` },
          update: {
            type: 'OUT',
            category: 'PAYOUT',
            amount: DEMO_NET_EARNINGS,
            referenceId: earningReferenceId,
            description: 'Chi trả thu nhập tài xế mẫu',
            metadata: {
              seeded: true,
              source: 'seed-database',
            },
            createdAt: earningCreatedAt,
          },
          create: {
            type: 'OUT',
            category: 'PAYOUT',
            amount: DEMO_NET_EARNINGS,
            referenceId: earningReferenceId,
            description: 'Chi trả thu nhập tài xế mẫu',
            idempotencyKey: `seed_wallet_ledger_payout_${driverId}`,
            metadata: {
              seeded: true,
              source: 'seed-database',
            },
            createdAt: earningCreatedAt,
          },
        });

        await tx.driverDailyStats.upsert({
          where: {
            driverId_date: {
              driverId,
              date: statsDate,
            },
          },
          update: {
            tripsCompleted: 8 + (index % 5),
            distanceKm: Number((42 + index * 1.35).toFixed(1)),
            peakTrips: 1 + (index % 3),
            bonusAwarded: 0,
          },
          create: {
            driverId,
            date: statsDate,
            tripsCompleted: 8 + (index % 5),
            distanceKm: Number((42 + index * 1.35).toFixed(1)),
            peakTrips: 1 + (index % 3),
            bonusAwarded: 0,
          },
        });
      });

      await upsertSeedBankTransaction({
        fromAccount: `DRIVER_${provider}`,
        toAccount: 'MAIN_ACCOUNT',
        amount: ACTIVATION_BALANCE,
        type: 'TOP_UP',
        referenceId: activationOrderId,
        description: `Tài xế nạp tiền ví qua ${provider}`,
        metadata: {
          seeded: true,
          source: 'seed-database',
          driverId,
          provider,
          gatewayTxnId: activationGatewayTxnId,
        },
        createdAt: activationCompletedAt,
      });

      await upsertSeedBankTransaction({
        fromAccount: 'CUSTOMER_BANK',
        toAccount: 'MAIN_ACCOUNT',
        amount: DEMO_GROSS_FARE,
        type: 'PAYMENT',
        referenceId: earningReferenceId,
        description: 'Khách thanh toán chuyến đi online mẫu',
        metadata: {
          seeded: true,
          source: 'seed-database',
          driverId,
          grossFare: DEMO_GROSS_FARE,
          platformFee: DEMO_PLATFORM_FEE,
          netEarnings: DEMO_NET_EARNINGS,
        },
        createdAt: earningCreatedAt,
      });
    }

    const [merchantInAgg, merchantOutAgg] = await Promise.all([
      (prisma as any).merchantLedger.aggregate({ where: { type: 'IN' }, _sum: { amount: true } }),
      (prisma as any).merchantLedger.aggregate({ where: { type: 'OUT' }, _sum: { amount: true } }),
    ]);

    const totalIn = merchantInAgg._sum.amount ?? 0;
    const totalOut = merchantOutAgg._sum.amount ?? 0;

    await (prisma as any).merchantBalance.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        balance: totalIn - totalOut,
        totalIn,
        totalOut,
      },
      update: {
        balance: totalIn - totalOut,
        totalIn,
        totalOut,
      },
    });

    console.log(`    ${driverIds.length} driver wallets synchronized`);
    console.log(`    ${driverIds.length} activation top-up orders synchronized`);
    console.log(`    ${driverIds.length * 2} wallet transactions synchronized`);
    console.log(`    ${driverIds.length * 3} merchant ledger entries synchronized`);
    console.log(`    ${driverIds.length * 2} bank transactions synchronized`);
    console.log(`    ${driverIds.length} driver daily stats synchronized`);
    console.log(`    ${rules.length} incentive rules synchronized`);
    console.log(`    ${systemBankAccounts.length} system bank accounts synchronized`);
  } finally {
    await prisma.$disconnect();
  }
}

// Initial wallet balance seeded in payment_db (mirrors ACTIVATION_BALANCE + DEMO_WITHDRAWABLE_BALANCE in wallet_db)
const SEED_DRIVER_INITIAL_WALLET_BALANCE = 450_000;

async function seedPaymentDB(rides: Array<{ id: string; status: string }>, customerIds: string[], driverIds: string[]) {
  console.log('  Seeding payment_db...');
  const prisma = createServicePrismaClient('payment-service', 'payment_db');

  try {
    const upsertPaymentWalletTransaction = async (input: {
      driverId: string;
      type: 'TOP_UP' | 'COMMISSION' | 'EARN';
      amount: number;
      balanceAfter: number;
      description: string;
      createdAt: Date;
      rideId?: string | null;
    }) => {
      const transactionData = {
        driverId: input.driverId,
        type: input.type,
        amount: input.amount,
        balanceAfter: input.balanceAfter,
        description: input.description,
        rideId: input.rideId ?? null,
        createdAt: input.createdAt,
      };

      const existing = await prisma.walletTransaction.findFirst({
        where: {
          driverId: input.driverId,
          type: input.type,
          rideId: input.rideId ?? null,
          description: input.description,
        },
      });

      if (existing) {
        await prisma.walletTransaction.update({
          where: { id: existing.id },
          data: transactionData,
        });
        return;
      }

      await prisma.walletTransaction.create({ data: transactionData });
    };

    const walletBalances = new Map<string, number>();
    const dailyStats = new Map<string, {
      driverId: string;
      date: Date;
      tripsCompleted: number;
      distanceKm: number;
      peakTrips: number;
      bonusAwarded: number;
    }>();
    let seededDriverEarningsCount = 0;
    let seededWalletTransactionCount = 0;

    for (const driverId of driverIds) {
      walletBalances.set(driverId, SEED_DRIVER_INITIAL_WALLET_BALANCE);

      await prisma.driverWallet.upsert({
        where: { driverId },
        update: { balance: SEED_DRIVER_INITIAL_WALLET_BALANCE },
        create: {
          driverId,
          balance: SEED_DRIVER_INITIAL_WALLET_BALANCE,
        },
      });

      await upsertPaymentWalletTransaction({
        driverId,
        type: 'TOP_UP',
        amount: SEED_DRIVER_INITIAL_WALLET_BALANCE,
        balanceAfter: SEED_DRIVER_INITIAL_WALLET_BALANCE,
        description: 'So du khoi tao seed driver wallet',
        createdAt: hoursAgo(96),
      });

      seededWalletTransactionCount += 1;
    }

    for (let index = 0; index < RIDE_SEEDS.length; index += 1) {
      const rideSeed = RIDE_SEEDS[index];
      const ride = rides[index];
      const initiatedAt = hoursAgo(23 - index * 3);
      const timeline = getSeedRideTimeline(index, rideSeed);

      await prisma.fare.upsert({
        where: { rideId: ride.id },
        update: {
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
        create: {
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

      await prisma.payment.upsert({
        where: { rideId: ride.id },
        update: {
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
        create: {
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

      if (rideSeed.status === 'COMPLETED' && rideSeed.driverIndex !== undefined) {
        const driverId = driverIds[rideSeed.driverIndex];
        const completedAt = timeline.completedAt || new Date(initiatedAt.getTime() + rideSeed.duration * 1000);
        const earnings = getSeedDriverEarnings(index, rideSeed);

        await prisma.driverEarnings.upsert({
          where: { rideId: ride.id },
          update: {
            rideId: ride.id,
            driverId,
            grossFare: earnings.grossFare,
            commissionRate: earnings.commissionRate,
            platformFee: earnings.platformFee,
            bonus: earnings.bonus,
            penalty: earnings.penalty,
            netEarnings: earnings.netEarnings,
            paymentMethod: rideSeed.paymentMethod,
            driverCollected: earnings.driverCollected,
            cashDebt: earnings.cashDebt,
            isPaid: true,
            paidAt: completedAt,
            bonusBreakdown: earnings.bonus > 0 ? { seededPerformanceBonus: earnings.bonus } : null,
            penaltyBreakdown: earnings.penalty > 0 ? { seededAdjustment: earnings.penalty } : null,
            createdAt: completedAt,
          },
          create: {
            rideId: ride.id,
            driverId,
            grossFare: earnings.grossFare,
            commissionRate: earnings.commissionRate,
            platformFee: earnings.platformFee,
            bonus: earnings.bonus,
            penalty: earnings.penalty,
            netEarnings: earnings.netEarnings,
            paymentMethod: rideSeed.paymentMethod,
            driverCollected: earnings.driverCollected,
            cashDebt: earnings.cashDebt,
            isPaid: true,
            paidAt: completedAt,
            bonusBreakdown: earnings.bonus > 0 ? { seededPerformanceBonus: earnings.bonus } : null,
            penaltyBreakdown: earnings.penalty > 0 ? { seededAdjustment: earnings.penalty } : null,
            createdAt: completedAt,
          },
        });
        seededDriverEarningsCount += 1;

        let currentBalance = walletBalances.get(driverId) ?? SEED_DRIVER_INITIAL_WALLET_BALANCE;

        if (earnings.driverCollected) {
          if (earnings.cashDebt > 0) {
            currentBalance -= earnings.cashDebt;
            await upsertPaymentWalletTransaction({
              driverId,
              type: 'COMMISSION',
              amount: earnings.cashDebt,
              balanceAfter: currentBalance,
              description: 'Khau tru cong no cuoc tien mat seed',
              rideId: ride.id,
              createdAt: completedAt,
            });
            seededWalletTransactionCount += 1;
          }
        } else if (earnings.netEarnings > 0) {
          currentBalance += earnings.netEarnings;
          await upsertPaymentWalletTransaction({
            driverId,
            type: 'EARN',
            amount: earnings.netEarnings,
            balanceAfter: currentBalance,
            description: 'Thu nhap cuoc online seed',
            rideId: ride.id,
            createdAt: completedAt,
          });
          seededWalletTransactionCount += 1;
        }

        walletBalances.set(driverId, currentBalance);

        const statsDate = getVietnamCalendarDate(completedAt);
        const statsKey = `${driverId}:${statsDate.toISOString()}`;
        const currentStats = dailyStats.get(statsKey) || {
          driverId,
          date: statsDate,
          tripsCompleted: 0,
          distanceKm: 0,
          peakTrips: 0,
          bonusAwarded: 0,
        };

        currentStats.tripsCompleted += 1;
        currentStats.distanceKm += rideSeed.distance;
        currentStats.peakTrips += isSeedPeakHour(completedAt) ? 1 : 0;
        currentStats.bonusAwarded += earnings.bonus;
        dailyStats.set(statsKey, currentStats);
      }
    }

    for (const [driverId, balance] of walletBalances.entries()) {
      await prisma.driverWallet.update({
        where: { driverId },
        data: { balance },
      });
    }

    for (const stats of dailyStats.values()) {
      await prisma.driverDailyStats.upsert({
        where: {
          driverId_date: {
            driverId: stats.driverId,
            date: stats.date,
          },
        },
        update: {
          tripsCompleted: stats.tripsCompleted,
          distanceKm: Number(stats.distanceKm.toFixed(2)),
          peakTrips: stats.peakTrips,
          bonusAwarded: stats.bonusAwarded,
        },
        create: {
          driverId: stats.driverId,
          date: stats.date,
          tripsCompleted: stats.tripsCompleted,
          distanceKm: Number(stats.distanceKm.toFixed(2)),
          peakTrips: stats.peakTrips,
          bonusAwarded: stats.bonusAwarded,
        },
      });
    }

    console.log(`    ${RIDE_SEEDS.length} fares synchronized`);
    console.log(`    ${RIDE_SEEDS.length} payments synchronized`);
    console.log(`    ${seededDriverEarningsCount} driver earnings rows synchronized`);
    console.log(`    ${seededWalletTransactionCount} wallet transactions synchronized`);
    console.log(`    ${dailyStats.size} driver daily stats rows synchronized`);

    // Seed vouchers
    const now = new Date();
    const past30 = new Date(now.getTime() - 30 * 86_400_000);
    const future30 = new Date(now.getTime() + 30 * 86_400_000);
    const future7 = new Date(now.getTime() + 7 * 86_400_000);
    const voucherSeeds = [
      {
        code: 'WELCOME20',
        description: 'Giảm 20% tối đa 50.000đ cho khách mới',
        audienceType: 'NEW_CUSTOMERS' as const,
        discountType: 'PERCENT' as const,
        discountValue: 20,
        maxDiscount: 50_000,
        minFare: 0,
        startTime: past30,
        endTime: future30,
        usageLimit: 200,
        perUserLimit: 1,
        isActive: true,
      },
      {
        code: 'FLAT30K',
        description: 'Giảm thẳng 30.000đ cho chuyến từ 80.000đ',
        audienceType: 'ALL_CUSTOMERS' as const,
        discountType: 'FIXED' as const,
        discountValue: 30_000,
        maxDiscount: null,
        minFare: 80_000,
        startTime: past30,
        endTime: future30,
        usageLimit: 500,
        perUserLimit: 3,
        isActive: true,
      },
      {
        code: 'NEWUSER50',
        description: 'Ưu đãi 50% tối đa 100.000đ dành riêng khách mới',
        audienceType: 'NEW_CUSTOMERS' as const,
        discountType: 'PERCENT' as const,
        discountValue: 50,
        maxDiscount: 100_000,
        minFare: 0,
        startTime: past30,
        endTime: future30,
        usageLimit: 100,
        perUserLimit: 1,
        isActive: true,
      },
      {
        code: 'WEEKEND10',
        description: 'Giảm 10% cuối tuần (tối đa 30.000đ)',
        audienceType: 'ALL_CUSTOMERS' as const,
        discountType: 'PERCENT' as const,
        discountValue: 10,
        maxDiscount: 30_000,
        minFare: 0,
        startTime: past30,
        endTime: future7,
        usageLimit: 1000,
        perUserLimit: 5,
        isActive: true,
      },
      {
        code: 'OLDUSER15',
        description: 'Tri ân khách hàng thân thiết: giảm 15% (tối đa 40.000đ)',
        audienceType: 'RETURNING_CUSTOMERS' as const,
        discountType: 'PERCENT' as const,
        discountValue: 15,
        maxDiscount: 40_000,
        minFare: 50_000,
        startTime: past30,
        endTime: future30,
        usageLimit: 300,
        perUserLimit: 2,
        isActive: true,
      },
    ];
    let voucherCount = 0;
    for (const v of voucherSeeds) {
      await prisma.voucher.upsert({
        where: { code: v.code },
        update: { ...v },
        create: { ...v },
      });
      voucherCount += 1;
    }
    console.log(`    ${voucherCount} vouchers seeded`);

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

      const availabilityStatus = ['ASSIGNED', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS'].includes(rideSeed.status)
        ? 'BUSY'
        : 'ONLINE';

      await prisma.driver.update({
        where: { id: driverIds[rideSeed.driverIndex] },
        data: {
          currentRideId: ['ASSIGNED', 'ACCEPTED', 'PICKING_UP', 'IN_PROGRESS'].includes(rideSeed.status) ? rides[index].id : null,
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
    const criticalComments = [
      'Tài xế đến muộn và hỗ trợ chưa tốt.',
      'Chuyến đi chưa ổn, tài xế cần cải thiện thái độ phục vụ.',
      'Xe chưa sạch và lộ trình chưa tối ưu.',
    ];
    const neutralComments = [
      'Chuyến đi bình thường, không có gì đặc biệt.',
      'Tài xế tạm ổn, xe cũ một chút nhưng an toàn.',
      'Đúng giờ, đi đúng đường. Ổn.',
    ];
    for (let i = 0; i < completedRideIds.length && i < 15; i++) {
      const custIdx = i % customerIds.length;
      const drvIdx = i % driverIds.length;
      const rating = FOCUSED_REVIEW_RATINGS[i] ?? (i % 5 === 0 ? 4 : i % 7 === 0 ? 3 : 5);
      const comment = rating >= 5
        ? positiveComments[i % positiveComments.length]
        : rating <= 2
          ? criticalComments[i % criticalComments.length]
          : neutralComments[i % neutralComments.length];
      const tags = rating >= 5
        ? ['professional', 'safe_driving', 'clean_car'].slice(0, (i % 3) + 1)
        : rating <= 2
          ? ['late_pickup', 'service_issue', 'vehicle_cleanliness'].slice(0, (i % 3) + 1)
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
      if (i % 2 === 0 || i < FOCUSED_REVIEW_RATINGS.length) {
        reviewRecords.push({
          rideId: completedRideIds[i],
          bookingId: bookingIds[i % bookingIds.length],
          type: 'DRIVER_TO_CUSTOMER',
          reviewerId: driverIds[drvIdx],
          reviewerName: driverNames[drvIdx] || `Driver ${drvIdx + 1}`,
          revieweeId: customerIds[custIdx],
          revieweeName: customerNames[custIdx] || `Customer ${custIdx + 1}`,
          rating: i < FOCUSED_REVIEW_RATINGS.length ? rating : (rating >= 5 ? 5 : 4),
          comment: i < FOCUSED_REVIEW_RATINGS.length
            ? (rating <= 2 ? 'Khách hàng đổi điểm đón hoặc phản hồi chậm trong chuyến seed kiểm thử.' : 'Khách hàng phối hợp ổn, phù hợp kịch bản rating seed.')
            : 'Khách hàng lịch sự, đúng giờ.',
          tags: i < FOCUSED_REVIEW_RATINGS.length
            ? (rating <= 2 ? ['slow_response', 'route_change'] : ['cooperative', 'punctual'])
            : ['friendly', 'punctual'],
        });
      }
    }
    await Review.create(reviewRecords);
    console.log(`    ${reviewRecords.length} reviews created`);
    await reviewConn.close();
    return {
      notificationCount: notifRecords.length,
      reviewCount: reviewRecords.length,
    };
  } catch (error: any) {
    console.log(`    MongoDB seed skipped: ${error.message}`);
    return {
      notificationCount: 0,
      reviewCount: 0,
    };
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

    // 4. Seed wallet database (keyed by auth user IDs, NOT driver profile IDs)
    await seedWalletDB(driverUserIds);

    // 5. Seed bookings
    const bookingIds = await seedBookingDB(customerIds);

    // 6. Seed rides + payment lifecycle data
    const rides = await seedRideDB(customerIds, driverIds);
    await seedPaymentDB(rides, customerIds, driverIds);
    await syncDriverRideAssignments(driverIds, rides);

    // 7. Seed MongoDB (notifications + reviews)
    const mongoSeedSummary = await seedMongoDB(rides, bookingIds, customerIds, driverIds);
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
    console.log(`   Notifications: ${mongoSeedSummary.notificationCount}`);
    console.log(`   Reviews:     ${mongoSeedSummary.reviewCount}`);
    console.log('');
    console.log(' Test credentials:');
  console.log('   All users password: Password@1');
  console.log('   Admin: admin@cabbooking.com / 0900000001');
  console.log('   Customers: 0901234561 – 0901234570');
  console.log('   Drivers:   0911234561 – 0911234570, plus 30 seeded phones (prefix 0919xxxxxx)');
  console.log('   Focused Ben Thanh drivers: 0911234561, 0911234562, 0911234568');
  console.log('   Focused Tan Son Nhat drivers: 0919100000, 0919100004, 0919100008');
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

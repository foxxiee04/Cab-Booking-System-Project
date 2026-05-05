/// <reference types="node" />

/**
 * Cab Booking System - Pure-API Database Seed Script
 *
 * Mọi entity đều được tạo qua API gateway (http://localhost:3000) NGOẠI TRỪ
 * 1 ngoại lệ kỹ thuật DUY NHẤT: bootstrap admin user (vì auth-service không có
 * public endpoint tạo admin). Admin được insert thẳng vào auth_db rồi mọi
 * thao tác sau đều dùng admin token thật.
 *
 * Trình tự:
 *   1. Bootstrap admin → auth_db direct INSERT (1 row only)
 *   2. Admin login qua /api/auth/login
 *   3. Tạo 5 voucher qua /api/voucher/admin
 *   4. Tạo 4 incentive rule qua /api/admin/wallet/incentive-rules
 *   5. Đăng ký 10 customer qua register-phone/start → verify → complete
 *      (OTP lấy từ auth-service /internal/dev/otp với INTERNAL_SERVICE_TOKEN)
 *   6. Đăng ký 15 driver tương tự
 *   7. Mỗi driver: POST /api/drivers/register (vehicle + license)
 *   8. Admin approve 12 driver đầu (3 cuối để PENDING demo flow)
 *   9. Mỗi driver được approve: top-up ví 300k qua /api/wallet/top-up/init
 *      + sandbox-confirm để kích hoạt wallet
 *  10. Mỗi driver được approve: goOnline + updateLocation theo cụm
 *  11. Tạo 12 ride: 8 CASH completed, 2 MOMO completed (mock webhook),
 *      2 CANCELLED — KHÔNG có ride đang diễn ra hay FINDING_DRIVER.
 *  12. Sau khi ride xong, đặt TẤT CẢ driver OFFLINE để DB sạch.
 *  13. Generate docs/seed-accounts-reference.md từ GET API thật
 *
 * Lý do không seed ride FINDING_DRIVER / IN_PROGRESS:
 *   - Sau reset + seed, nếu login lại driver app sẽ thấy "đang diễn ra" — không hợp lí
 *   - Matching algorithm tiếp tục dispatch cho các ride đó dù không ai thao tác
 *   - Chuyến chỉ nên ở COMPLETED hoặc CANCELLED để lịch sử rõ ràng
 *
 * Usage:
 *   npx tsx scripts/seed-database.ts
 *
 * Yêu cầu:
 *   - Toàn bộ docker stack đang chạy (api-gateway, auth-service, ... )
 *   - reset-database.bat đã chạy (DB rỗng, schema mới push)
 *   - Sau reset cần `docker compose restart wallet-service` để wallet-service
 *     re-seed SystemBankAccount (tự chạy ở startup)
 */

import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const GATEWAY_BASE = process.env.GATEWAY_BASE_URL || 'http://localhost:3000';
const AUTH_INTERNAL_BASE = process.env.AUTH_INTERNAL_URL || 'http://localhost:3001';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-internal-token';

const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5433';
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';

const SEED_PASSWORD = 'Password@1';
const ACTIVATION_BALANCE = 300_000;
const SEED_REFERENCE_OUTPUT = path.resolve(process.cwd(), 'docs', 'seed-accounts-reference.md');

const DELAY_AFTER_RIDE_CREATE_MS = 4_000;
const DRIVER_ACCEPT_RETRY_MAX = 8;
const DRIVER_ACCEPT_RETRY_DELAY_MS = 2_000;

// ─── Bootstrap admin (DB-direct) ─────────────────────────────────────────────
// EXCEPTION: Chỉ duy nhất chỗ này ghi DB trực tiếp vì auth-service KHÔNG có
// public endpoint /api/auth/register-admin. Mọi thứ khác đi qua API thật.

const ADMIN = {
  phone: '0900000001',
  email: 'admin@cabbooking.com',
  firstName: 'System',
  lastName: 'Admin',
};

function pgUrl(db: string) {
  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${db}`;
}

function loadAuthPrismaClient() {
  const clientModulePath = path.resolve(
    process.cwd(),
    'services',
    'auth-service',
    'src',
    'generated',
    'prisma-client',
  );
  const { PrismaClient } = require(clientModulePath);
  return new PrismaClient({ datasources: { db: { url: pgUrl('auth_db') } } });
}

async function bootstrapAdmin(): Promise<string> {
  const prisma = loadAuthPrismaClient();
  try {
    const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);

    const admin = await prisma.user.upsert({
      where: { phone: ADMIN.phone },
      update: {
        email: ADMIN.email,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: ADMIN.firstName,
        lastName: ADMIN.lastName,
        passwordHash,
      },
      create: {
        phone: ADMIN.phone,
        email: ADMIN.email,
        role: 'ADMIN',
        status: 'ACTIVE',
        firstName: ADMIN.firstName,
        lastName: ADMIN.lastName,
        passwordHash,
      },
    });

    console.log(`  [bootstrap] admin user ready: ${admin.id}`);
    return admin.id;
  } finally {
    await prisma.$disconnect();
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  baseUrl?: string;
  headers?: Record<string, string>;
  expectedStatuses?: number[];
};

async function http<T = any>(pathOrUrl: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method || 'GET';
  const baseUrl = opts.baseUrl || GATEWAY_BASE;
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${baseUrl}${pathOrUrl}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };
  if (opts.body !== undefined && !['GET', 'HEAD'].includes(method)) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }

  const expectedStatuses = opts.expectedStatuses || [200, 201];

  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined && !['GET', 'HEAD'].includes(method)
          ? JSON.stringify(opts.body)
          : undefined,
      });

      const text = await response.text();
      let payload: any = null;
      if (text) {
        try { payload = JSON.parse(text); } catch { payload = text; }
      }

      if (!expectedStatuses.includes(response.status)) {
        const error: any = new Error(
          `HTTP ${method} ${url} → ${response.status}: ${
            typeof payload === 'object' ? JSON.stringify(payload) : payload
          }`,
        );
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      return payload as T;
    } catch (err: any) {
      lastError = err;
      // Retry only on network errors / 5xx; not on 4xx
      if (err.status && err.status < 500) {
        throw err;
      }
      if (attempt < 3) {
        await sleep(500 * attempt);
        continue;
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Redis rate-limit cleanup ────────────────────────────────────────────────
// Auth-service enforces OTP rate limits in Redis: 10 OTP / 60s per IP.
// Since we register 25 users from one machine sequentially, we proactively
// clear these keys via docker exec to keep the seed deterministic.

function clearOtpRateLimits(silent = false) {
  try {
    const scan = spawnSync(
      'docker',
      ['exec', 'cab-redis', 'redis-cli', '--scan', '--pattern', 'otp:rate:*'],
      { encoding: 'utf8' },
    );
    if (scan.status !== 0) return;
    const keys = (scan.stdout || '').split(/\r?\n/).map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) return;
    spawnSync('docker', ['exec', 'cab-redis', 'redis-cli', 'DEL', ...keys], { stdio: 'pipe' });
    if (!silent) {
      console.log(`    [redis] cleared ${keys.length} OTP rate-limit key(s)`);
    }
  } catch {
    // docker not available — assume rate limits are configured generously
  }
}

// ─── OTP fetch via auth-service internal ─────────────────────────────────────

async function fetchOtp(phone: string, purpose = 'register'): Promise<string> {
  const data = await http<{ success: boolean; otp: string }>(
    `/internal/dev/otp?phone=${encodeURIComponent(phone)}&purpose=${purpose}`,
    {
      baseUrl: AUTH_INTERNAL_BASE,
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    },
  );
  if (!data?.otp) {
    throw new Error(`OTP not found for ${phone} (${purpose})`);
  }
  return data.otp;
}

// ─── Admin login ─────────────────────────────────────────────────────────────

async function loginAdmin(): Promise<string> {
  const data = await http<{ data: { tokens: { accessToken: string } } }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: { phone: ADMIN.phone, password: SEED_PASSWORD },
    },
  );
  const token = data?.data?.tokens?.accessToken;
  if (!token) {
    throw new Error(`Admin login failed: ${JSON.stringify(data)}`);
  }
  console.log('  [auth] admin token acquired');
  return token;
}

// ─── Voucher seed ────────────────────────────────────────────────────────────

const VOUCHER_SEEDS = [
  {
    code: 'WELCOME20',
    description: 'Giảm 20% tối đa 50.000đ cho khách mới',
    audienceType: 'NEW_CUSTOMERS',
    discountType: 'PERCENT',
    discountValue: 20,
    maxDiscount: 50_000,
    minFare: 0,
    usageLimit: 200,
    perUserLimit: 1,
    isActive: true,
  },
  {
    code: 'FLAT30K',
    description: 'Giảm thẳng 30.000đ cho chuyến từ 80.000đ',
    audienceType: 'ALL_CUSTOMERS',
    discountType: 'FIXED',
    discountValue: 30_000,
    minFare: 80_000,
    usageLimit: 500,
    perUserLimit: 3,
    isActive: true,
  },
  {
    code: 'NEWUSER50',
    description: 'Ưu đãi 50% tối đa 100.000đ dành riêng khách mới',
    audienceType: 'NEW_CUSTOMERS',
    discountType: 'PERCENT',
    discountValue: 50,
    maxDiscount: 100_000,
    minFare: 0,
    usageLimit: 100,
    perUserLimit: 1,
    isActive: true,
  },
  {
    code: 'WEEKEND10',
    description: 'Giảm 10% cuối tuần (tối đa 30.000đ)',
    audienceType: 'ALL_CUSTOMERS',
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscount: 30_000,
    minFare: 0,
    usageLimit: 1000,
    perUserLimit: 5,
    isActive: true,
  },
  {
    code: 'OLDUSER15',
    description: 'Tri ân khách hàng thân thiết: giảm 15% (tối đa 40.000đ)',
    audienceType: 'RETURNING_CUSTOMERS',
    discountType: 'PERCENT',
    discountValue: 15,
    maxDiscount: 40_000,
    minFare: 50_000,
    usageLimit: 300,
    perUserLimit: 2,
    isActive: true,
  },
] as const;

async function seedVouchers(adminToken: string) {
  console.log('  [vouchers] creating via /api/voucher/admin...');
  const now = new Date();
  const past30 = new Date(now.getTime() - 30 * 86_400_000);
  const future30 = new Date(now.getTime() + 30 * 86_400_000);

  for (const v of VOUCHER_SEEDS) {
    try {
      await http('/api/voucher/admin', {
        method: 'POST',
        token: adminToken,
        body: {
          ...v,
          startTime: past30.toISOString(),
          endTime: future30.toISOString(),
        },
      });
      console.log(`    + voucher ${v.code}`);
    } catch (err: any) {
      // Voucher may already exist if seed ran before; skip duplicate
      if (err?.status === 409 || err?.payload?.error?.message?.includes('đã')) {
        console.log(`    = voucher ${v.code} already exists`);
        continue;
      }
      throw err;
    }
  }
}

// ─── Incentive rules ─────────────────────────────────────────────────────────

const INCENTIVE_RULES = [
  { type: 'TRIP_COUNT', conditionValue: 10, rewardAmount: 50_000, description: 'Chạy >= 10 cuốc/ngày thưởng 50.000 đ' },
  { type: 'TRIP_COUNT', conditionValue: 20, rewardAmount: 120_000, description: 'Chạy >= 20 cuốc/ngày thưởng 120.000 đ' },
  { type: 'DISTANCE_KM', conditionValue: 50, rewardAmount: 30_000, description: 'Đạt >= 50 km/ngày thưởng 30.000 đ' },
  { type: 'PEAK_HOUR', conditionValue: 0, rewardAmount: 10_000, description: 'Mỗi cuốc trong giờ cao điểm thưởng 10.000 đ' },
];

async function seedIncentiveRules(adminToken: string) {
  console.log('  [incentive-rules] creating via /api/admin/wallet/incentive-rules...');
  for (const rule of INCENTIVE_RULES) {
    try {
      await http('/api/admin/wallet/incentive-rules', {
        method: 'POST',
        token: adminToken,
        body: rule,
      });
      console.log(`    + ${rule.type} (${rule.conditionValue}) → ${rule.rewardAmount}đ`);
    } catch (err: any) {
      console.log(`    ! incentive rule ${rule.type} skipped: ${err.message?.slice(0, 80)}`);
    }
  }
}

// ─── User registration via OTP flow ──────────────────────────────────────────

type RegisteredUser = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string | null;
};

async function registerUser(
  phone: string,
  firstName: string,
  lastName: string,
  role: 'CUSTOMER' | 'DRIVER',
): Promise<RegisteredUser> {
  // Proactively clear rate-limit keys so seed is deterministic regardless of
  // OTP_RATE_MAX_PER_IP env config (default 10 / 60s).
  clearOtpRateLimits(true);

  // Step 1: start phone registration
  await http('/api/auth/register-phone/start', {
    method: 'POST',
    body: { phone },
  });

  // Step 2: fetch OTP from internal endpoint
  const otp = await fetchOtp(phone, 'register');

  // Step 3: verify OTP
  await http('/api/auth/register-phone/verify', {
    method: 'POST',
    body: { phone, otp },
  });

  // Step 4: complete registration with profile + password → returns tokens
  const completeRes = await http<any>('/api/auth/register-phone/complete', {
    method: 'POST',
    body: { phone, password: SEED_PASSWORD, firstName, lastName, role },
    expectedStatuses: [200, 201],
  });

  const user = completeRes?.data?.user;
  const tokens = completeRes?.data?.tokens;

  if (!user?.id || !tokens?.accessToken) {
    throw new Error(`Registration response malformed for ${phone}: ${JSON.stringify(completeRes)}`);
  }

  return {
    userId: user.id,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    phone: user.phone,
    firstName: user.firstName || firstName,
    lastName: user.lastName || lastName,
    email: user.email,
  };
}

// ─── Customer seed list ──────────────────────────────────────────────────────

const CUSTOMERS = [
  { phone: '0901234561', firstName: 'Nguyen', lastName: 'Van A' },
  { phone: '0901234562', firstName: 'Tran', lastName: 'Thi B' },
  { phone: '0901234563', firstName: 'Le', lastName: 'Van C' },
  { phone: '0901234564', firstName: 'Pham', lastName: 'Minh D' },
  { phone: '0901234565', firstName: 'Hoang', lastName: 'Van E' },
  { phone: '0901234566', firstName: 'Dang', lastName: 'Thi F' },
  { phone: '0901234567', firstName: 'Vu', lastName: 'Minh G' },
  { phone: '0901234568', firstName: 'Bui', lastName: 'Thi H' },
  { phone: '0901234569', firstName: 'Ngo', lastName: 'Van I' },
  { phone: '0901234570', firstName: 'Dinh', lastName: 'Thi J' },
  // Demo customer tại khu vực Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp
  { phone: '0901234571', firstName: 'Nguyen', lastName: 'Thi Demo' },
  // Khách hàng demo cho multi-user test scenarios (3C-1D, payment, AI)
  { phone: '0901999001', firstName: 'Phuong',  lastName: 'Nguyen Test' },
  { phone: '0901999002', firstName: 'Khoa',    lastName: 'Tran Test'   },
  { phone: '0901999003', firstName: 'Linh',    lastName: 'Le Test'     },
  { phone: '0901999004', firstName: 'Minh',    lastName: 'Pham Test'   },
];

async function registerCustomers(): Promise<RegisteredUser[]> {
  console.log(`  [customers] registering ${CUSTOMERS.length} customers...`);
  const results: RegisteredUser[] = [];
  for (let i = 0; i < CUSTOMERS.length; i += 1) {
    const c = CUSTOMERS[i];
    const user = await registerUser(c.phone, c.firstName, c.lastName, 'CUSTOMER');
    results.push(user);
    console.log(`    + customer #${i + 1} ${user.phone} (${user.userId.slice(0, 8)}...)`);
  }
  return results;
}

// ─── Driver seed list ────────────────────────────────────────────────────────
// Vehicle plate format:
//   - CAR_4 / CAR_7: NN[A-Z]-NNN.NN     (1 letter)
//   - MOTORBIKE / SCOOTER: NN[A-Z][A-Z]-NNN.NN (2 letters)
// License number: exactly 12 digits

const DRIVERS = [
  // Cluster Bến Thành — 3 CAR_4 drivers, ratings 1/2/3 stars (focused test rating)
  {
    phone: '0911234561', firstName: 'Pham', lastName: 'Van D',
    cluster: 'Bến Thành',
    location: { lat: 10.77295, lng: 106.69905 },
    vehicle: { type: 'CAR_4', brand: 'Toyota', model: 'Vios', plate: '51A-123.45', color: 'White', year: 2022 },
    license: { class: 'B', number: '100000000001', expiryYear: 2027 },
  },
  {
    phone: '0911234562', firstName: 'Vo', lastName: 'Thi E',
    cluster: 'Bến Thành',
    location: { lat: 10.77195, lng: 106.69855 },
    vehicle: { type: 'CAR_4', brand: 'Honda', model: 'City', plate: '51A-678.90', color: 'Black', year: 2023 },
    license: { class: 'B', number: '100000000002', expiryYear: 2028 },
  },
  {
    phone: '0911234568', firstName: 'Pham', lastName: 'Van M',
    cluster: 'Bến Thành',
    location: { lat: 10.77215, lng: 106.69675 },
    vehicle: { type: 'CAR_4', brand: 'Hyundai', model: 'Accent', plate: '51B-444.44', color: 'Silver', year: 2024 },
    license: { class: 'B', number: '100000000008', expiryYear: 2029 },
  },
  // Cluster Tân Sơn Nhất — 3 CAR_4 drivers
  {
    phone: '0911234571', firstName: 'Nguyen', lastName: 'Van K',
    cluster: 'Tân Sơn Nhất',
    location: { lat: 10.81925, lng: 106.65795 },
    vehicle: { type: 'CAR_4', brand: 'Mazda', model: 'Mazda3', plate: '59C-100.10', color: 'Red', year: 2023 },
    license: { class: 'B', number: '100000000011', expiryYear: 2029 },
  },
  {
    phone: '0911234572', firstName: 'Tran', lastName: 'Thi L',
    cluster: 'Tân Sơn Nhất',
    location: { lat: 10.81745, lng: 106.66085 },
    vehicle: { type: 'CAR_4', brand: 'Hyundai', model: 'Elantra', plate: '59C-200.20', color: 'White', year: 2022 },
    license: { class: 'B', number: '100000000012', expiryYear: 2028 },
  },
  {
    phone: '0911234573', firstName: 'Le', lastName: 'Minh N',
    cluster: 'Tân Sơn Nhất',
    location: { lat: 10.81325, lng: 106.66295 },
    vehicle: { type: 'CAR_4', brand: 'Kia', model: 'K3', plate: '59C-300.30', color: 'Blue', year: 2024 },
    license: { class: 'B', number: '100000000013', expiryYear: 2029 },
  },
  // Cluster Phú Mỹ Hưng — 2 mixed (CAR_7 + SCOOTER)
  {
    phone: '0911234574', firstName: 'Hoang', lastName: 'Van P',
    cluster: 'Phú Mỹ Hưng',
    location: { lat: 10.7301, lng: 106.7194 },
    vehicle: { type: 'CAR_7', brand: 'Toyota', model: 'Innova', plate: '51B-111.11', color: 'Gray', year: 2022 },
    license: { class: 'D2', number: '100000000014', expiryYear: 2028 },
  },
  {
    phone: '0911234575', firstName: 'Bui', lastName: 'Thi Q',
    cluster: 'Phú Mỹ Hưng',
    location: { lat: 10.7287, lng: 106.7180 },
    vehicle: { type: 'SCOOTER', brand: 'Honda', model: 'Vision', plate: '59XA-246.80', color: 'Red', year: 2024 },
    license: { class: 'A1', number: '100000000015', expiryYear: 2029 },
  },
  // Cluster Thủ Đức — 2 mixed
  {
    phone: '0911234576', firstName: 'Vu', lastName: 'Van R',
    cluster: 'Thủ Đức',
    location: { lat: 10.8500, lng: 106.7720 },
    vehicle: { type: 'MOTORBIKE', brand: 'Honda', model: 'Wave Alpha', plate: '59BA-333.33', color: 'Blue', year: 2023 },
    license: { class: 'A1', number: '100000000016', expiryYear: 2029 },
  },
  {
    phone: '0911234577', firstName: 'Dang', lastName: 'Thi S',
    cluster: 'Thủ Đức',
    location: { lat: 10.8489, lng: 106.7715 },
    vehicle: { type: 'CAR_4', brand: 'Honda', model: 'Civic', plate: '51B-555.55', color: 'Black', year: 2023 },
    license: { class: 'B', number: '100000000017', expiryYear: 2029 },
  },
  // Backup approved drivers (cluster Bến Thành extra) for race / browse-mode tests
  {
    phone: '0911234578', firstName: 'Cao', lastName: 'Van T',
    cluster: 'Bến Thành',
    location: { lat: 10.77150, lng: 106.69950 },
    vehicle: { type: 'CAR_4', brand: 'Toyota', model: 'Yaris Cross', plate: '51A-999.99', color: 'White', year: 2024 },
    license: { class: 'B', number: '100000000018', expiryYear: 2029 },
  },
  {
    phone: '0911234579', firstName: 'Mai', lastName: 'Van U',
    cluster: 'Bến Thành',
    location: { lat: 10.77310, lng: 106.69820 },
    vehicle: { type: 'MOTORBIKE', brand: 'Yamaha', model: 'Sirius', plate: '59BA-555.55', color: 'Blue', year: 2023 },
    license: { class: 'A1', number: '100000000019', expiryYear: 2029 },
  },
  // Cluster Gò Vấp / Hạnh Thông Tây — 5 tài xế cho demo giám khảo (Nguyễn Văn Bảo area)
  {
    phone: '0911234583', firstName: 'Pham', lastName: 'Van Bao',
    cluster: 'Gò Vấp / Hạnh Thông',
    location: { lat: 10.8178, lng: 106.6645 },
    vehicle: { type: 'CAR_4', brand: 'Toyota', model: 'Vios', plate: '59A-100.10', color: 'White', year: 2023 },
    license: { class: 'B', number: '100000000023', expiryYear: 2028 },
  },
  {
    phone: '0911234584', firstName: 'Tran', lastName: 'Van Hung',
    cluster: 'Gò Vấp / Hạnh Thông',
    location: { lat: 10.8165, lng: 106.6622 },
    vehicle: { type: 'MOTORBIKE', brand: 'Honda', model: 'Wave Alpha', plate: '59BA-100.20', color: 'Black', year: 2023 },
    license: { class: 'A1', number: '100000000024', expiryYear: 2029 },
  },
  {
    phone: '0911234585', firstName: 'Le', lastName: 'Thi Mai',
    cluster: 'Gò Vấp / Hạnh Thông',
    location: { lat: 10.8198, lng: 106.6655 },
    vehicle: { type: 'CAR_4', brand: 'Hyundai', model: 'Accent', plate: '59A-100.30', color: 'Silver', year: 2024 },
    license: { class: 'B', number: '100000000025', expiryYear: 2029 },
  },
  {
    phone: '0911234586', firstName: 'Hoang', lastName: 'Van Lam',
    cluster: 'Gò Vấp / Hạnh Thông',
    location: { lat: 10.8152, lng: 106.6662 },
    vehicle: { type: 'CAR_7', brand: 'Toyota', model: 'Innova', plate: '59C-100.40', color: 'Gray', year: 2022 },
    license: { class: 'D2', number: '100000000026', expiryYear: 2028 },
  },
  {
    phone: '0911234587', firstName: 'Bui', lastName: 'Thi Lan',
    cluster: 'Gò Vấp / Hạnh Thông',
    location: { lat: 10.8222, lng: 106.6615 },
    vehicle: { type: 'SCOOTER', brand: 'Honda', model: 'Vision', plate: '59XA-100.50', color: 'Red', year: 2024 },
    license: { class: 'A1', number: '100000000027', expiryYear: 2029 },
  },
  // 3 PENDING drivers for admin approval test
  {
    phone: '0911234580', firstName: 'Truong', lastName: 'Van V',
    cluster: 'Bến Thành',
    location: { lat: 10.77260, lng: 106.69800 },
    pending: true,
    vehicle: { type: 'CAR_4', brand: 'Mazda', model: 'Mazda2', plate: '51A-777.77', color: 'Silver', year: 2024 },
    license: { class: 'B', number: '100000000020', expiryYear: 2029 },
  },
  {
    phone: '0911234581', firstName: 'Lam', lastName: 'Thi W',
    cluster: 'Tân Sơn Nhất',
    location: { lat: 10.8190, lng: 106.6590 },
    pending: true,
    vehicle: { type: 'SCOOTER', brand: 'Honda', model: 'Air Blade', plate: '59XA-777.77', color: 'Black', year: 2024 },
    license: { class: 'A1', number: '100000000021', expiryYear: 2029 },
  },
  {
    phone: '0911234582', firstName: 'Huynh', lastName: 'Van X',
    cluster: 'Thủ Đức',
    location: { lat: 10.8500, lng: 106.7710 },
    pending: true,
    vehicle: { type: 'CAR_7', brand: 'Mitsubishi', model: 'Xpander', plate: '51B-222.22', color: 'Blue', year: 2023 },
    license: { class: 'D2', number: '100000000022', expiryYear: 2028 },
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
  'Sirius': 'sirius.jpg',
  'Vios': 'vios.jpg',
  'City': 'city.jpg',
  'Accent': 'accent.jpg',
  'Mazda2': 'mazda2.jpg',
  'Mazda3': 'mazda3.jpg',
  'Civic': 'civic.jpg',
  'Vision': 'vision.jpg',
  'Air Blade': 'air-blade.jpg',
  'Innova': 'innova.jpg',
  'Xpander': 'xpander.jpg',
  'Yaris Cross': 'yaris.jpg',
  'Elantra': 'elantra.jpg',
  'K3': 'k3.jpg',
};
function vehicleImageUrl(model: string, type: string) {
  const file = VEHICLE_IMAGE_BY_MODEL[model] || VEHICLE_IMAGE_BY_TYPE[type] || '4-cho.jpg';
  return `/vehicle-images/${file}`;
}

async function registerDrivers(): Promise<RegisteredUser[]> {
  console.log(`  [drivers] registering ${DRIVERS.length} driver auth accounts...`);
  const results: RegisteredUser[] = [];
  for (let i = 0; i < DRIVERS.length; i += 1) {
    const d = DRIVERS[i];
    const user = await registerUser(d.phone, d.firstName, d.lastName, 'DRIVER');
    results.push(user);
    console.log(`    + driver #${i + 1} ${user.phone} (${user.userId.slice(0, 8)}...)`);
  }
  return results;
}

type DriverProfile = { driverId: string; userId: string; pending: boolean };

async function registerDriverProfiles(driverUsers: RegisteredUser[]): Promise<DriverProfile[]> {
  console.log('  [driver-profiles] POST /api/drivers/register for each driver...');
  const profiles: DriverProfile[] = [];
  for (let i = 0; i < driverUsers.length; i += 1) {
    const meta = DRIVERS[i];
    const user = driverUsers[i];
    const expiry = new Date(Date.UTC(meta.license.expiryYear, 11, 31));

    const res = await http<any>('/api/drivers/register', {
      method: 'POST',
      token: user.accessToken,
      body: {
        vehicle: {
          type: meta.vehicle.type,
          brand: meta.vehicle.brand,
          model: meta.vehicle.model,
          plate: meta.vehicle.plate,
          color: meta.vehicle.color,
          year: meta.vehicle.year,
          imageUrl: vehicleImageUrl(meta.vehicle.model, meta.vehicle.type),
        },
        license: {
          class: meta.license.class,
          number: meta.license.number,
          expiryDate: expiry.toISOString(),
        },
      },
    });
    const driver = res?.data?.driver;
    if (!driver?.id) {
      throw new Error(`Driver register response malformed for ${user.phone}: ${JSON.stringify(res)}`);
    }
    profiles.push({ driverId: driver.id, userId: user.userId, pending: !!meta.pending });
    console.log(`    + profile ${meta.vehicle.plate} (${driver.id.slice(0, 8)}...) ${meta.pending ? '[PENDING]' : ''}`);
  }
  return profiles;
}

async function approveDrivers(adminToken: string, profiles: DriverProfile[]) {
  console.log('  [approve] approving non-pending drivers via /api/admin/drivers/:id/approve...');
  for (const p of profiles) {
    if (p.pending) continue;
    await http(`/api/admin/drivers/${p.driverId}/approve`, {
      method: 'POST',
      token: adminToken,
    });
    console.log(`    + approved ${p.driverId.slice(0, 8)}...`);
  }
}

// ─── Wallet top-up ───────────────────────────────────────────────────────────

async function topUpDriverWallet(driverToken: string, phone: string) {
  // Step A — payment-service top-up gateway flow:
  //   /top-up/init creates a WalletTopUpOrder keyed by auth userId, then
  //   /top-up/sandbox-confirm flips it to COMPLETED which (1) credits
  //   payment-service DriverWallet for userId and (2) pings wallet-service
  //   /internal/topup-completed to credit wallet-service ledger (also keyed
  //   by userId). This is what unblocks the driver-service goOnline check
  //   (`/internal/driver/${userId}/can-accept` queries wallet-service).
  const initRes = await http<any>('/api/wallet/top-up/init', {
    method: 'POST',
    token: driverToken,
    body: {
      amount: ACTIVATION_BALANCE,
      provider: 'MOMO',
      returnUrl: 'http://localhost:4001/wallet/top-up/return',
    },
    expectedStatuses: [200, 201],
  });
  const topUpId = initRes?.data?.topUpId || initRes?.data?.id;
  if (!topUpId) {
    throw new Error(`top-up init malformed for ${phone}: ${JSON.stringify(initRes)}`);
  }
  await http('/api/wallet/top-up/sandbox-confirm', {
    method: 'POST',
    token: driverToken,
    body: { topUpId, success: true },
    expectedStatuses: [200, 201],
  });

  // Step B — payment-service driver-profile-keyed top-up:
  //   The ride-accept hook calls payment-service `/api/wallet/driver/:driverId/can-accept-cash`
  //   where :driverId is the driver-service profile id (NOT auth userId).
  //   That row is unaffected by step A (which keys by userId). Calling
  //   POST /api/wallet/top-up uses resolveDriverId(userId) which looks up
  //   the driver profile id and credits THAT row, satisfying the activation
  //   threshold for can-accept-cash.
  await http('/api/wallet/top-up', {
    method: 'POST',
    token: driverToken,
    body: { amount: ACTIVATION_BALANCE },
    expectedStatuses: [200, 201],
  });
}

async function topUpAllDriverWallets(profiles: DriverProfile[], driverUsers: RegisteredUser[]) {
  console.log('  [wallet-topup] activating wallets via /api/wallet/top-up/* ...');
  for (let i = 0; i < profiles.length; i += 1) {
    if (profiles[i].pending) continue;
    const user = driverUsers[i];
    await topUpDriverWallet(user.accessToken, user.phone);
    console.log(`    + wallet activated for ${user.phone} (+${ACTIVATION_BALANCE.toLocaleString('vi-VN')}đ)`);
  }
}

// ─── Driver online + location ────────────────────────────────────────────────

async function setDriverOnline(driverToken: string, lat: number, lng: number) {
  // 1. goOnline (status check + add to geo-index if location already set)
  await http('/api/drivers/me/online', { method: 'POST', token: driverToken });
  // 2. updateLocation (now driver is ONLINE so this works AND adds to geo-index)
  await http('/api/drivers/me/location', {
    method: 'POST',
    token: driverToken,
    body: { lat, lng },
  });
}

async function setApprovedDriversOnline(profiles: DriverProfile[], driverUsers: RegisteredUser[]) {
  console.log('  [drivers-online] going online + setting location...');
  for (let i = 0; i < profiles.length; i += 1) {
    if (profiles[i].pending) continue;
    const user = driverUsers[i];
    const meta = DRIVERS[i];
    await setDriverOnline(user.accessToken, meta.location.lat, meta.location.lng);
    console.log(`    + ${user.phone} online @ (${meta.location.lat}, ${meta.location.lng}) — ${meta.cluster}`);
  }
}

async function setApprovedDriversOffline(profiles: DriverProfile[], driverUsers: RegisteredUser[]) {
  // After rides are seeded, put all drivers OFFLINE so DB is clean.
  // Without this, drivers would appear ONLINE on next login with no active rides,
  // and the matching algorithm would keep dispatching for stale state.
  console.log('  [drivers-offline] setting all approved drivers OFFLINE...');
  let count = 0;
  for (let i = 0; i < profiles.length; i += 1) {
    if (profiles[i].pending) continue;
    const user = driverUsers[i];
    try {
      await http('/api/drivers/me/offline', {
        method: 'POST',
        token: user.accessToken,
        expectedStatuses: [200, 201],
      });
      count += 1;
    } catch (err: any) {
      // Non-fatal — driver may already be offline or endpoint unavailable
      console.log(`    ! could not set ${user.phone} offline: ${err.message?.slice(0, 60)}`);
    }
  }
  console.log(`    → ${count} driver(s) set OFFLINE`);
}

// ─── Ride seed plans ─────────────────────────────────────────────────────────
// 8 CASH completed + 2 MOMO completed + 2 cancelled = 12 rides total
// NO in-progress or FINDING_DRIVER rides — DB must be clean after seed.

type RideSeedPlan = {
  customerIndex: number;
  driverIndex?: number;
  status: 'COMPLETED' | 'CANCELLED';
  vehicleType: 'CAR_4' | 'CAR_7' | 'MOTORBIKE' | 'SCOOTER';
  paymentMethod: 'CASH' | 'MOMO' | 'VNPAY';
  voucherCode?: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  reviewRating?: number;
  cancelReason?: string;
};

const RIDE_PLANS: RideSeedPlan[] = [
  // CASH completed × 8 - cụm Bến Thành 3, Tân Sơn Nhất 3, hỗn hợp 2
  {
    customerIndex: 0, driverIndex: 0, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Cửa Nam Chợ Bến Thành, Q1, TP.HCM', lat: 10.77255, lng: 106.69815 },
    dropoff: { address: 'Saigon Centre, Q1, TP.HCM', lat: 10.77210, lng: 106.70020 },
    reviewRating: 1,
  },
  {
    customerIndex: 1, driverIndex: 1, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Ga Metro Bến Thành, Q1, TP.HCM', lat: 10.77305, lng: 106.69775 },
    dropoff: { address: 'Bưu điện trung tâm, Q1, TP.HCM', lat: 10.78000, lng: 106.69992 },
    reviewRating: 2,
  },
  {
    customerIndex: 2, driverIndex: 2, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Công viên 23/9, Q1, TP.HCM', lat: 10.77095, lng: 106.69710 },
    dropoff: { address: 'Hồ Con Rùa, Q3, TP.HCM', lat: 10.77930, lng: 106.69570 },
    reviewRating: 3,
  },
  {
    customerIndex: 3, driverIndex: 3, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Ga Quốc Nội Tân Sơn Nhất, TP.HCM', lat: 10.81895, lng: 106.65840 },
    dropoff: { address: 'Công viên Hoàng Văn Thụ, Tân Bình', lat: 10.80130, lng: 106.65710 },
    reviewRating: 5,
  },
  {
    customerIndex: 4, driverIndex: 4, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Ga Quốc Tế Tân Sơn Nhất, TP.HCM', lat: 10.81785, lng: 106.66455 },
    dropoff: { address: 'Lăng Cha Cả, Tân Bình', lat: 10.80455, lng: 106.65635 },
    reviewRating: 5,
  },
  {
    customerIndex: 5, driverIndex: 5, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Đường Trường Sơn, Tân Bình', lat: 10.81265, lng: 106.66410 },
    dropoff: { address: 'E.Town Cộng Hòa, Tân Bình', lat: 10.80120, lng: 106.65320 },
    reviewRating: 4,
  },
  {
    customerIndex: 6, driverIndex: 7, status: 'COMPLETED', // SCOOTER PMH
    vehicleType: 'SCOOTER', paymentMethod: 'CASH',
    pickup: { address: 'Phú Mỹ Hưng, Q7', lat: 10.7294, lng: 106.7187 },
    dropoff: { address: 'RMIT Sài Gòn, Q7', lat: 10.7316, lng: 106.7222 },
    reviewRating: 5,
  },
  {
    customerIndex: 7, driverIndex: 8, status: 'COMPLETED', // MOTORBIKE Thủ Đức
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickup: { address: 'Vinhomes Grand Park, Thủ Đức', lat: 10.8434, lng: 106.8287 },
    dropoff: { address: 'Bến xe Miền Đông Mới, Thủ Đức', lat: 10.8412, lng: 106.8098 },
    reviewRating: 5,
  },
  // MOMO completed × 2 - dùng webhook mock để hoàn tất payment
  {
    customerIndex: 8, driverIndex: 6, status: 'COMPLETED', // CAR_7 PMH
    vehicleType: 'CAR_7', paymentMethod: 'MOMO',
    voucherCode: 'WELCOME20',
    pickup: { address: 'Phú Mỹ Hưng, Q7', lat: 10.7294, lng: 106.7187 },
    dropoff: { address: 'Crescent Mall, Q7', lat: 10.7299, lng: 106.7212 },
    reviewRating: 5,
  },
  {
    customerIndex: 9, driverIndex: 9, status: 'COMPLETED', // CAR_4 Thủ Đức
    vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickup: { address: 'Khu đô thị Sala, Thủ Đức', lat: 10.7857, lng: 106.7466 },
    dropoff: { address: 'Bảo tàng TP.HCM, Q1', lat: 10.7773, lng: 106.7008 },
    reviewRating: 4,
  },
  // Cancelled × 2 — hủy trước khi tài xế nhận (free cancel)
  {
    customerIndex: 0, status: 'CANCELLED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Nhà hàng Phở Hòa, Q10', lat: 10.7762, lng: 106.6751 },
    dropoff: { address: 'Chợ Bình Thới, Q11', lat: 10.7688, lng: 106.6573 },
    cancelReason: 'Đặt nhầm chuyến',
  },
  {
    customerIndex: 1, status: 'CANCELLED',
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickup: { address: 'Trường THPT Lê Hồng Phong, Q5', lat: 10.7519, lng: 106.6742 },
    dropoff: { address: 'Công viên Lê Văn Tám, Q1', lat: 10.7838, lng: 106.7013 },
    cancelReason: 'Thay đổi kế hoạch',
  },
  // ─── Khu vực Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp (điểm demo giám khảo) ───
  {
    customerIndex: 10, driverIndex: 12, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Nguyễn Văn Bảo, Phường Hạnh Thông Tây, Gò Vấp, TP.HCM', lat: 10.8180, lng: 106.6635 },
    dropoff: { address: 'Vincom Gò Vấp, Quang Trung, Gò Vấp, TP.HCM', lat: 10.8340, lng: 106.6648 },
    reviewRating: 5,
  },
  {
    customerIndex: 10, driverIndex: 13, status: 'COMPLETED',
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickup: { address: 'Chợ Hạnh Thông Tây, Gò Vấp, TP.HCM', lat: 10.8190, lng: 106.6643 },
    dropoff: { address: 'Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp, TP.HCM', lat: 10.8175, lng: 106.6628 },
    reviewRating: 4,
  },
  {
    customerIndex: 10, driverIndex: 14, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    voucherCode: 'WEEKEND10',
    pickup: { address: 'Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp, TP.HCM', lat: 10.8180, lng: 106.6635 },
    dropoff: { address: 'Bệnh viện Ung Bướu, Nơ Trang Long, Bình Thạnh, TP.HCM', lat: 10.8066, lng: 106.6591 },
    reviewRating: 5,
  },
  {
    customerIndex: 3, driverIndex: 15, status: 'COMPLETED',
    vehicleType: 'CAR_7', paymentMethod: 'CASH',
    pickup: { address: 'Lotte Mart Gò Vấp, TP.HCM', lat: 10.8325, lng: 106.6635 },
    dropoff: { address: 'Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp, TP.HCM', lat: 10.8180, lng: 106.6635 },
    reviewRating: 5,
  },
  {
    customerIndex: 10, status: 'CANCELLED',
    vehicleType: 'SCOOTER', paymentMethod: 'CASH',
    pickup: { address: 'Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp, TP.HCM', lat: 10.8180, lng: 106.6635 },
    dropoff: { address: 'Sân bay Tân Sơn Nhất, TP.HCM', lat: 10.8189, lng: 106.6519 },
    cancelReason: 'Thay đổi kế hoạch',
  },

  // ═══════════════════════════════════════════════════════════════════
  // DISPATCH DEMO RIDES — Xây dựng rating phân biệt cho tài xế Hạnh Thông
  // Mục tiêu sau seed:
  //   0911234583 Pham Van Bao  (CAR_4, 250m từ NVB): rating ~4.8 ★★★★★
  //   0911234585 Le Thi Mai    (CAR_4, 450m từ NVB): rating ~3.5 ★★★½
  //   → Khi book CAR_4 tại NVB: 83 thắng scoring (gần + rating cao) → dispatch first
  //   → Demo từ chối → 85 nhận chuyến thứ 2
  // ═══════════════════════════════════════════════════════════════════

  // 0911234583 (driverIndex 12, CAR_4) — 4 rides thêm: 3×⭐5 + 1×⭐4 → avg 4.8
  {
    customerIndex: 11, driverIndex: 12, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    dropoff: { address: 'Vincom Gò Vấp, 12 Phạm Văn Đồng, Gò Vấp', lat: 10.8340, lng: 106.6648 },
    reviewRating: 5,
  },
  {
    customerIndex: 12, driverIndex: 12, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Chợ Hạnh Thông Tây, Thống Nhất, Gò Vấp', lat: 10.8200, lng: 106.6650 },
    dropoff: { address: 'Lotte Mart Gò Vấp, 242 Nguyễn Văn Lượng', lat: 10.8330, lng: 106.6645 },
    reviewRating: 5,
  },
  {
    customerIndex: 13, driverIndex: 12, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'MOMO',
    pickup: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    dropoff: { address: 'BV Nhân dân Gò Vấp, Nguyễn Kiệm, Gò Vấp', lat: 10.8050, lng: 106.6680 },
    reviewRating: 5,
  },
  {
    customerIndex: 14, driverIndex: 12, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Emart Gò Vấp, 986 Quang Trung, Gò Vấp', lat: 10.8329, lng: 106.6618 },
    dropoff: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    reviewRating: 4,
  },

  // 0911234585 (driverIndex 14, CAR_4) — 3 rides thêm: 1×⭐4 + 1×⭐3 + 1×⭐2 → avg 3.5
  {
    customerIndex: 11, driverIndex: 14, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    dropoff: { address: 'Sân bay Tân Sơn Nhất, Trường Sơn, Tân Bình', lat: 10.8184, lng: 106.6519 },
    reviewRating: 4,
  },
  {
    customerIndex: 12, driverIndex: 14, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Vincom Gò Vấp, 12 Phạm Văn Đồng, Gò Vấp', lat: 10.8340, lng: 106.6648 },
    dropoff: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    reviewRating: 3,
  },
  {
    customerIndex: 13, driverIndex: 14, status: 'COMPLETED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: 'Chợ Hạnh Thông Tây, Thống Nhất, Gò Vấp', lat: 10.8200, lng: 106.6650 },
    dropoff: { address: 'Lotte Mart Gò Vấp, 242 Nguyễn Văn Lượng', lat: 10.8330, lng: 106.6645 },
    reviewRating: 2,
  },

  // 0911234584 (driverIndex 13, MOTORBIKE) — 2 rides ⭐5 → rating 4.7
  {
    customerIndex: 11, driverIndex: 13, status: 'COMPLETED',
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickup: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    dropoff: { address: 'Chợ Hạnh Thông Tây, Thống Nhất, Gò Vấp', lat: 10.8200, lng: 106.6650 },
    reviewRating: 5,
  },
  {
    customerIndex: 14, driverIndex: 13, status: 'COMPLETED',
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickup: { address: 'BV Nhân dân Gò Vấp, Nguyễn Kiệm, Gò Vấp', lat: 10.8050, lng: 106.6680 },
    dropoff: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    reviewRating: 5,
  },

  // 0911234587 (driverIndex 16, SCOOTER) — 2 rides → rating 4.5
  {
    customerIndex: 11, driverIndex: 16, status: 'COMPLETED',
    vehicleType: 'SCOOTER', paymentMethod: 'CASH',
    pickup: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    dropoff: { address: 'Emart Gò Vấp, 986 Quang Trung, Gò Vấp', lat: 10.8329, lng: 106.6618 },
    reviewRating: 5,
  },
  {
    customerIndex: 12, driverIndex: 16, status: 'COMPLETED',
    vehicleType: 'SCOOTER', paymentMethod: 'CASH',
    pickup: { address: 'Vincom Gò Vấp, 12 Phạm Văn Đồng, Gò Vấp', lat: 10.8340, lng: 106.6648 },
    dropoff: { address: 'Chợ Hạnh Thông Tây, Thống Nhất, Gò Vấp', lat: 10.8200, lng: 106.6650 },
    reviewRating: 4,
  },

  // ─── Cancelled thêm để phong phú history ────────────────────────────────
  {
    customerIndex: 11, status: 'CANCELLED',
    vehicleType: 'CAR_4', paymentMethod: 'CASH',
    pickup: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    dropoff: { address: 'Vincom Gò Vấp, 12 Phạm Văn Đồng', lat: 10.8340, lng: 106.6648 },
    cancelReason: 'Đặt nhầm chuyến',
  },
  {
    customerIndex: 12, status: 'CANCELLED',
    vehicleType: 'MOMO', paymentMethod: 'CASH',
    pickup: { address: 'Lotte Mart Gò Vấp, 242 Nguyễn Văn Lượng', lat: 10.8330, lng: 106.6645 },
    dropoff: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    cancelReason: 'Thay đổi kế hoạch',
    vehicleType: 'MOTORBIKE',
  },
];

// ─── Ride lifecycle helpers ──────────────────────────────────────────────────

async function createRideViaCustomer(customer: RegisteredUser, plan: RideSeedPlan): Promise<string> {
  const body: any = {
    pickup: plan.pickup,
    dropoff: plan.dropoff,
    vehicleType: plan.vehicleType,
    paymentMethod: plan.paymentMethod,
  };
  if (plan.voucherCode) body.voucherCode = plan.voucherCode;

  const res = await http<any>('/api/rides', {
    method: 'POST',
    token: customer.accessToken,
    body,
    expectedStatuses: [200, 201],
  });
  const rideId = res?.data?.ride?.id || res?.data?.id;
  if (!rideId) {
    throw new Error(`createRide response malformed: ${JSON.stringify(res)}`);
  }
  return rideId;
}

async function payRideOnlineMock(customer: RegisteredUser, rideId: string, amount: number, provider: 'MOMO' | 'VNPAY') {
  // Step 1 — initiate payment so the gateway / payment-service create a
  // Payment row keyed by rideId (orderId).
  const endpoint = provider === 'MOMO' ? '/api/payments/momo/create' : '/api/payments/vnpay/create';
  await http(endpoint, {
    method: 'POST',
    token: customer.accessToken,
    body: {
      rideId,
      amount,
      returnUrl: 'http://localhost:4000/payment/return',
    },
    expectedStatuses: [200, 201],
  });

  // Step 2 — mark COMPLETED via the IPN endpoints by rideId.
  // handleMomoWebhook only verifies signature when one is provided; we omit
  // signature so the seed deterministically marks the ride COMPLETED without
  // having to fake the partner secret.
  if (provider === 'MOMO') {
    await http('/api/payments/ipn/momo', {
      method: 'POST',
      body: {
        orderId: rideId,
        resultCode: 0,
        transId: `SEED-MOMO-${Date.now()}`,
        message: 'Sandbox seed success',
      },
      expectedStatuses: [200, 201],
    });
  } else {
    await http('/api/payments/ipn/vnpay', {
      method: 'POST',
      body: {
        vnp_TxnRef: rideId.replace(/-/g, '').slice(0, 8),
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_TransactionNo: `SEED-VNPAY-${Date.now()}`,
        vnp_OrderInfo: `PAY_RIDE_${rideId}`,
        orderId: rideId,
      },
      expectedStatuses: [200, 201],
    });
  }
}

async function pollDriverAcceptable(driverToken: string, rideId: string): Promise<boolean> {
  // Driver-service /me/rides/:rideId/accept proxies to ride-service /driver-accept
  // which checks status === FINDING_DRIVER. We poll until ride is in that state.
  for (let i = 0; i < DRIVER_ACCEPT_RETRY_MAX; i += 1) {
    try {
      const res = await http<any>(`/api/rides/${rideId}`, {
        method: 'GET',
        token: driverToken,
      });
      const status = res?.data?.ride?.status;
      if (status === 'FINDING_DRIVER') return true;
      if (status === 'ASSIGNED' || status === 'ACCEPTED') return false; // already taken
    } catch {
      // ignore — keep polling
    }
    await sleep(DRIVER_ACCEPT_RETRY_DELAY_MS);
  }
  return false;
}

async function driverAcceptViaDriverService(driver: RegisteredUser, rideId: string): Promise<boolean> {
  for (let attempt = 1; attempt <= DRIVER_ACCEPT_RETRY_MAX; attempt += 1) {
    try {
      await http(`/api/drivers/me/rides/${rideId}/accept`, {
        method: 'POST',
        token: driver.accessToken,
        expectedStatuses: [200, 201],
      });
      return true;
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('400') || msg.includes('409')) {
        // ride still being matched, retry
        if (attempt < DRIVER_ACCEPT_RETRY_MAX) {
          await sleep(DRIVER_ACCEPT_RETRY_DELAY_MS);
          continue;
        }
      }
      throw err;
    }
  }
  return false;
}

async function rideTransition(driverToken: string, rideId: string, action: 'accept' | 'pickup' | 'start' | 'complete') {
  await http(`/api/rides/${rideId}/${action}`, {
    method: 'POST',
    token: driverToken,
    expectedStatuses: [200, 201],
  });
}

async function customerCancelRide(customer: RegisteredUser, rideId: string, reason: string) {
  await http(`/api/rides/${rideId}/cancel`, {
    method: 'POST',
    token: customer.accessToken,
    body: { reason },
    expectedStatuses: [200, 201],
  });
}

async function submitReview(
  reviewerToken: string,
  rideId: string,
  type: 'CUSTOMER_TO_DRIVER' | 'DRIVER_TO_CUSTOMER',
  revieweeId: string,
  revieweeName: string,
  rating: number,
  comment: string,
) {
  await http('/api/reviews', {
    method: 'POST',
    token: reviewerToken,
    body: { rideId, type, revieweeId, revieweeName, rating, comment },
    expectedStatuses: [200, 201],
  });
}

// ─── Ride seed orchestration ─────────────────────────────────────────────────

type SeededRide = {
  rideId: string;
  status: 'COMPLETED' | 'CANCELLED';
  customerPhone: string;
  driverPhone?: string;
  vehicleType: string;
  paymentMethod: string;
  fare?: number;
};

function reviewCommentForRating(rating: number): string {
  if (rating >= 5) return 'Tài xế chuyên nghiệp, xe sạch, đúng giờ.';
  if (rating === 4) return 'Chuyến đi ổn, tài xế thân thiện.';
  if (rating === 3) return 'Chuyến đi bình thường, không có gì đặc biệt.';
  if (rating === 2) return 'Tài xế đến chậm, chất lượng phục vụ chưa tốt.';
  return 'Trải nghiệm chưa hài lòng, mong cải thiện.';
}

async function seedRides(
  customers: RegisteredUser[],
  drivers: RegisteredUser[],
  driverProfiles: DriverProfile[],
): Promise<SeededRide[]> {
  console.log(`  [rides] orchestrating ${RIDE_PLANS.length} rides via API lifecycle...`);
  const rides: SeededRide[] = [];

  for (let i = 0; i < RIDE_PLANS.length; i += 1) {
    const plan = RIDE_PLANS[i];
    const customer = customers[plan.customerIndex];
    const driverUser = plan.driverIndex !== undefined ? drivers[plan.driverIndex] : undefined;
    const driverProfile = plan.driverIndex !== undefined ? driverProfiles[plan.driverIndex] : undefined;
    const driverMeta = plan.driverIndex !== undefined ? DRIVERS[plan.driverIndex] : undefined;

    console.log(`    [ride ${i + 1}/${RIDE_PLANS.length}] ${plan.status} ${plan.vehicleType} ${plan.paymentMethod}` +
      `${plan.voucherCode ? ` voucher=${plan.voucherCode}` : ''}` +
      ` customer=${customer.phone}${driverUser ? ` driver=${driverUser.phone}` : ''}`);

    let rideId: string;
    try {
      rideId = await createRideViaCustomer(customer, plan);
    } catch (err: any) {
      console.log(`      ! createRide failed: ${err.message?.slice(0, 200)}`);
      continue;
    }

    // For online payment: pay first to push ride into FINDING_DRIVER
    if (plan.paymentMethod === 'MOMO' || plan.paymentMethod === 'VNPAY') {
      await sleep(500);
      // Fetch ride to know fare
      const rideInfo = await http<any>(`/api/rides/${rideId}`, {
        method: 'GET', token: customer.accessToken,
      });
      const fare = Math.round(rideInfo?.data?.ride?.fare || 100_000);
      await payRideOnlineMock(customer, rideId, fare, plan.paymentMethod as 'MOMO' | 'VNPAY');
    }

    if (plan.status === 'CANCELLED') {
      // Wait briefly then cancel
      await sleep(1500);
      await customerCancelRide(customer, rideId, plan.cancelReason || 'Khách hủy');
      rides.push({
        rideId,
        status: 'CANCELLED',
        customerPhone: customer.phone,
        vehicleType: plan.vehicleType,
        paymentMethod: plan.paymentMethod,
      });
      console.log(`      = ride CANCELLED (${plan.cancelReason})`);
      continue;
    }

    // COMPLETED — wait for FINDING_DRIVER, then driver accepts and runs lifecycle
    if (!driverUser || !driverProfile || !driverMeta) {
      console.log(`      ! plan missing driver, skipping`);
      continue;
    }

    await sleep(DELAY_AFTER_RIDE_CREATE_MS);

    // Driver-accept (FINDING_DRIVER → ASSIGNED). Use driver-service which proxies to /driver-accept.
    const accepted = await driverAcceptViaDriverService(driverUser, rideId);
    if (!accepted) {
      console.log(`      ! driver could not accept ride after retries`);
      continue;
    }

    // Then full lifecycle: accept (ASSIGNED → ACCEPTED) → pickup → start → complete
    await rideTransition(driverUser.accessToken, rideId, 'accept');
    await sleep(300);
    await rideTransition(driverUser.accessToken, rideId, 'pickup');
    await sleep(300);
    await rideTransition(driverUser.accessToken, rideId, 'start');
    await sleep(300);
    await rideTransition(driverUser.accessToken, rideId, 'complete');

    // Reviews
    if (plan.reviewRating) {
      await sleep(300);
      try {
        await submitReview(
          customer.accessToken,
          rideId,
          'CUSTOMER_TO_DRIVER',
          driverProfile.driverId,
          `${driverUser.firstName} ${driverUser.lastName}`,
          plan.reviewRating,
          reviewCommentForRating(plan.reviewRating),
        );
      } catch (err: any) {
        console.log(`      ! customer review failed: ${err.message?.slice(0, 120)}`);
      }
      try {
        await submitReview(
          driverUser.accessToken,
          rideId,
          'DRIVER_TO_CUSTOMER',
          customer.userId,
          `${customer.firstName} ${customer.lastName}`,
          5,
          'Khách hàng lịch sự, đúng giờ.',
        );
      } catch (err: any) {
        console.log(`      ! driver review failed: ${err.message?.slice(0, 120)}`);
      }
    }

    // Fetch final fare for report
    let finalFare = 0;
    try {
      const rideInfo = await http<any>(`/api/rides/${rideId}`, { method: 'GET', token: customer.accessToken });
      finalFare = Math.round(rideInfo?.data?.ride?.fare || 0);
    } catch {/* ignore */}

    rides.push({
      rideId,
      status: 'COMPLETED',
      customerPhone: customer.phone,
      driverPhone: driverUser.phone,
      vehicleType: plan.vehicleType,
      paymentMethod: plan.paymentMethod,
      fare: finalFare,
    });
    console.log(`      = ride COMPLETED fare=${finalFare.toLocaleString('vi-VN')}đ`);
  }

  return rides;
}

// ─── Generate seed reference doc ─────────────────────────────────────────────

async function generateSeedReference(
  adminToken: string,
  customers: RegisteredUser[],
  drivers: RegisteredUser[],
  driverProfiles: DriverProfile[],
  rides: SeededRide[],
) {
  console.log('  [report] querying APIs to build seed-accounts-reference.md...');

  // Fetch wallet balance per driver from wallet-service (the canonical ledger
  // keyed by auth userId). GET /api/wallet/balance → wallet-service returns
  // { balance, lockedBalance, availableBalance, status, ... }.
  const driverWallets = new Map<string, number>();
  for (const drv of drivers) {
    try {
      const res = await http<any>('/api/wallet/balance', {
        method: 'GET',
        token: drv.accessToken,
      });
      const balance = Number(res?.data?.balance ?? res?.data?.availableBalance ?? 0);
      driverWallets.set(drv.userId, balance);
    } catch {
      driverWallets.set(drv.userId, 0);
    }
  }

  // Fetch driver list via admin endpoint
  let adminDrivers: any[] = [];
  try {
    const res = await http<any>('/api/admin/drivers?limit=100&offset=0', {
      method: 'GET',
      token: adminToken,
    });
    adminDrivers = res?.data?.drivers || [];
  } catch (err: any) {
    console.log(`    ! admin drivers fetch failed: ${err.message?.slice(0, 80)}`);
  }
  const driverByDriverId = new Map<string, any>(adminDrivers.map((d: any) => [d.id, d]));

  // Fetch vouchers via admin endpoint
  let voucherRows: any[] = [];
  try {
    const res = await http<any>('/api/voucher/admin', { method: 'GET', token: adminToken });
    voucherRows = res?.data?.vouchers || res?.data || [];
    if (!Array.isArray(voucherRows)) voucherRows = [];
  } catch (err: any) {
    console.log(`    ! voucher list fetch failed: ${err.message?.slice(0, 80)}`);
  }

  // Build report
  const lines: string[] = [];
  const generatedAt = new Date();
  lines.push('# Seed Accounts Reference');
  lines.push('');
  lines.push(`> Sinh tự động bởi pure-API seed script (\`scripts/seed-database.ts\`).`);
  lines.push(`> Mọi tài khoản và dữ liệu dưới đây đều được tạo qua API gateway thật, KHÔNG ghi DB trực tiếp.`);
  lines.push(`> Ngoại lệ duy nhất: bootstrap admin user (1 INSERT vào \`auth_db\`).`);
  lines.push('');
  lines.push(`Generated at: ${generatedAt.toLocaleString('vi-VN')}`);
  lines.push('');

  lines.push('## Credentials chung');
  lines.push('');
  lines.push(`- Mật khẩu chung cho mọi tài khoản: \`${SEED_PASSWORD}\``);
  lines.push(`- API Gateway: ${GATEWAY_BASE}`);
  lines.push(`- Customer app: http://localhost:4000`);
  lines.push(`- Driver app: http://localhost:4001`);
  lines.push(`- Admin dashboard: http://localhost:4002`);
  lines.push('');

  lines.push('## Admin');
  lines.push('');
  lines.push(`- Phone: \`${ADMIN.phone}\` — Email: \`${ADMIN.email}\` — Họ tên: \`${ADMIN.firstName} ${ADMIN.lastName}\``);
  lines.push('');

  lines.push('## Customers');
  lines.push('');
  lines.push('| # | Phone | Họ tên | UserId |');
  lines.push('|---|-------|--------|--------|');
  customers.forEach((c, i) => {
    lines.push(`| ${i + 1} | \`${c.phone}\` | ${c.firstName} ${c.lastName} | \`${c.userId}\` |`);
  });
  lines.push('');

  lines.push('## Drivers');
  lines.push('');
  lines.push('Cluster + vehicle + license + vị trí seed. Ví kích hoạt 300.000đ (trừ commission sau ride). Tất cả OFFLINE sau seed — cần bật Online thủ công khi test.');
  lines.push('');
  lines.push('| # | Phone | Họ tên | Cluster | Vehicle | Plate | License | Status | Wallet (đ) | DriverId |');
  lines.push('|---|-------|--------|---------|---------|-------|---------|--------|-----------|----------|');
  drivers.forEach((u, i) => {
    const meta = DRIVERS[i];
    const profile = driverProfiles[i];
    const live = driverByDriverId.get(profile.driverId);
    const status = profile.pending ? 'PENDING' : (live?.status || 'APPROVED');
    const wallet = driverWallets.get(u.userId) || 0;
    lines.push(`| ${i + 1} | \`${u.phone}\` | ${u.firstName} ${u.lastName} | ${meta.cluster} | ${meta.vehicle.brand} ${meta.vehicle.model} (${meta.vehicle.type}) | \`${meta.vehicle.plate}\` | ${meta.license.class} ${meta.license.number} | ${status} | ${wallet.toLocaleString('vi-VN')} | \`${profile.driverId}\` |`);
  });
  lines.push('');

  // Pending drivers
  const pendingDrivers = driverProfiles
    .map((p, i) => ({ p, meta: DRIVERS[i], user: drivers[i] }))
    .filter(({ p }) => p.pending);
  if (pendingDrivers.length > 0) {
    lines.push('## Driver chờ duyệt (cho TC admin approve)');
    lines.push('');
    lines.push('| Phone | Họ tên | Cluster | Vehicle | DriverId |');
    lines.push('|-------|--------|---------|---------|----------|');
    pendingDrivers.forEach(({ p, meta, user }) => {
      lines.push(`| \`${user.phone}\` | ${user.firstName} ${user.lastName} | ${meta.cluster} | ${meta.vehicle.type} ${meta.vehicle.plate} | \`${p.driverId}\` |`);
    });
    lines.push('');
  }

  lines.push('## Cụm tài xế approved');
  lines.push('');
  const clusters = new Map<string, Array<{ phone: string; vehicle: string; plate: string; lat: number; lng: number }>>();
  driverProfiles.forEach((p, i) => {
    if (p.pending) return;
    const meta = DRIVERS[i];
    const u = drivers[i];
    const arr = clusters.get(meta.cluster) || [];
    arr.push({
      phone: u.phone,
      vehicle: `${meta.vehicle.brand} ${meta.vehicle.model}`,
      plate: meta.vehicle.plate,
      lat: meta.location.lat,
      lng: meta.location.lng,
    });
    clusters.set(meta.cluster, arr);
  });
  for (const [name, list] of clusters.entries()) {
    lines.push(`### ${name}`);
    lines.push('');
    lines.push('| Phone | Xe | Plate | Toạ độ |');
    lines.push('|-------|----|-------|---------|');
    for (const d of list) {
      lines.push(`| \`${d.phone}\` | ${d.vehicle} | \`${d.plate}\` | ${d.lat}, ${d.lng} |`);
    }
    lines.push('');
  }

  lines.push('## Vouchers');
  lines.push('');
  lines.push('| Code | Audience | Discount | Min fare | Max discount | UsageLimit | Active |');
  lines.push('|------|----------|----------|----------|--------------|------------|--------|');
  if (voucherRows.length > 0) {
    voucherRows.forEach((v: any) => {
      const discount = v.discountType === 'PERCENT' ? `${v.discountValue}%` : `${Number(v.discountValue).toLocaleString('vi-VN')}đ`;
      lines.push(`| \`${v.code}\` | ${v.audienceType || '—'} | ${discount} | ${v.minFare ? Number(v.minFare).toLocaleString('vi-VN') + 'đ' : '0đ'} | ${v.maxDiscount ? Number(v.maxDiscount).toLocaleString('vi-VN') + 'đ' : '—'} | ${v.usageLimit || '∞'} | ${v.isActive ? '✓' : '✗'} |`);
    });
  } else {
    VOUCHER_SEEDS.forEach((v) => {
      const discount = v.discountType === 'PERCENT' ? `${v.discountValue}%` : `${v.discountValue.toLocaleString('vi-VN')}đ`;
      lines.push(`| \`${v.code}\` | ${v.audienceType} | ${discount} | ${(v.minFare || 0).toLocaleString('vi-VN')}đ | ${'maxDiscount' in v && v.maxDiscount ? Number(v.maxDiscount).toLocaleString('vi-VN') + 'đ' : '—'} | ${v.usageLimit || '∞'} | ${v.isActive ? '✓' : '✗'} |`);
    });
  }
  lines.push('');

  const completedRides = rides.filter(r => r.status === 'COMPLETED');
  const cancelledRides = rides.filter(r => r.status === 'CANCELLED');
  lines.push(`## Rides đã seed (${rides.length} tổng: ${completedRides.length} COMPLETED, ${cancelledRides.length} CANCELLED)`);
  lines.push('');
  lines.push('> Không có ride FINDING_DRIVER hay IN_PROGRESS sau seed. Toàn bộ driver đã OFFLINE.');
  lines.push('');
  lines.push('| # | Status | Vehicle | Payment | Customer | Driver | Fare (đ) | RideId |');
  lines.push('|---|--------|---------|---------|----------|--------|---------|--------|');
  rides.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.status} | ${r.vehicleType} | ${r.paymentMethod} | \`${r.customerPhone}\` | ${r.driverPhone ? '`' + r.driverPhone + '`' : '—'} | ${r.fare ? r.fare.toLocaleString('vi-VN') : '—'} | \`${r.rideId}\` |`);
  });
  lines.push('');

  lines.push('## Incentive rules');
  lines.push('');
  lines.push('| Type | Condition | Reward (đ) | Description |');
  lines.push('|------|-----------|-----------|-------------|');
  for (const r of INCENTIVE_RULES) {
    lines.push(`| ${r.type} | ${r.conditionValue} | ${r.rewardAmount.toLocaleString('vi-VN')} | ${r.description} |`);
  }
  lines.push('');

  fs.writeFileSync(SEED_REFERENCE_OUTPUT, lines.join('\n') + '\n', 'utf8');
  console.log(`  [report] written: ${SEED_REFERENCE_OUTPUT}`);
}

// ─── Wait for services healthy ───────────────────────────────────────────────

async function waitForGateway() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`${GATEWAY_BASE}/health`);
      if (res.ok) return;
    } catch {/* ignore */}
    await sleep(1000);
  }
  throw new Error(`Gateway ${GATEWAY_BASE} not responding`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('');
  console.log('================================================================');
  console.log(' Cab Booking System - Pure-API Database Seeding');
  console.log('================================================================');
  console.log('');

  await waitForGateway();
  console.log('  [pre-flight] gateway healthy');

  // Step 1 — admin DB bootstrap (the ONLY DB-direct write)
  await bootstrapAdmin();

  // Step 2 — admin login via API
  const adminToken = await loginAdmin();

  // Step 3 — vouchers via /api/voucher/admin
  await seedVouchers(adminToken);

  // Step 4 — incentive rules via /api/admin/wallet/incentive-rules
  await seedIncentiveRules(adminToken);

  // Step 5 — register customers via OTP flow
  const customers = await registerCustomers();

  // Step 6 — register drivers via OTP flow (auth users only)
  const driverUsers = await registerDrivers();

  // Step 7 — register driver profiles via /api/drivers/register
  const driverProfiles = await registerDriverProfiles(driverUsers);

  // Step 8 — admin approve non-pending drivers
  await approveDrivers(adminToken, driverProfiles);

  // Step 9 — top-up wallet 300k for approved drivers
  await topUpAllDriverWallets(driverProfiles, driverUsers);

  // Step 10 — drivers go online + set location
  await setApprovedDriversOnline(driverProfiles, driverUsers);

  // Step 11 — orchestrate 12 rides via API (COMPLETED + CANCELLED only)
  const rides = await seedRides(customers, driverUsers, driverProfiles);

  // Step 12 — set all drivers OFFLINE so DB is clean after seed
  await setApprovedDriversOffline(driverProfiles, driverUsers);

  // Step 13 — generate seed-accounts-reference.md
  await generateSeedReference(adminToken, customers, driverUsers, driverProfiles, rides);

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('================================================================');
  console.log(' Seeding completed successfully!');
  console.log('================================================================');
  console.log(`  Elapsed: ${elapsed}s`);
  const completed = rides.filter(r => r.status === 'COMPLETED').length;
  const cancelled = rides.filter(r => r.status === 'CANCELLED').length;
  console.log(`  Customers:    ${customers.length}`);
  console.log(`  Drivers:      ${driverUsers.length} (${driverProfiles.filter(p => !p.pending).length} approved OFFLINE + ${driverProfiles.filter(p => p.pending).length} pending)`);
  console.log(`  Rides:        ${rides.length} (${completed} COMPLETED, ${cancelled} CANCELLED — no active rides)`);
  console.log(`  Vouchers:     ${VOUCHER_SEEDS.length}`);
  console.log(`  IncentiveRules:${INCENTIVE_RULES.length}`);
  console.log(`  Report:       ${SEED_REFERENCE_OUTPUT}`);
  console.log('');
  console.log('  Test credentials:');
  console.log(`    Password: ${SEED_PASSWORD}`);
  console.log(`    Admin: ${ADMIN.phone}`);
  console.log(`    Customer 1: ${customers[0]?.phone}`);
  console.log(`    Driver 1: ${driverUsers[0]?.phone}`);
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error('SEED FAILED:', err);
  if (err?.payload) {
    console.error('Response payload:', JSON.stringify(err.payload, null, 2));
  }
  process.exit(1);
});

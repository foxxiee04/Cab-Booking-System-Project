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
 *      (OTP lấy từ auth-service /api/auth/dev/otp trong mock mode)
 *   6. Đăng ký 15 driver tương tự
 *   7. Mỗi driver: POST /api/drivers/register (vehicle + license)
 *   8. Admin approve 12 driver đầu (3 cuối để PENDING demo flow)
 *   9. Mỗi driver được approve: top-up ví 300k qua /api/wallet/top-up/init
 *      + sandbox-confirm để kích hoạt wallet
 *  10. Mỗi driver được approve: goOnline + updateLocation theo cụm
 *  11. Tạo 12 ride: 8 CASH completed, 2 MOMO completed (mock webhook),
 *      2 CANCELLED — KHÔNG có ride đang diễn ra hay FINDING_DRIVER.
 *  12. Sau khi ride xong, đặt TẤT CẢ driver OFFLINE để DB sạch.
 * 12b. Bring 20 driver online theo cụm (HEATMAP_DRIVER_INDICES) để test heatmap trên admin dashboard.
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
 *   - Toàn bộ backend đang chạy (Docker Compose hoặc Swarm: api-gateway + auth + …)
 *   - Stack đã chạy ổn định (Compose/Swarm). Sau `compose up` có thể cần chờ auth — seed probe ngắn (mặc định ~25s).
 *   - Không muốn chờ: `SEED_SKIP_AUTH_PROXY_WAIT=1`. Máy chậm: `SEED_AUTH_PROXY_WAIT_ATTEMPTS=60`.
 *   - DB đã reset + schema (Compose: reset-database.*; Swarm: PHASE 15–15b trong deploy/SWARM-SETUP.md)
 *   - Sau reset cần restart wallet-service (Compose: docker compose restart wallet-service;
 *     Swarm: script reset-database-swarm.sh đã có bước service update --force)
 *   - Admin-only (chỉ đăng nhập): `npx tsx scripts/bootstrap-admin.ts` (không thay thế full seed)
 */

import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Client as PgClient } from 'pg';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

import { ADMIN, SEED_PASSWORD, bootstrapAdmin } from './bootstrap-admin';

// ─── Second admin (sub-admin) ────────────────────────────────────────────────
// Created via direct insert into auth_db (same pattern as bootstrapAdmin).
// Phone/email distinct from primary admin so both can log in independently.
const ADMIN_2 = {
  phone: '0900000002',
  email: 'admin2@cabbooking.com',
  firstName: 'Sub',
  lastName: 'Admin',
};

// ─── Config ──────────────────────────────────────────────────────────────────

const GATEWAY_BASE = process.env.GATEWAY_BASE_URL || 'http://localhost:3000';
/** Dev OTP is proxied at /api/auth/* on the gateway when OTP_ENABLE_DEV_ENDPOINT is true — same base works for Compose and Swarm. */
const AUTH_INTERNAL_BASE = process.env.AUTH_INTERNAL_URL || GATEWAY_BASE;

const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5433';
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';

const ACTIVATION_BALANCE = 300_000;
const SEED_REFERENCE_OUTPUT = path.resolve(process.cwd(), 'docs', 'seed-accounts-reference.md');

const DELAY_AFTER_RIDE_CREATE_MS = 4_000;
const DRIVER_ACCEPT_RETRY_MAX = 8;
const DRIVER_ACCEPT_RETRY_DELAY_MS = 2_000;

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

/** Resolve a running Redis task (Compose vs Swarm naming). */
function resolveRedisContainerId(): string {
  const custom = process.env.REDIS_DOCKER_PS_FILTERS?.trim();
  const filters = (custom ? custom.split(',') : ['cab-redis', 'cab-booking_redis'])
    .map((s) => s.trim())
    .filter(Boolean);
  for (const name of filters) {
    const r = spawnSync('docker', ['ps', '-q', '-f', `name=${name}`], {
      encoding: 'utf8',
    });
    if (r.status !== 0 || !r.stdout) continue;
    const id = r.stdout
      .split(/\r?\n/)
      .map((k) => k.trim())
      .filter(Boolean)[0];
    if (id) return id;
  }
  return '';
}

function clearOtpRateLimits(silent = false) {
  try {
    const containerId = resolveRedisContainerId();
    if (!containerId) return;
    const redisPw = (
      process.env.REDIS_CLI_PASSWORD ||
      process.env.REDIS_PASSWORD ||
      ''
    ).trim();
    const execArgsBase = ['exec', containerId, 'redis-cli'];
    if (redisPw) {
      execArgsBase.push('-a', redisPw);
    }
    const scan = spawnSync('docker', [...execArgsBase, '--scan', '--pattern', 'otp:rate:*'], {
      encoding: 'utf8',
    });
    if (scan.status !== 0) return;
    const keys = (scan.stdout || '').split(/\r?\n/).map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) return;
    spawnSync('docker', [...execArgsBase, 'DEL', ...keys], { stdio: 'pipe' });
    if (!silent) {
      console.log(`    [redis] cleared ${keys.length} OTP rate-limit key(s)`);
    }
  } catch {
    // docker not available — assume rate limits are configured generously
  }
}

// ─── OTP fetch via auth-service dev endpoint ─────────────────────────────────

async function fetchOtp(phone: string, purpose = 'register'): Promise<string> {
  const data = await http<{ success: boolean; otp: string }>(
    `/api/auth/dev/otp?phone=${encodeURIComponent(phone)}&purpose=${purpose}`,
    {
      baseUrl: AUTH_INTERNAL_BASE,
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

// Second admin uses the same direct-insert pattern as bootstrapAdmin.
// Kept inline here (not in bootstrap-admin.ts) so the primary bootstrap script
// remains a single-admin tool; the seed creates an additional admin for tests.
async function bootstrapSecondAdmin(): Promise<void> {
  const clientModulePath = path.resolve(
    process.cwd(), 'services', 'auth-service', 'src', 'generated', 'prisma-client',
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require(clientModulePath);
  const url = `postgresql://${POSTGRES_USER}:${encodeURIComponent(POSTGRES_PASSWORD)}@${POSTGRES_HOST}:${POSTGRES_PORT}/auth_db`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);
    await prisma.user.upsert({
      where: { phone: ADMIN_2.phone },
      update: {
        email: ADMIN_2.email, role: 'ADMIN', status: 'ACTIVE',
        firstName: ADMIN_2.firstName, lastName: ADMIN_2.lastName, passwordHash,
      },
      create: {
        phone: ADMIN_2.phone, email: ADMIN_2.email, role: 'ADMIN', status: 'ACTIVE',
        firstName: ADMIN_2.firstName, lastName: ADMIN_2.lastName, passwordHash,
      },
    });
    console.log(`  [auth] second admin upserted — phone=${ADMIN_2.phone}`);
  } finally {
    await prisma.$disconnect();
  }
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
  const maxAttempts = Number(process.env.SEED_INCENTIVE_RULE_ATTEMPTS || '20');
  const pauseMs = Number(process.env.SEED_INCENTIVE_RULE_RETRY_MS || '2000');

  for (const rule of INCENTIVE_RULES) {
    let ok = false;
    for (let attempt = 1; attempt <= maxAttempts && !ok; attempt += 1) {
      try {
        await http('/api/admin/wallet/incentive-rules', {
          method: 'POST',
          token: adminToken,
          body: rule,
        });
        console.log(`    + ${rule.type} (${rule.conditionValue}) → ${rule.rewardAmount}đ`);
        ok = true;
      } catch (err: any) {
        const st = err?.status;
        const retryable = st === 502 || st === 503 || st === 504;
        if (retryable && attempt < maxAttempts) {
          if (attempt === 1) {
            console.log(`    … ${rule.type}: gateway/upstream ${st}, chờ wallet-service (${maxAttempts} lần tối đa)…`);
          }
          await sleep(pauseMs);
          continue;
        }
        console.log(`    ! incentive rule ${rule.type} skipped: ${err.message?.slice(0, 120)}`);
        break;
      }
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

/**
 * Build a deterministic seed email so every seeded account has a unique,
 * predictable login email. Pattern: `${role}.${phoneWithoutLeadingZero}@cabbooking.test`
 * e.g. driver.911234561@cabbooking.test / customer.901234561@cabbooking.test.
 */
function deriveSeedEmail(phone: string, role: 'CUSTOMER' | 'DRIVER'): string {
  const normalized = phone.replace(/^0/, '');
  return `${role.toLowerCase()}.${normalized}@cabbooking.test`;
}

// Write email directly to auth_db — registration flow does not accept email,
// so we bypass the API and update the row after creation.
async function writeEmailToAuthDb(userId: string, email: string): Promise<void> {
  const client = new PgClient({
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT, 10),
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: 'auth_db',
  });
  await client.connect();
  try {
    await client.query('UPDATE users SET email = $1 WHERE id = $2', [email, userId]);
  } finally {
    await client.end();
  }
}

async function registerUser(
  phone: string,
  firstName: string,
  lastName: string,
  role: 'CUSTOMER' | 'DRIVER',
  emailOverride?: string,
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

  // Step 4: complete registration — email not part of registration flow, set via DB below
  const email = emailOverride || deriveSeedEmail(phone, role);
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

  // Write email directly to auth_db since registration flow doesn't accept it
  await writeEmailToAuthDb(user.id, email);

  return {
    userId: user.id,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    phone: user.phone,
    firstName: user.firstName || firstName,
    lastName: user.lastName || lastName,
    email,
  };
}

// ─── Customer seed list ──────────────────────────────────────────────────────

const CUSTOMERS = [
  // ── Core customers (original 15) ─────────────────────────────────────────
  { phone: '0901234561', firstName: 'Nguyen', lastName: 'Van An' },
  { phone: '0901234562', firstName: 'Tran', lastName: 'Thi Bao' },
  { phone: '0901234563', firstName: 'Le', lastName: 'Van Cuong' },
  { phone: '0901234564', firstName: 'Pham', lastName: 'Minh Duc' },
  { phone: '0901234565', firstName: 'Hoang', lastName: 'Van Em' },
  { phone: '0901234566', firstName: 'Dang', lastName: 'Thi Phuong' },
  { phone: '0901234567', firstName: 'Vu', lastName: 'Minh Giang' },
  { phone: '0901234568', firstName: 'Bui', lastName: 'Thi Ha' },
  { phone: '0901234569', firstName: 'Ngo', lastName: 'Van Hung' },
  { phone: '0901234570', firstName: 'Dinh', lastName: 'Thi Lan' },
  // Index 10 = customer demo dùng trong docs/test-scenarios.md (DO NOT REORDER)
  { phone: '0901234571', firstName: 'Nguyen', lastName: 'Thi Demo' },
  { phone: '0901999001', firstName: 'Phuong', lastName: 'Nguyen Mai' },
  { phone: '0901999002', firstName: 'Khoa', lastName: 'Tran Nam' },
  { phone: '0901999003', firstName: 'Linh', lastName: 'Le Oanh' },
  { phone: '0901999004', firstName: 'Minh', lastName: 'Pham Phat' },
  // ── Extended customers for richer analytics ───────────────────────────────
  { phone: '0902111001', firstName: 'Hoa', lastName: 'Nguyen Quynh' },
  { phone: '0902111002', firstName: 'Thanh', lastName: 'Tran Rong' },
  { phone: '0902111003', firstName: 'Hieu', lastName: 'Le Sang' },
  { phone: '0902111004', firstName: 'Tuan', lastName: 'Pham Tam' },
  { phone: '0902111005', firstName: 'Kim', lastName: 'Hoang Uyen' },
  { phone: '0902111006', firstName: 'Hung', lastName: 'Dang Van' },
  { phone: '0902111007', firstName: 'Thu', lastName: 'Vu Xuan' },
  { phone: '0902111008', firstName: 'Long', lastName: 'Bui Yen' },
  { phone: '0902111009', firstName: 'Mai', lastName: 'Ngo Anh' },
  { phone: '0902111010', firstName: 'Huy', lastName: 'Dinh Bac' },
  { phone: '0902222001', firstName: 'Linh', lastName: 'Cao Cam' },
  { phone: '0902222002', firstName: 'Nam', lastName: 'Mai Dan' },
  { phone: '0902222003', firstName: 'Yen', lastName: 'Ly Em' },
  { phone: '0902222004', firstName: 'Son', lastName: 'Do Gam' },
  { phone: '0902222005', firstName: 'Ha', lastName: 'Trang Hoa' },
  { phone: '0902222006', firstName: 'Kien', lastName: 'Nhat Huong' },
  { phone: '0902222007', firstName: 'Van', lastName: 'Quoc Khoi' },
  { phone: '0902222008', firstName: 'Lan', lastName: 'Bich Linh' },
  { phone: '0902222009', firstName: 'Duc', lastName: 'Hai Minh' },
  { phone: '0902222010', firstName: 'Quynh', lastName: 'Anh Ngoc' },
  // ── Bulk customers (35 → 100) — phục vụ Top Customers chart + analytics ─────
  { phone: '0903100001', firstName: 'An',    lastName: 'Tran Phuc' },
  { phone: '0903100002', firstName: 'Bao',   lastName: 'Le Hoang' },
  { phone: '0903100003', firstName: 'Cuong', lastName: 'Nguyen Tien' },
  { phone: '0903100004', firstName: 'Dat',   lastName: 'Pham Cong' },
  { phone: '0903100005', firstName: 'Em',    lastName: 'Hoang Lan' },
  { phone: '0903100006', firstName: 'Phong', lastName: 'Vu Tan' },
  { phone: '0903100007', firstName: 'Giang', lastName: 'Bui Truc' },
  { phone: '0903100008', firstName: 'Hoa',   lastName: 'Dang My' },
  { phone: '0903100009', firstName: 'Hieu',  lastName: 'Vo Quang' },
  { phone: '0903100010', firstName: 'Khanh', lastName: 'Le Thanh' },
  { phone: '0903100011', firstName: 'Linh',  lastName: 'Pham Thuy' },
  { phone: '0903100012', firstName: 'Mai',   lastName: 'Tran Phuong' },
  { phone: '0903100013', firstName: 'Nam',   lastName: 'Nguyen Quoc' },
  { phone: '0903100014', firstName: 'Oanh',  lastName: 'Le Bich' },
  { phone: '0903100015', firstName: 'Phat',  lastName: 'Hoang Minh' },
  { phone: '0903100016', firstName: 'Quan',  lastName: 'Vu Bao' },
  { phone: '0903100017', firstName: 'Rang',  lastName: 'Bui Quynh' },
  { phone: '0903100018', firstName: 'Son',   lastName: 'Dinh Cong' },
  { phone: '0903100019', firstName: 'Tam',   lastName: 'Pham Hieu' },
  { phone: '0903100020', firstName: 'Uyen',  lastName: 'Tran Kim' },
  { phone: '0903200001', firstName: 'Vinh',  lastName: 'Le Quang' },
  { phone: '0903200002', firstName: 'Xuan',  lastName: 'Nguyen Tu' },
  { phone: '0903200003', firstName: 'Yen',   lastName: 'Hoang Bich' },
  { phone: '0903200004', firstName: 'Anh',   lastName: 'Bui Tuan' },
  { phone: '0903200005', firstName: 'Binh',  lastName: 'Vu Thanh' },
  { phone: '0903200006', firstName: 'Cam',   lastName: 'Tran Ngoc' },
  { phone: '0903200007', firstName: 'Diep',  lastName: 'Le Anh' },
  { phone: '0903200008', firstName: 'Phuoc', lastName: 'Pham Van' },
  { phone: '0903200009', firstName: 'Gia',   lastName: 'Nguyen Han' },
  { phone: '0903200010', firstName: 'Huong', lastName: 'Hoang Mai' },
  { phone: '0903200011', firstName: 'Khang', lastName: 'Vu Cuong' },
  { phone: '0903200012', firstName: 'Linh',  lastName: 'Tran Tu' },
  { phone: '0903200013', firstName: 'Minh',  lastName: 'Le Dinh' },
  { phone: '0903200014', firstName: 'Ngan',  lastName: 'Pham Hoa' },
  { phone: '0903200015', firstName: 'Phu',   lastName: 'Bui Quoc' },
  { phone: '0903200016', firstName: 'Quy',   lastName: 'Dinh Lan' },
  { phone: '0903200017', firstName: 'Rieng', lastName: 'Hoang Diep' },
  { phone: '0903200018', firstName: 'Sang',  lastName: 'Vo Hoang' },
  { phone: '0903200019', firstName: 'Tu',    lastName: 'Le Phuong' },
  { phone: '0903200020', firstName: 'Vu',    lastName: 'Pham Bao' },
  { phone: '0903300001', firstName: 'Y',     lastName: 'Tran Linh' },
  { phone: '0903300002', firstName: 'Tien',  lastName: 'Nguyen Bao' },
  { phone: '0903300003', firstName: 'Huy',   lastName: 'Vu Quoc' },
  { phone: '0903300004', firstName: 'Loc',   lastName: 'Bui Phuc' },
  { phone: '0903300005', firstName: 'Khoa',  lastName: 'Le Van' },
  { phone: '0903300006', firstName: 'Trung', lastName: 'Hoang Anh' },
  { phone: '0903300007', firstName: 'Hau',   lastName: 'Pham Tien' },
  { phone: '0903300008', firstName: 'Kien',  lastName: 'Vo Cong' },
  { phone: '0903300009', firstName: 'Kha',   lastName: 'Tran Bich' },
  { phone: '0903300010', firstName: 'Loi',   lastName: 'Nguyen Phuc' },
  { phone: '0903300011', firstName: 'Trang', lastName: 'Le Mai' },
  { phone: '0903300012', firstName: 'Bich',  lastName: 'Pham Linh' },
  { phone: '0903300013', firstName: 'Cuong', lastName: 'Hoang Bao' },
  { phone: '0903300014', firstName: 'Tan',   lastName: 'Vu Long' },
  { phone: '0903300015', firstName: 'Hai',   lastName: 'Bui Yen' },
  { phone: '0903300016', firstName: 'Hung',  lastName: 'Tran Manh' },
  { phone: '0903300017', firstName: 'Hai',   lastName: 'Le Quynh' },
  { phone: '0903300018', firstName: 'Trinh', lastName: 'Pham My' },
  { phone: '0903300019', firstName: 'Hieu',  lastName: 'Nguyen Anh' },
  { phone: '0903300020', firstName: 'Tu',    lastName: 'Hoang Linh' },
  { phone: '0903400001', firstName: 'Trung', lastName: 'Vu Bao' },
  { phone: '0903400002', firstName: 'Long',  lastName: 'Bui Hieu' },
  { phone: '0903400003', firstName: 'Diep',  lastName: 'Tran Hoang' },
  { phone: '0903400004', firstName: 'Tinh',  lastName: 'Le Nam' },
  { phone: '0903400005', firstName: 'Ha',    lastName: 'Pham Quynh' },
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
  // ── Extended approved drivers ─────────────────────────────────────────────
  {
    phone: '0912100001', firstName: 'Nguyen', lastName: 'Thanh Long',
    cluster: 'Quận 3',
    location: { lat: 10.7780, lng: 106.6930 },
    vehicle: { type: 'CAR_4', brand: 'Kia', model: 'Seltos', plate: '51A-301.11', color: 'White', year: 2023 },
    license: { class: 'B', number: '200000000001', expiryYear: 2028 },
  },
  {
    phone: '0912100002', firstName: 'Tran', lastName: 'Van Khoa',
    cluster: 'Quận 7',
    location: { lat: 10.7320, lng: 106.7200 },
    vehicle: { type: 'SCOOTER', brand: 'Yamaha', model: 'Grande', plate: '59XA-302.22', color: 'Blue', year: 2024 },
    license: { class: 'A1', number: '200000000002', expiryYear: 2029 },
  },
  {
    phone: '0912100003', firstName: 'Le', lastName: 'Thi Thuy',
    cluster: 'Bình Thạnh',
    location: { lat: 10.7950, lng: 106.7210 },
    vehicle: { type: 'CAR_4', brand: 'Honda', model: 'City', plate: '51B-303.33', color: 'Silver', year: 2022 },
    license: { class: 'B', number: '200000000003', expiryYear: 2028 },
  },
  {
    phone: '0912100004', firstName: 'Pham', lastName: 'Quoc Bao',
    cluster: 'Tân Bình',
    location: { lat: 10.8030, lng: 106.6510 },
    vehicle: { type: 'MOTORBIKE', brand: 'Honda', model: 'Blade', plate: '59AC-304.44', color: 'Red', year: 2023 },
    license: { class: 'A1', number: '200000000004', expiryYear: 2029 },
  },
  {
    phone: '0912100005', firstName: 'Hoang', lastName: 'Minh Tri',
    cluster: 'Quận 10',
    location: { lat: 10.7730, lng: 106.6600 },
    vehicle: { type: 'CAR_4', brand: 'Toyota', model: 'Corolla Altis', plate: '51C-305.55', color: 'Black', year: 2021 },
    license: { class: 'B', number: '200000000005', expiryYear: 2027 },
  },
  {
    phone: '0912100006', firstName: 'Dang', lastName: 'Van Hau',
    cluster: 'Quận 5',
    location: { lat: 10.7550, lng: 106.6680 },
    vehicle: { type: 'CAR_7', brand: 'Mitsubishi', model: 'Xpander', plate: '51D-306.66', color: 'Gray', year: 2023 },
    license: { class: 'D2', number: '200000000006', expiryYear: 2028 },
  },
  {
    phone: '0912100007', firstName: 'Vu', lastName: 'Thi Kim',
    cluster: 'Bình Tân',
    location: { lat: 10.7510, lng: 106.6140 },
    vehicle: { type: 'SCOOTER', brand: 'Honda', model: 'Air Blade', plate: '59XB-307.77', color: 'White', year: 2024 },
    license: { class: 'A1', number: '200000000007', expiryYear: 2029 },
  },
  {
    phone: '0912100008', firstName: 'Bui', lastName: 'Xuan Hai',
    cluster: 'Thủ Đức',
    location: { lat: 10.8500, lng: 106.7730 },
    vehicle: { type: 'CAR_4', brand: 'Mazda', model: 'Mazda3', plate: '51E-308.88', color: 'Blue', year: 2023 },
    license: { class: 'B', number: '200000000008', expiryYear: 2029 },
  },
  // ── Bulk approved drivers (28 → 37) — phục vụ Top Drivers + heatmap ────────
  {
    phone: '0913100001', firstName: 'Tran', lastName: 'Quoc Tien',
    cluster: 'Quận 4',
    location: { lat: 10.7585, lng: 106.7050 },
    vehicle: { type: 'MOTORBIKE', brand: 'Yamaha', model: 'Sirius', plate: '59AC-401.11', color: 'Red', year: 2023 },
    license: { class: 'A1', number: '300000000001', expiryYear: 2029 },
  },
  {
    phone: '0913100002', firstName: 'Le', lastName: 'Hoang Anh',
    cluster: 'Quận 8',
    location: { lat: 10.7440, lng: 106.6840 },
    vehicle: { type: 'CAR_4', brand: 'Hyundai', model: 'Accent', plate: '51F-402.22', color: 'White', year: 2024 },
    license: { class: 'B', number: '300000000002', expiryYear: 2029 },
  },
  {
    phone: '0913100003', firstName: 'Pham', lastName: 'Trung Hieu',
    cluster: 'Bình Thạnh',
    location: { lat: 10.8035, lng: 106.7095 },
    vehicle: { type: 'SCOOTER', brand: 'Honda', model: 'SH Mode', plate: '59XB-403.33', color: 'Silver', year: 2024 },
    license: { class: 'A1', number: '300000000003', expiryYear: 2029 },
  },
  {
    phone: '0913100004', firstName: 'Nguyen', lastName: 'Thi Hong',
    cluster: 'Phú Nhuận',
    location: { lat: 10.7990, lng: 106.6810 },
    vehicle: { type: 'CAR_4', brand: 'Toyota', model: 'Vios', plate: '51G-404.44', color: 'Black', year: 2022 },
    license: { class: 'B', number: '300000000004', expiryYear: 2028 },
  },
  {
    phone: '0913100005', firstName: 'Hoang', lastName: 'Van Quy',
    cluster: 'Gò Vấp',
    location: { lat: 10.8385, lng: 106.6720 },
    vehicle: { type: 'MOTORBIKE', brand: 'Honda', model: 'Future', plate: '59AC-405.55', color: 'Blue', year: 2023 },
    license: { class: 'A1', number: '300000000005', expiryYear: 2029 },
  },
  {
    phone: '0913100006', firstName: 'Vu', lastName: 'Thi Hanh',
    cluster: 'Quận 6',
    location: { lat: 10.7470, lng: 106.6360 },
    vehicle: { type: 'CAR_7', brand: 'Toyota', model: 'Innova', plate: '51H-406.66', color: 'Gray', year: 2023 },
    license: { class: 'D2', number: '300000000006', expiryYear: 2028 },
  },
  {
    phone: '0913100007', firstName: 'Bui', lastName: 'Quoc Trung',
    cluster: 'Quận 12',
    location: { lat: 10.8650, lng: 106.6510 },
    vehicle: { type: 'CAR_4', brand: 'Kia', model: 'Cerato', plate: '51K-407.77', color: 'White', year: 2023 },
    license: { class: 'B', number: '300000000007', expiryYear: 2029 },
  },
  {
    phone: '0913100008', firstName: 'Dang', lastName: 'Minh Hoang',
    cluster: 'Quận 11',
    location: { lat: 10.7635, lng: 106.6530 },
    vehicle: { type: 'SCOOTER', brand: 'Yamaha', model: 'Janus', plate: '59XB-408.88', color: 'Black', year: 2024 },
    license: { class: 'A1', number: '300000000008', expiryYear: 2029 },
  },
  {
    phone: '0913100009', firstName: 'Cao', lastName: 'Thi Bich',
    cluster: 'Tân Phú',
    location: { lat: 10.7900, lng: 106.6280 },
    vehicle: { type: 'MOTORBIKE', brand: 'Honda', model: 'Wave RSX', plate: '59AC-409.99', color: 'Red', year: 2023 },
    license: { class: 'A1', number: '300000000009', expiryYear: 2029 },
  },
  {
    phone: '0913100010', firstName: 'Mai', lastName: 'Quoc Phong',
    cluster: 'Bình Tân',
    location: { lat: 10.7480, lng: 106.6120 },
    vehicle: { type: 'CAR_4', brand: 'Honda', model: 'City', plate: '51L-410.10', color: 'Silver', year: 2023 },
    license: { class: 'B', number: '300000000010', expiryYear: 2029 },
  },
  {
    phone: '0913100011', firstName: 'Vo', lastName: 'Thanh Hung',
    cluster: 'Quận 9',
    location: { lat: 10.8420, lng: 106.7960 },
    vehicle: { type: 'SCOOTER', brand: 'Honda', model: 'Lead', plate: '59XB-411.11', color: 'White', year: 2024 },
    license: { class: 'A1', number: '300000000011', expiryYear: 2029 },
  },
  {
    phone: '0913100012', firstName: 'Phan', lastName: 'Thi Loan',
    cluster: 'Quận 2',
    location: { lat: 10.7920, lng: 106.7480 },
    vehicle: { type: 'CAR_7', brand: 'Toyota', model: 'Fortuner', plate: '51M-412.12', color: 'Black', year: 2022 },
    license: { class: 'D2', number: '300000000012', expiryYear: 2028 },
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

// 20 driver indices to keep ONLINE after seed — spread across clusters for heatmap testing.
// Selected to give clear hotspot clusters when viewed on the heatmap (admin dashboard).
const HEATMAP_DRIVER_INDICES = [
  0, 1, 2, 10,   // Bến Thành / Q1  (4 drivers — hottest zone)
  3, 4, 5,        // Tân Sơn Nhất   (3)
  12, 13, 16,     // Gò Vấp / Hạnh Thông (3)
  6, 18,          // Phú Mỹ Hưng / Q7    (2)
  8, 35,          // Thủ Đức / Quận 9    (2)
  19, 27,         // Bình Thạnh          (2)
  17, 28,         // Quận 3 / Phú Nhuận  (2)
  22, 23,         // Quận 5 + Bình Tân   (2)
];

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

async function bringHeatmapDriversOnline(profiles: DriverProfile[], driverUsers: RegisteredUser[]) {
  console.log(`  [heatmap] bringing ${HEATMAP_DRIVER_INDICES.length} drivers online across clusters...`);
  for (const idx of HEATMAP_DRIVER_INDICES) {
    if (!profiles[idx] || profiles[idx].pending) continue;
    const user = driverUsers[idx];
    const meta = DRIVERS[idx];
    await setDriverOnline(user.accessToken, meta.location.lat, meta.location.lng);
    console.log(`    + ${user.phone} online @ (${meta.location.lat}, ${meta.location.lng}) — ${meta.cluster}`);
  }
  console.log(`    → ${HEATMAP_DRIVER_INDICES.length} heatmap drivers ONLINE`);
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
    vehicleType: 'MOTORBIKE', paymentMethod: 'CASH',
    pickup: { address: 'Lotte Mart Gò Vấp, 242 Nguyễn Văn Lượng', lat: 10.8330, lng: 106.6645 },
    dropoff: { address: '295 Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp', lat: 10.8158, lng: 106.6636 },
    cancelReason: 'Thay đổi kế hoạch',
  },
];

// Auto-generated ride plan pool was removed: with hybrid seeding (live API ~30
// + DB historical ~370 = ~400 total), the historical pass is the source of
// data richness. Live API rides are limited to RIDE_PLANS (handcrafted demo
// flows for docs/test-scenarios.md) so the seed runs in ~3 min instead of
// ~30 min. Historical rides reuse HIST_PICKUP_ADDRS below.

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
        vnp_Amount: String(amount * 100), // VNPay sends amount × 100; required for amount check
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
  extraPlans: RideSeedPlan[] = [],
): Promise<SeededRide[]> {
  const allPlans = [...RIDE_PLANS, ...extraPlans];
  console.log(`  [rides] orchestrating ${allPlans.length} rides (${RIDE_PLANS.length} core + ${extraPlans.length} auto) via API lifecycle...`);
  const rides: SeededRide[] = [];

  for (let i = 0; i < allPlans.length; i += 1) {
    const plan = allPlans[i];
    const customer = customers[plan.customerIndex];
    const driverUser = plan.driverIndex !== undefined ? drivers[plan.driverIndex] : undefined;
    const driverProfile = plan.driverIndex !== undefined ? driverProfiles[plan.driverIndex] : undefined;
    const driverMeta = plan.driverIndex !== undefined ? DRIVERS[plan.driverIndex] : undefined;

    console.log(`    [ride ${i + 1}/${allPlans.length}] ${plan.status} ${plan.vehicleType} ${plan.paymentMethod}` +
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
  lines.push(`- Phone: \`${ADMIN_2.phone}\` — Email: \`${ADMIN_2.email}\` — Họ tên: \`${ADMIN_2.firstName} ${ADMIN_2.lastName}\``);
  lines.push('');

  lines.push('## Customers');
  lines.push('');
  lines.push('| # | Phone | Email | Họ tên | UserId |');
  lines.push('|---|-------|-------|--------|--------|');
  customers.forEach((c, i) => {
    lines.push(`| ${i + 1} | \`${c.phone}\` | \`${c.email || ''}\` | ${c.firstName} ${c.lastName} | \`${c.userId}\` |`);
  });
  lines.push('');

  lines.push('## Drivers');
  lines.push('');
  lines.push('Cluster + vehicle + license + vị trí seed. Ví kích hoạt 300.000đ (trừ commission sau ride). Tất cả OFFLINE sau seed — cần bật Online thủ công khi test.');
  lines.push('');
  lines.push('| # | Phone | Email | Họ tên | Cluster | Vehicle | Plate | License | Status | Wallet (đ) | DriverId |');
  lines.push('|---|-------|-------|--------|---------|---------|-------|---------|--------|-----------|----------|');
  drivers.forEach((u, i) => {
    const meta = DRIVERS[i];
    const profile = driverProfiles[i];
    const live = driverByDriverId.get(profile.driverId);
    const status = profile.pending ? 'PENDING' : (live?.status || 'APPROVED');
    const wallet = driverWallets.get(u.userId) || 0;
    lines.push(`| ${i + 1} | \`${u.phone}\` | \`${u.email || ''}\` | ${u.firstName} ${u.lastName} | ${meta.cluster} | ${meta.vehicle.brand} ${meta.vehicle.model} (${meta.vehicle.type}) | \`${meta.vehicle.plate}\` | ${meta.license.class} ${meta.license.number} | ${status} | ${wallet.toLocaleString('vi-VN')} | \`${profile.driverId}\` |`);
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

// ─── Historical wallet earnings seed (direct wallet_db only) ─────────────────
// Only inserts WalletTransaction records into wallet_db (wallet-service).
// Does NOT touch ride_db or payment_db — those data must go through the API flow.
// This gives the driver earnings dashboard meaningful weekly chart data.

function pgConnect(database: string): PgClient {
  return new PgClient({
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT, 10),
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database,
  });
}

const HIST_PICKUP_ADDRS = [
  { address: 'Chợ Bến Thành, Quận 1, TP.HCM',              lat: 10.7726, lng: 106.6980 },
  { address: 'Phố đi bộ Nguyễn Huệ, Quận 1, TP.HCM',       lat: 10.7745, lng: 106.7024 },
  { address: 'Landmark 81, Bình Thạnh, TP.HCM',             lat: 10.7949, lng: 106.7219 },
  { address: 'Sân bay Tân Sơn Nhất, Tân Bình, TP.HCM',      lat: 10.8185, lng: 106.6588 },
  { address: 'Đại học Bách Khoa, Quận 10, TP.HCM',          lat: 10.7726, lng: 106.6594 },
  { address: 'Phú Mỹ Hưng, Quận 7, TP.HCM',                lat: 10.7328, lng: 106.7218 },
  { address: 'Giga Mall, Thủ Đức, TP.HCM',                  lat: 10.8495, lng: 106.7718 },
  { address: 'AEON Mall Bình Tân, TP.HCM',                  lat: 10.7523, lng: 106.6135 },
  { address: 'Nguyễn Văn Bảo, Hạnh Thông Tây, Gò Vấp',     lat: 10.8180, lng: 106.6635 },
  { address: 'Vincom Gò Vấp, Quang Trung, Gò Vấp',          lat: 10.8340, lng: 106.6648 },
  { address: 'Lotte Mart Gò Vấp, TP.HCM',                   lat: 10.8378, lng: 106.6697 },
  { address: 'Vinhomes Grand Park, Quận 9, TP.HCM',         lat: 10.8145, lng: 106.8302 },
  { address: 'Royal City, Quận 3, TP.HCM',                  lat: 10.7784, lng: 106.6928 },
];

const HIST_PAYMENT_METHODS_WEIGHTED = [
  'CASH', 'CASH', 'CASH', 'CASH',  // 40%
  'MOMO', 'MOMO',                  // 20%
  'VNPAY', 'VNPAY',                // 20%
  'WALLET', 'CARD',                // 20%
];

const HIST_VEHICLE_TYPES_WEIGHTED = [
  'MOTORBIKE', 'MOTORBIKE', 'MOTORBIKE',
  'SCOOTER', 'SCOOTER',
  'CAR_4', 'CAR_4',
  'CAR_7',
];

const HIST_FARE_BY_TYPE: Record<string, number[]> = {
  MOTORBIKE: [25_000, 30_000, 35_000, 40_000, 50_000, 60_000, 70_000, 80_000],
  SCOOTER:   [28_000, 35_000, 42_000, 50_000, 60_000, 75_000, 90_000],
  CAR_4:     [60_000, 75_000, 90_000, 110_000, 130_000, 150_000, 180_000],
  CAR_7:     [80_000, 100_000, 120_000, 150_000, 180_000, 220_000, 250_000],
};

const COMMISSION_BY_TYPE: Record<string, number> = {
  MOTORBIKE: 0.20, SCOOTER: 0.20, CAR_4: 0.18, CAR_7: 0.15,
};

function histPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Comprehensive historical data seed: inserts ~370 historical completed rides
 * across 30 days, FULLY consistent with what an end-to-end API flow would
 * produce. Writes to ALL the same tables an API-driven ride lifecycle touches:
 *
 *   ride_db     · "Ride"
 *   payment_db  · "Payment", "DriverEarnings"
 *   wallet_db   · wallet_transactions (EARN credit + COMMISSION debit for cash),
 *                 driver_wallets (balance/availableBalance),
 *                 merchant_ledger (PAYMENT / COMMISSION / PAYOUT entries),
 *                 merchant_balance (singleton totals)
 *   review_db   · reviews (Mongo, both directions ~85% of rides)
 *   driver_db   · drivers.rating_average, drivers.rating_count
 *
 * Key IDs used across all stores (auth userId throughout):
 *   - ride_db "Ride"."driverId"         = driver auth userId
 *   - payment_db "Payment"."driverId"   = driver auth userId
 *   - payment_db "DriverEarnings"."driverId" = driver auth userId
 *   - wallet_db  "driverId"             = driver auth userId
 *   - review_db  reviewerId/revieweeId  = userId (driver: auth userId; customer: userId)
 *   - driver_db.driver.userId           = driver auth userId (rating updated by userId)
 *
 * Distribution: ~40% of rides in last 7 days (denser, for driver weekly chart),
 * ~60% spread across days 8–30 (for admin Reports 30-day chart). Demo drivers
 * (indices 12–16, Hạnh Thông area used in test-scenarios.md) get a 1.5x boost
 * so their personal dashboard has meaningful chart data.
 *
 * All inserts use ON CONFLICT DO NOTHING — safe to re-run.
 */

/** Daily ride multiplier by day-of-week (0=Sun … 6=Sat). Thu/Fri/Sat peak. */
const DOW_MULTIPLIER = [1.0, 0.65, 0.75, 0.9, 1.15, 1.4, 1.35];

const HIST_TOTAL_TARGET = 370;
const HIST_7DAY_PORTION = 0.4;  // 40% concentrated in last 7 days
const HIST_DAYS = 30;
const DEMO_DRIVER_INDICES = new Set([12, 13, 14, 15, 16]); // Hạnh Thông (test-scenarios)

function driverActivityTier(idx: number): 'high' | 'mid' | 'low' {
  const pct = idx % 3;
  return pct === 0 ? 'high' : pct === 1 ? 'mid' : 'low';
}

function tierWeight(tier: 'high' | 'mid' | 'low'): number {
  if (tier === 'high') return 1.5;
  if (tier === 'mid')  return 1.0;
  return 0.55;
}

/**
 * Plan how many rides each driver gets in (a) last 7 days and (b) days 8–30.
 * Returns target counts that sum to ~HIST_TOTAL_TARGET.
 */
function planRideCounts(driverCount: number): {
  per7d: number[]; per30d: number[]; total: number;
} {
  // Compute weights per driver (tier × demo boost)
  const weights = Array.from({ length: driverCount }, (_, i) => {
    const tier = driverActivityTier(i);
    const w = tierWeight(tier);
    return DEMO_DRIVER_INDICES.has(i) ? w * 1.5 : w;
  });
  const wSum = weights.reduce((s, w) => s + w, 0) || 1;

  const target7d = Math.round(HIST_TOTAL_TARGET * HIST_7DAY_PORTION);
  const target30d = HIST_TOTAL_TARGET - target7d;

  // Floor 7d at 7 so every driver has at least one ride on each of the last 7
  // days — guarantees the driver weekly chart shows non-zero bars every day
  // and prevents the "biểu đồ chỉ hiển thị hôm nay" symptom on lightly-active
  // seeded drivers.
  const per7d = weights.map((w) => Math.max(7, Math.round((w / wSum) * target7d)));
  const per30d = weights.map((w) => Math.max(1, Math.round((w / wSum) * target30d)));
  const total = per7d.reduce((s, n) => s + n, 0) + per30d.reduce((s, n) => s + n, 0);
  return { per7d, per30d, total };
}

/** Pick a daysAgo offset weighted by DOW multiplier. */
function pickDayWithDOW(maxDaysAgo: number, minDaysAgo = 0): number {
  // Sample up to 6 candidates, pick the one whose DOW multiplier wins a draw.
  let best = minDaysAgo + Math.floor(Math.random() * (maxDaysAgo - minDaysAgo));
  let bestScore = 0;
  for (let k = 0; k < 5; k++) {
    const candidate = minDaysAgo + Math.floor(Math.random() * (maxDaysAgo - minDaysAgo));
    const d = new Date();
    d.setDate(d.getDate() - candidate);
    const score = DOW_MULTIPLIER[d.getDay()] * (0.7 + Math.random() * 0.6);
    if (score > bestScore) { best = candidate; bestScore = score; }
  }
  return best;
}

/** Bias rating toward the higher end (4-5 ★ ~70%, 3 ★ ~20%, 1-2 ★ ~10%). */
function pickHistoricalRating(): number {
  const r = Math.random();
  if (r < 0.55) return 5;
  if (r < 0.78) return 4;
  if (r < 0.92) return 3;
  if (r < 0.97) return 2;
  return 1;
}

const HIST_REVIEW_COMMENTS: Record<number, string[]> = {
  5: ['Tài xế chuyên nghiệp, đúng giờ.', 'Xe sạch sẽ, lái êm.', 'Thái độ vui vẻ, an toàn.', 'Rất hài lòng với chuyến đi.'],
  4: ['Chuyến đi ổn, tài xế thân thiện.', 'Tốt, sẽ ủng hộ tiếp.', 'Đến điểm đón nhanh.'],
  3: ['Bình thường, không có gì đặc biệt.', 'Lái xe trung bình.'],
  2: ['Tài xế đến hơi chậm.', 'Phục vụ chưa tốt lắm.'],
  1: ['Trải nghiệm chưa hài lòng.', 'Mong cải thiện thái độ.'],
};
function pickReviewComment(rating: number): string {
  const arr = HIST_REVIEW_COMMENTS[rating] || HIST_REVIEW_COMMENTS[5];
  return arr[Math.floor(Math.random() * arr.length)];
}

const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
const MONGO_PORT = process.env.MONGO_PORT || '27017';
const MONGO_USER = process.env.MONGO_USER || 'mongo';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || 'mongo';
function reviewMongoUri(): string {
  return `mongodb://${MONGO_USER}:${encodeURIComponent(MONGO_PASSWORD)}@${MONGO_HOST}:${MONGO_PORT}/review_db?authSource=admin`;
}

async function seedWalletEarningsHistory(
  customers: RegisteredUser[],
  driverProfiles: Array<{ driverId: string; userId: string; pending: boolean }>,
  driverUsers: RegisteredUser[],
): Promise<void> {
  const approved = driverProfiles
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.pending);
  if (approved.length === 0 || customers.length === 0) {
    console.log('  [hist] No approved drivers or customers — skipped.');
    return;
  }

  const plan = planRideCounts(approved.length);
  console.log(`  [hist] Target ~${HIST_TOTAL_TARGET} rides over ${HIST_DAYS} days for ${approved.length} drivers ` +
    `(plan: 7d=${plan.per7d.reduce((s, n) => s + n, 0)}, 8-30d=${plan.per30d.reduce((s, n) => s + n, 0)}, sum=${plan.total})`);

  const rideDb = pgConnect('ride_db');
  const payDb  = pgConnect('payment_db');
  const walDb  = pgConnect('wallet_db');
  const drvDb  = pgConnect('driver_db');
  await Promise.all([rideDb.connect(), payDb.connect(), walDb.connect(), drvDb.connect()]);

  let mongoClient: MongoClient | null = null;
  let reviewCol: any = null;
  try {
    mongoClient = await MongoClient.connect(reviewMongoUri(), { serverSelectionTimeoutMS: 5_000 });
    reviewCol = mongoClient.db('review_db').collection('reviews');
    // Ensure unique compound index (idempotent)
    await reviewCol.createIndex({ rideId: 1, reviewerId: 1 }, { unique: true });
  } catch (err: any) {
    console.log(`  [hist] ! Mongo connect failed (${err.message?.slice(0, 80)}) — reviews will be SKIPPED`);
    reviewCol = null;
  }

  // Cache current wallet balance per driver (auth userId key)
  const walletBalances = new Map<string, number>();
  for (const { p } of approved) {
    const r = await walDb.query<{ balance: number }>(
      `SELECT balance FROM driver_wallets WHERE "driverId" = $1`, [p.userId]
    );
    walletBalances.set(p.userId, Number(r.rows[0]?.balance ?? 0));
  }

  // Per-driver rating accumulator → drivers.rating_average / rating_count
  const ratingSum = new Map<string, number>();   // sum of ratings received
  const ratingCount = new Map<string, number>();
  for (const { p } of approved) {
    ratingSum.set(p.userId, 0);
    ratingCount.set(p.userId, 0);
  }

  // Merchant balance accumulator
  let merchantTotalIn = 0;
  let merchantTotalOut = 0;

  let totalRides = 0;
  let totalGMV = 0;

  // ── Generate ride events ─────────────────────────────────────────────────
  // Build a flat list (driverIdx, daysAgo) so we can sort chronologically
  // and update wallet balances in correct time order.
  type RideEvent = { driverIdx: number; daysAgo: number };
  const events: RideEvent[] = [];
  approved.forEach(({ i: _idx }, slotIdx) => {
    // For the last-7-days bucket, deal rides round-robin across all 7 days so
    // the driver weekly chart always has at least one bar per day. With per7d
    // floored to 7 (see planRideCounts), every day [0..6] gets >= 1 ride.
    const count7 = plan.per7d[slotIdx];
    const dayOrder = Array.from({ length: 7 }, (_, i) => i);
    // Fisher-Yates shuffle so the day with the most rides is random per driver.
    for (let i = dayOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dayOrder[i], dayOrder[j]] = [dayOrder[j], dayOrder[i]];
    }
    for (let r = 0; r < count7; r++) {
      events.push({ driverIdx: slotIdx, daysAgo: dayOrder[r % 7] });
    }
    for (let r = 0; r < plan.per30d[slotIdx]; r++) {
      events.push({ driverIdx: slotIdx, daysAgo: pickDayWithDOW(HIST_DAYS, 7) });
    }
  });
  // Sort oldest → newest so balanceAfter increments monotonically per driver
  events.sort((a, b) => b.daysAgo - a.daysAgo);

  for (let evIdx = 0; evIdx < events.length; evIdx++) {
    const ev = events[evIdx];
    const { p: profile, i: globalDriverIdx } = approved[ev.driverIdx];
    const driverUserId = profile.userId;        // auth userId — used for wallet_db
    const driverProfileId = profile.driverId;   // driver-service UUID — used for ride_db / payment_db
    const driverMeta = DRIVERS[globalDriverIdx];

    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - ev.daysAgo);
    dayDate.setHours(0, 0, 0, 0);

    const customer = histPick(customers);
    const customerName = `${customer.firstName} ${customer.lastName}`.trim();
    const driverName = driverMeta ? `${driverMeta.firstName} ${driverMeta.lastName}`.trim() : 'Tài xế';

    // Vehicle type matches the driver's actual vehicle (not random)
    const vehicleType = (driverMeta?.vehicle?.type || histPick(HIST_VEHICLE_TYPES_WEIGHTED)) as string;
    const paymentMethod = histPick(HIST_PAYMENT_METHODS_WEIGHTED);
    const pickup  = histPick(HIST_PICKUP_ADDRS);
    const dropoff = histPick(HIST_PICKUP_ADDRS.filter((l) => l !== pickup));

    const fares = HIST_FARE_BY_TYPE[vehicleType] ?? HIST_FARE_BY_TYPE.MOTORBIKE;
    const baseHour = 6 + Math.floor(Math.random() * 17);
    const isPeak = (baseHour >= 7 && baseHour <= 9) || (baseHour >= 17 && baseHour <= 20);
    const baseFare = histPick(fares);
    const grossFare = isPeak ? Math.round(baseFare * (1 + Math.random() * 0.5)) : baseFare;
    const commRate  = COMMISSION_BY_TYPE[vehicleType] ?? 0.20;
    const platformFee = Math.round(grossFare * commRate);
    const netEarnings = grossFare - platformFee;

    const distKm = Math.round((1.5 + Math.random() * 14) * 100) / 100;
    const durSec = Math.round(distKm * (3 + Math.random() * 3) * 60);

    const rideAt = new Date(dayDate);
    rideAt.setHours(baseHour, Math.floor(Math.random() * 60), 0, 0);
    const doneAt = new Date(rideAt.getTime() + durSec * 1000);
    const isCash = paymentMethod === 'CASH';

    const rideId = randomUUID();
    const payId  = randomUUID();
    const earnId = randomUUID();
    const ikey   = `hd${globalDriverIdx}-e${evIdx}`;

    // ── 1. Ride ──────────────────────────────────────────────────────────
    try {
      await rideDb.query(
        `INSERT INTO "Ride" (
          id, "customerId", "driverId", status,
          "vehicleType", "paymentMethod",
          "pickupAddress", "pickupLat", "pickupLng",
          "dropoffAddress", "dropoffLat", "dropoffLng",
          distance, duration, fare, "surgeMultiplier",
          "suggestedDriverIds", "offeredDriverIds", "rejectedDriverIds", "reassignAttempts",
          "requestedAt", "acceptedAt", "startedAt", "completedAt",
          "createdAt", "updatedAt"
        ) VALUES (
          $1,$2,$3,'COMPLETED',
          $4,$5,
          $6,$7,$8,
          $9,$10,$11,
          $12,$13,$14,${isPeak ? '1.3' : '1.0'},
          ARRAY[]::TEXT[],ARRAY[]::TEXT[],ARRAY[]::TEXT[],1,
          $15,$15,$15,$16,
          $15,$16
        ) ON CONFLICT (id) DO NOTHING`,
        [
          rideId, customer.userId, driverProfileId, vehicleType, paymentMethod,
          pickup.address, pickup.lat, pickup.lng,
          dropoff.address, dropoff.lat, dropoff.lng,
          distKm, durSec, grossFare,
          rideAt.toISOString(), doneAt.toISOString(),
        ]
      );
    } catch { /* skip */ }

    // ── 2. Payment ───────────────────────────────────────────────────────
    try {
      await payDb.query(
        `INSERT INTO "Payment" (
          id, "rideId", "customerId", "driverId",
          amount, currency, method, provider, status,
          "transactionId", "idempotencyKey",
          "initiatedAt", "completedAt", "createdAt", "updatedAt"
        ) VALUES (
          $1,$2,$3,$4,
          $5,'VND',
          $6::"PaymentMethod",'MOCK'::"PaymentProvider",'COMPLETED'::"PaymentStatus",
          $7,$7,
          $8,$9,$8,$9
        ) ON CONFLICT ("rideId") DO NOTHING`,
        [
          payId, rideId, customer.userId, driverProfileId,
          grossFare, paymentMethod,
          `hist-pay-${rideId}`,
          rideAt.toISOString(), doneAt.toISOString(),
        ]
      );
    } catch { /* skip */ }

    // ── 3. DriverEarnings ────────────────────────────────────────────────
    try {
      await payDb.query(
        `INSERT INTO "DriverEarnings" (
          id, "rideId", "driverId",
          "grossFare", "commissionRate", "platformFee",
          bonus, penalty, "netEarnings",
          "paymentMethod", "driverCollected", "cashDebt",
          "isPaid", "createdAt", "updatedAt"
        ) VALUES (
          $1,$2,$3,
          $4,$5,$6,
          0,0,$7,
          $8,$9,$10,
          true,$11,$11
        ) ON CONFLICT ("rideId") DO NOTHING`,
        [
          earnId, rideId, driverProfileId,
          grossFare, commRate, platformFee,
          netEarnings,
          paymentMethod, isCash, isCash ? platformFee : 0,
          doneAt.toISOString(),
        ]
      );
    } catch { /* skip */ }

    // ── 4. Wallet (EARN credit + COMMISSION debit for cash) ──────────────
    let prevBal = walletBalances.get(driverUserId) ?? 0;
    if (isCash) {
      // Cash flow: driver "earns" gross via off-app collection, then platform
      // debits commission from wallet (creates negative if low balance — same
      // as production). Net wallet impact = -platformFee (commission only).
      const afterCommission = prevBal - platformFee;
      walletBalances.set(driverUserId, afterCommission);
      try {
        await walDb.query(
          `INSERT INTO wallet_transactions
             (id, "driverId", type, direction, amount, "balanceAfter",
              description, "referenceId", "idempotencyKey", "createdAt")
           VALUES
             ($1,$2,'COMMISSION'::"TransactionType",'DEBIT'::"TransactionDirection",
              $3,$4,$5,$6,$7,$8)
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          [
            randomUUID(), driverUserId,
            platformFee, afterCommission,
            'Hoa hồng chuyến tiền mặt (lịch sử)', rideId, `${ikey}-comm`,
            doneAt.toISOString(),
          ]
        );
      } catch { /* skip */ }
      prevBal = afterCommission;
    } else {
      // Online flow: driver receives net earnings credited to wallet.
      const afterEarn = prevBal + netEarnings;
      walletBalances.set(driverUserId, afterEarn);
      try {
        await walDb.query(
          `INSERT INTO wallet_transactions
             (id, "driverId", type, direction, amount, "balanceAfter",
              description, "referenceId", "idempotencyKey", "createdAt")
           VALUES
             ($1,$2,'EARN'::"TransactionType",'CREDIT'::"TransactionDirection",
              $3,$4,$5,$6,$7,$8)
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          [
            randomUUID(), driverUserId,
            netEarnings, afterEarn,
            'Thu nhập chuyến (lịch sử)', rideId, `${ikey}-earn`,
            doneAt.toISOString(),
          ]
        );
      } catch { /* skip */ }
      prevBal = afterEarn;
    }

    // ── 5. Merchant ledger entries ───────────────────────────────────────
    if (isCash) {
      // Platform recognises commission inflow. Cash itself never touches
      // the merchant account so PAYMENT entry is intentionally omitted.
      try {
        await walDb.query(
          `INSERT INTO merchant_ledger (id, type, category, amount, "referenceId", description, "idempotencyKey", "createdAt")
           VALUES ($1, 'IN'::"MerchantLedgerType", 'COMMISSION'::"MerchantLedgerCategory", $2, $3, $4, $5, $6)
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          [randomUUID(), platformFee, rideId, 'Hoa hồng tiền mặt (lịch sử)', `${ikey}-mlcomm`, doneAt.toISOString()],
        );
        merchantTotalIn += platformFee;
      } catch { /* skip */ }
    } else {
      // Online: PAYMENT IN (gross) + PAYOUT OUT (net to driver) → net profit = commission
      try {
        await walDb.query(
          `INSERT INTO merchant_ledger (id, type, category, amount, "referenceId", description, "idempotencyKey", "createdAt")
           VALUES ($1, 'IN'::"MerchantLedgerType", 'PAYMENT'::"MerchantLedgerCategory", $2, $3, $4, $5, $6)
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          [randomUUID(), grossFare, rideId, `Tiền khách thanh toán (${paymentMethod})`, `${ikey}-mlpay`, doneAt.toISOString()],
        );
        merchantTotalIn += grossFare;
      } catch { /* skip */ }
      try {
        await walDb.query(
          `INSERT INTO merchant_ledger (id, type, category, amount, "referenceId", description, "idempotencyKey", "createdAt")
           VALUES ($1, 'OUT'::"MerchantLedgerType", 'PAYOUT'::"MerchantLedgerCategory", $2, $3, $4, $5, $6)
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          [randomUUID(), netEarnings, rideId, 'Trả thu nhập tài xế (lịch sử)', `${ikey}-mlpayout`, doneAt.toISOString()],
        );
        merchantTotalOut += netEarnings;
      } catch { /* skip */ }
    }

    // ── 6. Reviews (Mongo, ~85% of rides have both directions) ───────────
    const hasReview = Math.random() < 0.85;
    if (hasReview && reviewCol) {
      const customerRating = pickHistoricalRating();
      // Driver-to-customer rating skews higher (driver tends to give 5★)
      const driverRating = Math.random() < 0.85 ? 5 : 4;
      try {
        await reviewCol.insertOne({
          rideId,
          bookingId: rideId, // historical seed has no separate booking; reuse rideId
          type: 'CUSTOMER_TO_DRIVER',
          reviewerId: customer.userId,
          reviewerName: customerName,
          revieweeId: driverUserId,
          revieweeName: driverName,
          rating: customerRating,
          comment: pickReviewComment(customerRating),
          createdAt: doneAt,
          updatedAt: doneAt,
        });
        ratingSum.set(driverUserId, (ratingSum.get(driverUserId) || 0) + customerRating);
        ratingCount.set(driverUserId, (ratingCount.get(driverUserId) || 0) + 1);
      } catch { /* duplicate or transient — skip */ }
      try {
        await reviewCol.insertOne({
          rideId,
          bookingId: rideId,
          type: 'DRIVER_TO_CUSTOMER',
          reviewerId: driverUserId,
          reviewerName: driverName,
          revieweeId: customer.userId,
          revieweeName: customerName,
          rating: driverRating,
          comment: 'Khách hàng lịch sự, đúng giờ.',
          createdAt: doneAt,
          updatedAt: doneAt,
        });
      } catch { /* skip */ }
    }

    totalRides++;
    totalGMV += grossFare;
  }

  // ── Final updates ────────────────────────────────────────────────────────
  console.log('  [hist] Updating driver_wallets balances + drivers ratings + merchant_balance...');

  // 1) driver_wallets balance + availableBalance
  for (const [driverUserId, balance] of walletBalances) {
    try {
      await walDb.query(
        `UPDATE driver_wallets
            SET balance = $1, "availableBalance" = GREATEST($1, 0), "updatedAt" = NOW()
          WHERE "driverId" = $2`,
        [balance, driverUserId],
      );
    } catch { /* skip */ }
  }

  // 2) driver_db rating_average + rating_count (only drivers who got reviews)
  let driversWithRating = 0;
  for (const [driverUserId, count] of ratingCount) {
    if (count === 0) continue;
    const sum = ratingSum.get(driverUserId) || 0;
    const avg = sum / count;
    try {
      await drvDb.query(
        `UPDATE drivers SET rating_average = $1, rating_count = $2, updated_at = NOW() WHERE user_id = $3`,
        [Number(avg.toFixed(2)), count, driverUserId],
      );
      driversWithRating++;
    } catch { /* skip */ }
  }

  // 3) merchant_balance singleton (id=1)
  try {
    await walDb.query(
      `INSERT INTO merchant_balance (id, "totalIn", "totalOut", balance, "updatedAt")
       VALUES (1, $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         "totalIn" = merchant_balance."totalIn" + EXCLUDED."totalIn",
         "totalOut" = merchant_balance."totalOut" + EXCLUDED."totalOut",
         balance = merchant_balance.balance + (EXCLUDED."totalIn" - EXCLUDED."totalOut"),
         "updatedAt" = NOW()`,
      [merchantTotalIn, merchantTotalOut, merchantTotalIn - merchantTotalOut],
    );
  } catch (err: any) {
    console.log(`    ! merchant_balance update failed: ${err.message?.slice(0, 80)}`);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await Promise.all([rideDb.end(), payDb.end(), walDb.end(), drvDb.end()]);
  if (mongoClient) await mongoClient.close();

  // Suppress unused-param lint: driverUsers is reserved for future review name
  // resolution (currently we use DRIVERS metadata directly).
  void driverUsers;

  console.log(`  [hist] ✓ ${totalRides} rides • GMV ${(totalGMV / 1_000_000).toFixed(1)}M VND`);
  console.log(`  [hist]   ride_db ✓ · payment_db ✓ · wallet_db (transactions+ledger+balance) ✓`);
  console.log(`  [hist]   review_db ${reviewCol ? '✓' : '✗'} · driver ratings updated for ${driversWithRating} drivers`);
  console.log(`  [hist]   merchant_balance: IN=${merchantTotalIn.toLocaleString('vi-VN')}đ OUT=${merchantTotalOut.toLocaleString('vi-VN')}đ`);
}

// ─── Wait for services healthy ───────────────────────────────────────────────

/** Max seconds (1 probe/giây) chờ gateway → auth không còn 502. Mặc định ngắn — dev bình thường auth đã up ngay lần 1. */
const AUTH_PROXY_WAIT_ATTEMPTS = Number(process.env.SEED_AUTH_PROXY_WAIT_ATTEMPTS || '25');
const AUTH_PROXY_PROBE_TIMEOUT_MS = Number(process.env.SEED_AUTH_PROBE_TIMEOUT_MS || '8000');

function shouldSkipAuthProxyWait(): boolean {
  const v = (process.env.SEED_SKIP_AUTH_PROXY_WAIT || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

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

/**
 * Gateway /health chỉ báo API Gateway sống; auth có thể chưa listen → POST login 502.
 * Mặc định chờ ngắn + có progress log. Bỏ hẳn: SEED_SKIP_AUTH_PROXY_WAIT=1.
 */
async function waitForAuthThroughGateway() {
  if (shouldSkipAuthProxyWait()) {
    console.log('  [pre-flight] bỏ qua chờ auth proxy (SEED_SKIP_AUTH_PROXY_WAIT=1)');
    return;
  }

  const probeUrl = `${GATEWAY_BASE}/api/auth/login`;
  const body = JSON.stringify({ phone: '0900000000', password: 'SeedProbe1!' });

  for (let i = 0; i < AUTH_PROXY_WAIT_ATTEMPTS; i += 1) {
    try {
      const res = await fetch(probeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(AUTH_PROXY_PROBE_TIMEOUT_MS),
      });
      if (res.status !== 502) {
        console.log(
          i === 0
            ? '  [pre-flight] auth-service OK qua gateway'
            : `  [pre-flight] auth OK sau ${i + 1} lần thử`,
        );
        return;
      }
    } catch {
      /* timeout / ECONNREFUSED / gateway chưa sẵn sàng */
    }

    if (i === 0) {
      console.log(
        `  [pre-flight] auth chưa phản hồi qua gateway — chờ tối đa ~${AUTH_PROXY_WAIT_ATTEMPTS}s (bỏ qua: SEED_SKIP_AUTH_PROXY_WAIT=1)`,
      );
    } else if ((i + 1) % 5 === 0) {
      console.log(`  [pre-flight] … vẫn chờ (${i + 1}/${AUTH_PROXY_WAIT_ATTEMPTS})`);
    }

    await sleep(1000);
  }
  throw new Error(
    `[seed] Sau ~${AUTH_PROXY_WAIT_ATTEMPTS}s POST ${probeUrl} vẫn 502 / không kết nối được — gateway không gọi được auth-service. ` +
      'Kiểm tra auth-service và AUTH_SERVICE_URL trên api-gateway; hoặc chạy lại sau khi stack ổn định. ' +
      'Tạm bỏ bước chờ: SEED_SKIP_AUTH_PROXY_WAIT=1',
  );
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

  await waitForAuthThroughGateway();

  // Step 1 — admin DB bootstrap (the ONLY DB-direct writes for users)
  await bootstrapAdmin();
  await bootstrapSecondAdmin();

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

  // Step 11 — orchestrate rides via API (COMPLETED + CANCELLED only)
  //   Live rides target ~30 (RIDE_PLANS only); the remaining ~370 are seeded
  //   directly into ride_db / payment_db / wallet_db / review_db / merchant
  //   ledger by seedWalletEarningsHistory below for fast historical backfill.
  const rides = await seedRides(customers, driverUsers, driverProfiles, []);

  // Step 12 — set all drivers OFFLINE so DB is clean after seed
  await setApprovedDriversOffline(driverProfiles, driverUsers);

  // Step 12b — bring 20 heatmap drivers back online across clusters (for heatmap UI testing)
  await bringHeatmapDriversOnline(driverProfiles, driverUsers);

  // Step 13 — generate seed-accounts-reference.md
  await generateSeedReference(adminToken, customers, driverUsers, driverProfiles, rides);

  // Step 14 — backfill ~370 historical rides across 30 days, FULLY consistent
  // across ride_db, payment_db, wallet_db (transactions+ledger+balance),
  // review_db, and driver_db ratings. This is what makes admin Reports +
  // driver Earnings dashboards have meaningful chart data.
  await seedWalletEarningsHistory(customers, driverProfiles, driverUsers);

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log('================================================================');
  console.log(' Seeding completed successfully!');
  console.log('================================================================');
  console.log(`  Elapsed: ${elapsed}s`);
  const completed = rides.filter(r => r.status === 'COMPLETED').length;
  const cancelled = rides.filter(r => r.status === 'CANCELLED').length;
  console.log(`  Admins:       2 (${ADMIN.phone}, ${ADMIN_2.phone})`);
  console.log(`  Customers:    ${customers.length} (accounts)`);
  console.log(`  Drivers:      ${driverUsers.length} (${driverProfiles.filter(p => !p.pending).length} approved + ${driverProfiles.filter(p => p.pending).length} pending, ${HEATMAP_DRIVER_INDICES.length} online for heatmap)`);
  console.log(`  Live rides:   ${rides.length} (${completed} COMPLETED, ${cancelled} CANCELLED — via API gateway)`);
  console.log(`  Hist rides:   ~${HIST_TOTAL_TARGET} backfilled (40% in last 7 days, 60% in days 8-30)`);
  console.log(`  Total rides:  ~${rides.length + HIST_TOTAL_TARGET}`);
  console.log(`  Vouchers:     ${VOUCHER_SEEDS.length}`);
  console.log(`  IncentiveRules:${INCENTIVE_RULES.length}`);
  console.log(`  Report:       ${SEED_REFERENCE_OUTPUT}`);
  console.log('');
  console.log('  Test credentials:');
  console.log(`    Password: ${SEED_PASSWORD}`);
  console.log(`    Admin 1:  ${ADMIN.phone}  (System Admin)`);
  console.log(`    Admin 2:  ${ADMIN_2.phone}  (Sub Admin)`);
  console.log(`    Customer demo (test-scenarios): 0901234571`);
  console.log(`    Driver A demo  (test-scenarios): 0911234583  (Pham Van Bao)`);
  console.log(`    Driver B demo  (test-scenarios): 0911234585  (Le Thi Mai)`);
  console.log(`    Driver C demo  (test-scenarios): 0911234573  (Le Minh N)`);
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

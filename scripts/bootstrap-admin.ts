/// <reference types="node" />
/**
 * Tạo / cập nhật một tài khoản ADMIN trong auth_db (Upsert bcrypt password).
 *
 * Không đụng các service khác, không voucher/ride/driver. Dùng trước khi có đủ thời gian
 * làm seed đầy đủ hoặc trên máy chỉ có Node/bootstrap runner không có npx/host npm.
 *
 * Chạy (tham số thường từ .env):
 *   npx tsx scripts/bootstrap-admin.ts
 *
 * Swarm thesis (Postgres 127.0.0.1:5433 trên Primary Manager): giống seed-database bootstrap.
 */

import path from 'node:path';
import bcrypt from 'bcryptjs';

export const ADMIN = {
  phone: '0900000001',
  email: 'admin@cabbooking.com',
  firstName: 'System',
  lastName: 'Admin',
};

/** Mật khẩu đăng nhập admin (/api/auth/login) — trùng mặc định seed-database nếu bạn có dùng sau. */
export const SEED_PASSWORD = 'Password@1';

function pgUrl(db: string) {
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5433';
  const user = process.env.POSTGRES_USER || 'postgres';
  const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || 'postgres');
  return `postgresql://${user}:${pass}@${host}:${port}/${db}`;
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

export async function bootstrapAdmin(): Promise<string> {
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

    console.log(`[bootstrap-admin] OK — user id: ${admin.id}`);
    console.log(`  Login: phone=${ADMIN.phone}  password=${SEED_PASSWORD}`);
    return admin.id;
  } finally {
    await prisma.$disconnect();
  }
}

async function mainCli(): Promise<void> {
  console.log('[bootstrap-admin] Upsert ADMIN vào auth_db...');
  await bootstrapAdmin();
  console.log('[bootstrap-admin] Xong.');
}

const isCli =
  typeof process.argv[1] === 'string'
  && /^.*[/\\]bootstrap-admin\.m?[jt]s$/.test(process.argv[1]!.replace(/\\/g, '/'));

if (isCli) {
  mainCli().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

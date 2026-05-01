import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { createApp } from './app';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { DriverWalletService } from './services/driver-wallet.service';
import { logger } from './utils/logger';

// ─── Seed representative system bank accounts (mock) ─────────────────────────
// These are never real API targets — they exist so the BankSimulationService
// can reference canonical account IDs and admins can see them in the dashboard.
async function seedSystemBankAccounts(prisma: PrismaClient): Promise<void> {
  const accounts = [
    {
      id:            'MAIN_ACCOUNT',
      bankName:      'Techcombank',
      accountNumber: '8000511204',
      accountHolder: 'Cab Booking System Co., Ltd.',
      type:          'SETTLEMENT_ACCOUNT' as const,
      description:   'Tài khoản nhận thanh toán từ MoMo/VNPay — Techcombank 8000511204',
    },
    {
      id:            'PAYOUT_ACCOUNT',
      bankName:      'Techcombank',
      accountNumber: '8000511204',
      accountHolder: 'Cab Booking System Co., Ltd.',
      type:          'PAYOUT_ACCOUNT' as const,
      description:   'Tài khoản chuyển tiền cho tài xế khi rút ví — Techcombank 8000511204',
    },
  ];

  for (const account of accounts) {
    await (prisma as any).systemBankAccount.upsert({
      where:  { id: account.id },
      update: {
        bankName:      account.bankName,
        accountNumber: account.accountNumber,
        accountHolder: account.accountHolder,
        description:   account.description,
      },
      create: account,
    });
  }

  logger.info('System bank accounts seeded (MAIN_ACCOUNT=Techcombank, PAYOUT_ACCOUNT=Techcombank — same bank).');
}

async function main() {
  const prisma         = new PrismaClient();
  const eventPublisher = new EventPublisher();
  const eventConsumer  = new EventConsumer(prisma, eventPublisher);

  // ─── Connect to infrastructure ────────────────────────────────────────────
  await prisma.$connect();
  logger.info('Connected to PostgreSQL (wallet_db)');

  // Seed representative system bank accounts
  await seedSystemBankAccounts(prisma);

  // RabbitMQ: connect with retry
  let rabbitConnected = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await eventPublisher.connect();
      await eventConsumer.connect();
      rabbitConnected = true;
      break;
    } catch {
      logger.warn(`RabbitMQ connection attempt ${attempt}/10 failed. Retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (!rabbitConnected) {
    logger.error('Could not connect to RabbitMQ after 10 attempts. Exiting.');
    process.exit(1);
  }

  // ─── Readiness check ──────────────────────────────────────────────────────
  const getReadiness = async () => ({
    database: await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    rabbitmq: eventPublisher.isConnected(),
  });

  // ─── HTTP server ──────────────────────────────────────────────────────────
  const app    = createApp({ prisma, eventPublisher, getReadiness });
  const server = app.listen(config.port, () => {
    logger.info(`Wallet Service listening on port ${config.port}`);
  });

  // ─── Pending earnings cron (every 30 min) ─────────────────────────────────
  // Lazily settle T+24h earnings so drivers don't need to open the app for
  // the balance to update automatically.
  const walletService = new DriverWalletService(prisma, eventPublisher);
  let pendingSettlementRunning = false;

  const settlePendingEarningsCron = async () => {
    if (pendingSettlementRunning) return;
    pendingSettlementRunning = true;
    try {
      const due = await (prisma as any).pendingEarning.findMany({
        where: { settledAt: null, settleAt: { lte: new Date() } },
        select: { driverId: true },
        distinct: ['driverId'],
      });
      if (due.length > 0) {
        logger.info(`Pending earnings cron: settling for ${due.length} driver(s)`);
        for (const { driverId } of due) {
          try {
            await walletService.settlePendingEarnings(driverId);
          } catch (err) {
            logger.warn(`Failed to settle pending earnings for driver ${driverId}:`, err);
          }
        }
      }
    } catch (err) {
      logger.error('Pending earnings cron error:', err);
    } finally {
      pendingSettlementRunning = false;
    }
  };

  const cronInterval = setInterval(() => { void settlePendingEarningsCron(); }, 30 * 60 * 1000);
  void settlePendingEarningsCron(); // run once on startup to catch any missed settlements

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    clearInterval(cronInterval);
    server.close(async () => {
      await eventConsumer.close();
      await eventPublisher.close();
      await prisma.$disconnect();
      logger.info('Wallet Service shut down');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error starting Wallet Service:', err);
  process.exit(1);
});

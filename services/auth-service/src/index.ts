import { createApp } from './app';
import { config } from './config';
import { checkDatabaseReadiness, prisma } from './config/db';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';
import { createHealthServiceRegistration, createHttpBridgeServiceRegistration, shutdownGrpcServer, startGrpcServer } from '../../../shared/dist';

export async function start() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');
  } catch (error) {
    logger.error('PostgreSQL connection error:', error);
    process.exit(1);
  }

  // Initialize OTP service (Redis)
  const otpService = new OtpService();
  try {
    await otpService.connect();
  } catch (error) {
    logger.error('Redis connection error:', error);
    // Non-fatal in development; OTP will log to console
    logger.warn('OTP Redis unavailable — OTPs will be logged to console only');
  }

  // Initialize event publisher
  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const authService = new AuthService(eventPublisher, otpService);
  const getReadiness = async () => ({
    postgres: await checkDatabaseReadiness(),
    rabbitmq: eventPublisher.isConnected(),
    redis: otpService.isConnected(),
  });
  const app = createApp({
    authService,
    getReadiness,
  });

  const grpcServer = await startGrpcServer({
    address: `0.0.0.0:${config.grpcPort}`,
    registrations: [
      createHealthServiceRegistration(config.serviceName, getReadiness),
      createHttpBridgeServiceRegistration(`http://127.0.0.1:${config.port}`),
    ],
  });

  const server = app.listen(config.port, () => {
    logger.info(`Auth Service running on port ${config.port}`);
    logger.info(`Auth gRPC Service running on port ${config.grpcPort}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await shutdownGrpcServer(grpcServer);
    await otpService.disconnect();
    await eventPublisher.close();
    await prisma.$disconnect();
    server.close();
    process.exit(0);
  });

  return { app, server };
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start service:', error);
    process.exit(1);
  });
}

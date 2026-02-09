import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from './generated/prisma-client';
import { config } from './config';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { createPaymentRoutes } from './routes/payment.routes';
import { paymentGatewayManager } from './services/payment-gateway.manager';
import { logger } from './utils/logger';

const app = express();
const prisma = new PrismaClient();
const eventPublisher = new EventPublisher();
const eventConsumer = new EventConsumer(prisma, eventPublisher);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service' });
});

// Routes
app.use('/api/payments', createPaymentRoutes(prisma, eventPublisher));

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Startup
const start = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');

    // Initialize payment gateways
    paymentGatewayManager.initialize();

    await eventPublisher.connect();
    await eventConsumer.connect();

    app.listen(config.port, () => {
      logger.info(`Payment Service running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start Payment Service:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await eventConsumer.close();
  await eventPublisher.close();
  await prisma.$disconnect();
  process.exit(0);
});

start();

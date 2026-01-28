import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { EventConsumer } from './events/consumer';
import { UserService } from './services/user.service';
import { createUserRouter } from './routes/user.routes';
import { prisma } from './config/db';

async function main() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', service: config.serviceName });
  });

  // Connect to RabbitMQ
  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  const eventConsumer = new EventConsumer();
  await eventConsumer.connect();

  // Initialize services
  const userService = new UserService(eventPublisher);

  // Routes
  app.use('/api/users', createUserRouter(userService));

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  // Start server
  app.listen(config.port, () => {
    logger.info(`User Service running on port ${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await eventPublisher.close();
    await eventConsumer.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

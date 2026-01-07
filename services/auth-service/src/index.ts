import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config';
import { logger } from './utils/logger';
import { EventPublisher } from './events/publisher';
import { AuthService } from './services/auth.service';
import { createAuthRouter } from './routes/auth.routes';
import { User } from './models/user.model';

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

  // Internal routes (service-to-service) protected by INTERNAL_SERVICE_TOKEN
  app.use('/internal', (req, res, next) => {
    const required = process.env.INTERNAL_SERVICE_TOKEN;
    if (!required) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_TOKEN_NOT_CONFIGURED', message: 'INTERNAL_SERVICE_TOKEN not configured' },
      });
    }

    const provided = req.header('x-internal-token');
    if (!provided || provided !== required) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED_INTERNAL', message: 'Invalid internal token' },
      });
    }

    next();
  });

  app.get('/internal/users/:userId', async (req, res) => {
    try {
      const user = await User.findById(req.params.userId).select('-passwordHash').lean();
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }
      return res.json({ success: true, data: { user } });
    } catch (error) {
      logger.error('Internal get user failed:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });

  // Connect to MongoDB
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }

  // Initialize event publisher
  const eventPublisher = new EventPublisher();
  await eventPublisher.connect();

  // Initialize services
  const authService = new AuthService(eventPublisher);

  // Routes
  app.use('/api/auth', createAuthRouter(authService));

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
    logger.info(`Auth Service running on port ${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await eventPublisher.close();
    await mongoose.connection.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});

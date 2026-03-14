import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRequestContextMiddleware } from '../../../shared/dist';
import { config } from './config';
import { prisma } from './config/db';
import { createAuthRouter } from './routes/auth.routes';
import { AuthService } from './services/auth.service';
import { logger } from './utils/logger';
import { requireInternalServiceAuth } from './middleware/internal-auth';

interface AuthAppOptions {
  authService: AuthService;
  getReadiness: () => Promise<Record<string, boolean>>;
}

export function createApp({ authService, getReadiness }: AuthAppOptions) {
  const app = express();

  app.use(createRequestContextMiddleware() as express.RequestHandler);
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: config.serviceName });
  });

  app.get('/ready', async (_req, res) => {
    const dependencies = await getReadiness();
    const ready = Object.values(dependencies).every(Boolean);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: config.serviceName,
      dependencies,
    });
  });

  app.use('/internal', requireInternalServiceAuth);

  app.get('/internal/users/:userId', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.userId },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          firstName: true,
          lastName: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      });

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

  app.use('/api/auth', createAuthRouter(authService));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return app;
}
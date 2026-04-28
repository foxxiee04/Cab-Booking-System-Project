import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createRequestContextMiddleware } from '../../../shared/dist';
import { config } from './config';
import { prisma } from './config/db';
import { createAuthRouter } from './routes/auth.routes';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';
import { logger } from './utils/logger';
import { requireInternalServiceAuth } from './middleware/internal-auth';

interface AuthAppOptions {
  authService: AuthService;
  otpService?: OtpService;
  getReadiness: () => Promise<Record<string, boolean>>;
}

export function createApp({ authService, otpService, getReadiness }: AuthAppOptions) {
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

  // ── Dev-only OTP retrieval ─────────────────────────────────────────────────
  // Only active when OTP_SMS_MODE=mock AND NODE_ENV !== production.
  // Usage: GET /internal/dev/otp?phone=0971234567&purpose=register
  //        Header: x-internal-token: <INTERNAL_SERVICE_TOKEN>
  if (otpService && config.sms.mode === 'mock' && config.nodeEnv !== 'production') {
    app.get('/internal/dev/otp', async (req, res) => {
      const phone = req.query.phone as string | undefined;
      const purpose = (req.query.purpose as string | undefined) || 'register';

      if (!phone) {
        return res.status(400).json({ success: false, error: 'phone query param required' });
      }

      try {
        const otp = await otpService.getPlainOtp(phone, purpose);
        if (!otp) {
          return res.status(404).json({
            success: false,
            error: 'No active OTP found for this phone/purpose (expired or not requested yet).',
          });
        }
        logger.info('[DEV] OTP retrieved via debug endpoint', { phone: phone.slice(0, 4) + '***', purpose });
        return res.json({ success: true, otp, purpose, note: 'mock mode only — never exposed in production' });
      } catch (err) {
        logger.error('Dev OTP endpoint error:', err);
        return res.status(500).json({ success: false, error: 'Internal error' });
      }
    });
  }

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
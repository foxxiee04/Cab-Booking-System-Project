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
import { toRegistrationPhoneDigits } from './utils/phone-normalize';

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
  app.use(express.json({ limit: '25mb' }));

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

  // ── Dev OTP retrieval (mock mode only) ────────────────────────────────────
  // Default: only when NODE_ENV !== production.
  // Demo/staging on server: set OTP_SMS_MODE=mock and OTP_ENABLE_DEV_ENDPOINT=true
  // Usage: GET /api/auth/dev/otp?phone=0971234567&purpose=register
  const allowDevOtpEndpoint =
    otpService &&
    config.sms.mode === 'mock' &&
    (config.nodeEnv !== 'production' || config.otp.enableDevEndpoint);

  if (allowDevOtpEndpoint) {
    if (config.nodeEnv === 'production' && config.otp.enableDevEndpoint) {
      logger.warn(
        '[SECURITY] Dev OTP endpoint enabled in production (OTP_ENABLE_DEV_ENDPOINT). Use only on demo/staging; disable for real prod.',
      );
    }
    app.get('/api/auth/dev/otp', async (req, res) => {
      const phone = req.query.phone as string | undefined;
      const purpose = (req.query.purpose as string | undefined) || 'register';

      if (!phone) {
        return res.status(400).json({ success: false, error: 'phone query param required' });
      }

      const canonicalPhone = toRegistrationPhoneDigits(phone);
      if (!canonicalPhone) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone format. Use 0xxxxxxxxx (10 digits) or +84xxxxxxxx (same key as SMS flow).',
        });
      }

      try {
        const otp = await otpService.getPlainOtp(canonicalPhone, purpose);
        if (!otp) {
          return res.status(404).json({
            success: false,
            error: 'No active OTP found for this phone/purpose (expired or not requested yet).',
          });
        }
        logger.info('[DEV] OTP retrieved via debug endpoint', { phone: `${canonicalPhone.slice(0, 4)}***`, purpose });
        return res.json({
          success: true,
          otp,
          purpose,
          note: 'mock mode — set OTP_ENABLE_DEV_ENDPOINT only on demo/staging',
        });
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

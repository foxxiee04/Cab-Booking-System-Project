import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { grpcBridgeClient, ForwardableRequestLike } from '../grpc/bridge.client';

const router = Router();

function normalizeProxyPath(service: keyof typeof import('../config').config.grpcServices, originalUrl: string): string {
  const path = originalUrl.split('?')[0];

  if (service === 'review') {
    return path.replace(/^\/api\/reviews\/reviews(?=\/|$)/, '/api/reviews');
  }

  return path;
}

async function forward(service: keyof typeof import('../config').config.grpcServices, req: Request, res: Response) {
  try {
    const normalizedPath = normalizeProxyPath(service, req.originalUrl);
    const forwardedRequest: ForwardableRequestLike = {
      method: req.method,
      originalUrl: normalizedPath,
      query: req.query,
      body: req.body,
      headers: req.headers,
    };

    const response = await grpcBridgeClient.forward(service, forwardedRequest, normalizedPath);
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    logger.error('gRPC proxy error', {
      service,
      method: req.method,
      path: normalizeProxyPath(service, req.originalUrl),
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(502).json({
      success: false,
      message: 'Service temporarily unavailable',
    });
  }
}

router.use('/api/auth', (req, res) => void forward('auth', req, res));
router.use('/api/rides', (req, res) => void forward('ride', req, res));
router.use('/api/drivers', (req, res) => void forward('driver', req, res));
router.use('/api/payments', (req, res) => void forward('payment', req, res));
router.use('/api/bookings', (req, res) => void forward('booking', req, res));
router.use('/api/pricing', (req, res) => void forward('pricing', req, res));
router.use('/api/users', (req, res) => void forward('user', req, res));
router.use('/api/reviews', (req, res) => void forward('review', req, res));
router.use('/api/notifications', (req, res) => void forward('notification', req, res));

export default router;

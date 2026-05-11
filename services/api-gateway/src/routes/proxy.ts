import { Router, Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { grpcBridgeClient, ForwardableRequestLike } from '../grpc/bridge.client';
import { normalizeAddressPayloadDeep } from '../location/address-normalizer';

const router = Router();

function normalizeForwardQuery(
  service: keyof typeof import('../config').config.services,
  normalizedPath: string,
  originalQuery: Request['query'],
): Request['query'] {
  const query = { ...originalQuery };

  if (service === 'driver' && /^\/api\/drivers\/nearby(?:\/|$)/.test(normalizedPath)) {
    const maxRadiusKm = Math.max(0.5, config.customer.nearbyDriverMaxRadiusKm || 3);
    const rawRadius = Array.isArray(query.radius) ? query.radius[0] : query.radius;
    const parsedRadius = Number(rawRadius);
    const safeRadius = Number.isFinite(parsedRadius)
      ? Math.max(0.1, Math.min(parsedRadius, maxRadiusKm))
      : maxRadiusKm;

    if (Number.isFinite(parsedRadius) && parsedRadius !== safeRadius) {
      logger.info(
        `Clamped nearby-driver radius from ${parsedRadius}km to ${safeRadius}km for ${normalizedPath}`,
      );
    }

    query.radius = String(safeRadius);
  }

  return query;
}

function normalizeProxyPath(service: keyof typeof import('../config').config.services, originalUrl: string): string {
  const path = originalUrl.split('?')[0];

  if (service === 'review') {
    return path.replace(/^\/api\/reviews\/reviews(?=\/|$)/, '/api/reviews');
  }

  return path;
}

const getForwardHeaders = (req: Request) => {
  const headers: Record<string, string> = {
    Authorization: req.header('authorization') || '',
    'x-user-id': String(req.headers['x-user-id'] || ''),
    'x-user-email': String(req.headers['x-user-email'] || ''),
    'x-user-role': String(req.headers['x-user-role'] || ''),
  };

  const contentType = req.header('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return headers;
};

const shouldForwardOverHttp = (
  service: keyof typeof import('../config').config.services,
  normalizedPath: string,
) => {
  // All auth routes use HTTP forwarding (gRPC bridge internal fetch is unreliable)
  if (service === 'auth') {
    return true;
  }

  // wallet-service does not expose gRPC — always use HTTP
  if (service === 'wallet') {
    return true;
  }

  if (service !== 'driver') {
    return false;
  }

  return /^\/api\/drivers\/me$/.test(normalizedPath)
    || /^\/api\/drivers\/me\/(online|offline|location|available-rides|assigned)$/.test(normalizedPath)
    || /^\/api\/drivers\/me\/rides\/[^/]+\/accept$/.test(normalizedPath)
    || /^\/api\/drivers\/register$/.test(normalizedPath)
    || /^\/api\/drivers\/nearby/.test(normalizedPath)
    || /^\/api\/drivers\/[^/]+\/profile$/.test(normalizedPath)
    || /^\/api\/drivers\/user\//.test(normalizedPath);
};

async function forwardOverHttp(
  service: keyof typeof import('../config').config.services,
  req: Request,
  res: Response,
  normalizedPath: string,
) {
  const url = new URL(normalizedPath, config.services[service]);
  const normalizedQuery = normalizeForwardQuery(service, normalizedPath, req.query);

  Object.entries(normalizedQuery).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null) {
          url.searchParams.append(key, String(entry));
        }
      });
      return;
    }

    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  let upstream: Awaited<ReturnType<typeof fetch>>;
  try {
    upstream = await fetch(url.toString(), {
      method: req.method,
      headers: getForwardHeaders(req),
      body: ['GET', 'HEAD'].includes(req.method.toUpperCase())
        ? undefined
        : JSON.stringify(normalizeAddressPayloadDeep(req.body || {})),
    });
  } catch (error) {
    logger.error('HTTP proxy upstream unreachable', {
      service,
      method: req.method,
      url: url.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const text = await upstream.text();

  try {
    const parsed = text ? JSON.parse(text) : {};
    res.status(upstream.status).json(normalizeAddressPayloadDeep(parsed));
  } catch {
    res.status(upstream.status).send(text);
  }
}

async function forward(service: keyof typeof import('../config').config.services, req: Request, res: Response) {
  const normalizedPath = normalizeProxyPath(service, req.originalUrl);
  try {
    const normalizedQuery = normalizeForwardQuery(service, normalizedPath, req.query);

    if (shouldForwardOverHttp(service, normalizedPath)) {
      await forwardOverHttp(service, req, res, normalizedPath);
      return;
    }

    const forwardedRequest: ForwardableRequestLike = {
      method: req.method,
      originalUrl: normalizedPath,
      query: normalizedQuery,
      body: normalizeAddressPayloadDeep(req.body),
      headers: req.headers,
    };

    // service is guaranteed not to be HTTP-only here (shouldForwardOverHttp returned false)
    const response = await grpcBridgeClient.forward(service as keyof typeof import('../config').config.grpcServices, forwardedRequest, normalizedPath);
    res.status(response.statusCode).json(normalizeAddressPayloadDeep(response.body));
  } catch (error) {
    const viaHttp = shouldForwardOverHttp(service, normalizedPath);
    logger.error(viaHttp ? 'HTTP proxy error (upstream fail)' : 'gRPC proxy error', {
      service,
      method: req.method,
      path: normalizedPath,
      viaHttp,
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
// Wallet top-up routes (initiate, IPN callbacks, browser returns, status) live in payment-service
// because they reuse the same MoMo/VNPay gateway code.  This rule must come BEFORE /api/wallet.
router.use('/api/wallet/top-up', (req, res) => void forward('payment', req, res));
router.use('/api/admin/wallet', (req, res) => void forward('wallet', req, res));
router.use('/api/wallet', (req, res) => void forward('wallet', req, res));
router.use('/api/voucher', (req, res) => void forward('payment', req, res));
router.use('/api/bookings', (req, res) => void forward('booking', req, res));
router.use('/api/pricing', (req, res) => void forward('pricing', req, res));
router.use('/api/users', (req, res) => void forward('user', req, res));
router.use('/api/reviews', (req, res) => void forward('review', req, res));
router.use('/api/notifications', (req, res) => void forward('notification', req, res));

// AI service — direct HTTP forward (no gRPC).
// Routes: POST /api/ai/chat, GET /api/ai/chat/status, GET /api/ai/stats
router.use('/api/ai', async (req, res) => {
  try {
    const aiBase = config.services.ai;
    // Map /api/ai/chat → /api/chat  (strip the /ai prefix)
    const downstreamPath = req.path.replace(/^\//, ''); // e.g. "chat" or "chat/status"
    const url = new URL(`/api/${downstreamPath}`, aiBase);

    Object.entries(req.query).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    });

    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': String(req.headers['x-user-id'] || ''),
        'x-user-role': String(req.headers['x-user-role'] || ''),
      },
      body: ['GET', 'HEAD'].includes(req.method.toUpperCase())
        ? undefined
        : JSON.stringify(req.body || {}),
    });

    const text = await response.text();
    try {
      res.status(response.status).json(text ? JSON.parse(text) : {});
    } catch {
      res.status(response.status).send(text);
    }
  } catch (err) {
    logger.error('AI service proxy error:', err);
    res.status(503).json({ success: false, message: 'AI service temporarily unavailable' });
  }
});

export default router;

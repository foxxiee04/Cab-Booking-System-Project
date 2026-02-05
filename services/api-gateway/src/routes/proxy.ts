import { Router } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// Proxy options factory
const createProxyOptions = (target: string, pathRewrite?: Record<string, string>): Options => ({
  target,
  changeOrigin: true,
  pathRewrite,
  onError: (err, req, res) => {
    logger.error(`Proxy error: ${err.message}`, { target, path: req.path });
    (res as any).status(502).json({
      success: false,
      message: 'Service temporarily unavailable',
    });
  },
  onProxyReq: (proxyReq, req) => {
    logger.debug(`Proxying ${req.method} ${req.path} -> ${target}`);
  },
});

// Auth Service routes
router.use(
  '/api/auth',
  createProxyMiddleware(createProxyOptions(config.services.auth, {
    '^/api/auth': '/api/auth',
  }))
);

// Ride Service routes
router.use(
  '/api/rides',
  createProxyMiddleware(createProxyOptions(config.services.ride, {
    '^/api/rides': '/api/rides',
  }))
);

// Driver Service routes
router.use(
  '/api/drivers',
  createProxyMiddleware(createProxyOptions(config.services.driver, {
    '^/api/drivers': '/api/drivers',
  }))
);

// Payment Service routes
router.use(
  '/api/payments',
  createProxyMiddleware(createProxyOptions(config.services.payment, {
    '^/api/payments': '/api/payments',
  }))
);


// Booking Service routes
router.use(
  '/api/bookings',
  createProxyMiddleware(createProxyOptions(config.services.booking, {
    '^/api/bookings': '/api/bookings',
  }))
);

// Pricing Service routes
router.use(
  '/api/pricing',
  createProxyMiddleware(createProxyOptions(config.services.pricing, {
    '^/api/pricing': '/api/pricing',
  }))
);

// User Service routes
router.use(
  '/api/users',
  createProxyMiddleware(createProxyOptions(config.services.user, {
    '^/api/users': '/api/users',
  }))
);

// Review Service routes
router.use(
  '/api/reviews',
  createProxyMiddleware(createProxyOptions(config.services.review, {
    '^/api/reviews': '/api/reviews',
  }))
);

// WebSocket proxy for notifications
router.use(
  '/socket.io',
  createProxyMiddleware({
    target: config.services.notification,
    changeOrigin: true,
    ws: true,
  })
);

export default router;

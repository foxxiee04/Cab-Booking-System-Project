import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { config } from '../config';

/**
 * Skip the limiter when a trusted bypass header is presented.
 *
 * Used by scripts/seed-database.ts when bootstrapping a fresh environment —
 * the seed makes ~3 calls per user × 100 users in a few seconds, well over
 * the 100 req/min budget. The shared secret comes from env SEED_BYPASS_TOKEN
 * on both sides; with no token configured the bypass is dead code (production
 * default) and the limiter applies unconditionally.
 */
function isTrustedBypass(req: Request): boolean {
  const token = config.rateLimit.bypassToken;
  if (!token) return false;
  const header = req.headers['x-seed-token'];
  const candidate = Array.isArray(header) ? header[0] : header;
  return typeof candidate === 'string' && candidate === token;
}

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTrustedBypass,
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTrustedBypass,
});

// Limiter for expensive operations
export const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    message: 'Rate limit exceeded for this operation.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTrustedBypass,
});

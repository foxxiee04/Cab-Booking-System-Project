import { Request, Response, NextFunction } from 'express';

/**
 * Fields that must NEVER be sanitized.
 *
 * Passwords and tokens are hashed/verified immediately and never rendered in
 * UI — sanitizing them would silently corrupt the value (e.g. "Pass<x>1!" →
 * "Pass1!") without the user knowing. OTPs are numeric but excluded for
 * consistency; tokens are opaque blobs.
 */
const SKIP_SANITIZE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'otp',
  'token',
  'refreshToken',
  'accessToken',
  'idToken',
]);

function sanitizeString(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim();
}

function sanitizeDeep(value: unknown, key?: string): unknown {
  // Never touch secret fields — passwords, tokens, OTPs.
  if (key !== undefined && SKIP_SANITIZE_KEYS.has(key)) {
    return value;
  }
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeDeep(v, k);
    }
    return result;
  }
  return value;
}

/**
 * Express middleware: sanitizes req.body in-place before any route handler runs.
 * Secret fields (password, token, otp) are passed through unchanged.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(req.body);
  }
  next();
}

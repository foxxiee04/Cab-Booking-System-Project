import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface JwtPayload {
  userId?: string;
  sub?: string;
  phone?: string;
  email?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/register',
  '/api/auth/check-phone',
  '/api/auth/verify-phone-otp',
  '/api/auth/register-phone/start',
  '/api/auth/register-phone/verify',
  '/api/auth/register-phone/complete',
  '/api/auth/login',         // kept for backward compat
  '/api/auth/send-otp',      // request OTP (registration resend)
  '/api/auth/verify-otp',    // verify OTP + get JWT
  '/api/auth/forgot-password', // send OTP for password reset
  '/api/auth/reset-password',  // verify OTP and set new password
  '/api/auth/refresh',
  '/api/payments/vnpay/return', // VNPay redirect return (browser redirect)
  '/api/map',
  '/health',
  '/api/ai/ride/estimate',
  '/api/geo',
];

// Check if path is public
const isPublicPath = (path: string): boolean => {
  return PUBLIC_PATHS.some(publicPath => path.startsWith(publicPath));
};

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip auth for public paths
  if (isPublicPath(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const userId = decoded.userId || decoded.sub;
    const phone = decoded.phone;
    const email = decoded.email;
    const role = decoded.role;

    if (!userId || !role) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    req.user = { userId, email: email || '', phone: phone || '', role };
    
    // Propagate user identity to downstream services via headers
    req.headers['x-user-id'] = userId;
    if (phone) req.headers['x-user-phone'] = phone;
    if (email) req.headers['x-user-email'] = email;
    req.headers['x-user-role'] = role;
    
    next();
  } catch (error) {
    logger.warn('Invalid token attempt', { path: req.path });
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Role-based access control
export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const role = req.user.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

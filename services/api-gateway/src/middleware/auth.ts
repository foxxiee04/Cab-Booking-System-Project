import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface JwtPayload {
  userId?: string;
  sub?: string;
  email?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/health',
  '/api/ai/ride/estimate', // Public estimate endpoint
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
    const email = decoded.email;
    const role = decoded.role;

    if (!userId || !role) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    req.user = { userId, email: email || '', role };
    
    // Add user info to headers for downstream services
    req.headers['x-user-id'] = userId;
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

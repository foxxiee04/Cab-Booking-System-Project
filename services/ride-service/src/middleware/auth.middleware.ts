import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getRequiredEnv } from '../../../../shared/dist';

interface AuthRequest extends Request {
  user?: { userId: string; role: string; email?: string };
}

const JWT_SECRET = getRequiredEnv('JWT_SECRET');

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Accept forwarded identity from trusted internal services (e.g. driver-service)
  // that have already validated the JWT at the gateway level.
  const forwardedUserId = req.headers['x-user-id'];
  const forwardedUserRole = req.headers['x-user-role'];

  if (
    typeof forwardedUserId === 'string' &&
    typeof forwardedUserRole === 'string' &&
    forwardedUserId &&
    forwardedUserRole
  ) {
    req.user = {
      userId: forwardedUserId,
      role: forwardedUserRole,
      email: typeof req.headers['x-user-email'] === 'string' ? req.headers['x-user-email'] : undefined,
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No token provided' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      role: string;
      email?: string;
    };

    req.user = {
      userId: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
    next();
  };
};

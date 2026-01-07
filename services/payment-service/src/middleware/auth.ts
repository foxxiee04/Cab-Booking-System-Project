import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload & {
      userId?: string;
      sub?: string;
      email?: string;
      role?: string;
    };

    const userId = decoded.userId ?? (typeof decoded.sub === 'string' ? decoded.sub : undefined);
    if (!userId) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    req.user = {
      userId,
      email: decoded.email ?? '',
      role: decoded.role ?? '',
    };
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

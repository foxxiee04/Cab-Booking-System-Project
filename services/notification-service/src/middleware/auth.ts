import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    role?: string;
  };
};

type JwtPayload = {
  userId?: string;
  sub?: string;
  role?: string;
};

function decodeUserFromToken(authHeader?: string): JwtPayload | null {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || !authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userIdHeader = req.headers['x-user-id'];
  const roleHeader = req.headers['x-user-role'];

  const forwardedUserId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
  const forwardedRole = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;

  if (forwardedUserId) {
    req.user = { userId: String(forwardedUserId), role: forwardedRole ? String(forwardedRole) : undefined };
    return next();
  }

  const decoded = decodeUserFromToken(req.headers.authorization);
  const userId = decoded?.userId || decoded?.sub;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = { userId, role: decoded?.role };
  return next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role || (Array.isArray(req.headers['x-user-role']) ? req.headers['x-user-role'][0] : req.headers['x-user-role']);
    if (!role || !allowedRoles.includes(String(role))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

export type { AuthenticatedRequest };

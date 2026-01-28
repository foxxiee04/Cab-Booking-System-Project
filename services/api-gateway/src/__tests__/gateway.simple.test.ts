import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/auth';

describe('API Gateway - Middleware Tests', () => {
  const JWT_SECRET = 'test-secret';
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    
    mockReq = {
      headers: {},
    } as any;
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  describe('AUTH MIDDLEWARE', () => {
    it('should allow access to public paths', () => {
      Object.defineProperty(mockReq, 'path', { value: '/api/auth/login', writable: true });

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access to health check', () => {
      Object.defineProperty(mockReq, 'path', { value: '/health', writable: true });

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject requests without token', () => {
      Object.defineProperty(mockReq, 'path', { value: '/api/protected', writable: true });
      mockReq.headers = {};

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid JWT token', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', role: 'CUSTOMER' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      Object.defineProperty(mockReq, 'path', { value: '/api/protected', writable: true });
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.userId).toBe('user-123');
      expect(mockReq.user?.role).toBe('CUSTOMER');
      expect(mockReq.headers?.['x-user-id']).toBe('user-123');
      expect(mockReq.headers?.['x-user-role']).toBe('CUSTOMER');
    });

    it('should reject invalid JWT token', () => {
      Object.defineProperty(mockReq, 'path', { value: '/api/protected', writable: true });
      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token', () => {
      const token = jwt.sign(
        { userId: 'user-123', role: 'CUSTOMER' },
        JWT_SECRET,
        { expiresIn: '-1h' } // Expired
      );

      Object.defineProperty(mockReq, 'path', { value: '/api/protected', writable: true });
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow AI estimate endpoint (public)', () => {
      Object.defineProperty(mockReq, 'path', { value: '/api/ai/ride/estimate', writable: true });

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('ROLE-BASED ACCESS CONTROL', () => {
    it('should allow access with correct role', () => {
      mockReq.user = {
        userId: 'admin-123',
        role: 'ADMIN',
      };

      const middleware = requireRole('ADMIN');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access with incorrect role', () => {
      mockReq.user = {
        userId: 'user-123',
        role: 'CUSTOMER',
      };

      const middleware = requireRole('ADMIN');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow multiple roles', () => {
      mockReq.user = {
        userId: 'driver-123',
        role: 'DRIVER',
      };

      const middleware = requireRole('CUSTOMER', 'DRIVER');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject if no user in request', () => {
      mockReq.user = undefined;

      const middleware = requireRole('ADMIN');
      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('HEADER FORWARDING', () => {
    it('should forward user info in headers', () => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@test.com', role: 'CUSTOMER' },
        JWT_SECRET
      );

      Object.defineProperty(mockReq, 'path', { value: '/api/test', writable: true });
      mockReq.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.headers?.['x-user-id']).toBe('user-123');
      expect(mockReq.headers?.['x-user-email']).toBe('test@test.com');
      expect(mockReq.headers?.['x-user-role']).toBe('CUSTOMER');
    });
  });
});

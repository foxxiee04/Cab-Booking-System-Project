import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateRoleSchema,
} from '../validators/auth.validator';
import { logger } from '../utils/logger';

export const createAuthRouter = (authService: AuthService): Router => {
  const router = Router();

  // Register
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const { user, tokens } = await authService.register(value);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          tokens,
        },
      });
    } catch (err) {
      logger.error('Register error:', err);
      const message = err instanceof Error ? err.message : 'Registration failed';
      res.status(400).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message },
      });
    }
  });

  // Login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const { user, tokens } = await authService.login({
        ...value,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          tokens,
        },
      });
    } catch (err) {
      logger.error('Login error:', err);
      const message = err instanceof Error ? err.message : 'Login failed';
      res.status(401).json({
        success: false,
        error: { code: 'LOGIN_FAILED', message },
      });
    }
  });

  // Refresh token
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const tokens = await authService.refreshToken(value.refreshToken);

      res.json({
        success: true,
        data: { tokens },
      });
    } catch (err) {
      logger.error('Refresh token error:', err);
      const message = err instanceof Error ? err.message : 'Token refresh failed';
      res.status(401).json({
        success: false,
        error: { code: 'REFRESH_FAILED', message },
      });
    }
  });

  // Logout
  router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      await authService.logout(req.user!.userId);
      res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (err) {
      logger.error('Logout error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'LOGOUT_FAILED', message: 'Logout failed' },
      });
    }
  });

  // Get current user
  router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const user = await authService.getUserById(req.user!.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
      });
    } catch (err) {
      logger.error('Get user error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' },
      });
    }
  });

  // Verify token (internal endpoint for other services)
  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const token = req.body.token || req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_TOKEN', message: 'Token required' },
        });
      }

      const { userId, role } = await authService.verifyAccessToken(token);
      res.json({ success: true, data: { userId, role, valid: true } });
    } catch {
      res.json({ success: true, data: { valid: false } });
    }
  });

  // Admin: Get all users
  router.get(
    '/users',
    authenticate,
    authorize('ADMIN'),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const { users, total } = await authService.getUsers(page, limit);

        res.json({
          success: true,
          data: { users },
          meta: { page, limit, total },
        });
      } catch (err) {
        logger.error('Get users error:', err);
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to get users' },
        });
      }
    }
  );

  // Admin: Update user role
  router.patch(
    '/users/:userId/role',
    authenticate,
    authorize('ADMIN'),
    async (req: Request, res: Response) => {
      try {
        const { error, value } = updateRoleSchema.validate(req.body);
        if (error) {
          return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
          });
        }

        const user = await authService.updateUserRole(req.params.userId, value.role);
        if (!user) {
          return res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'User not found' },
          });
        }

        res.json({ success: true, data: { user } });
      } catch (err) {
        logger.error('Update role error:', err);
        res.status(500).json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update role' },
        });
      }
    }
  );

  return router;
};

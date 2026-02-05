import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const createAuthRouter = (authService: AuthService): Router => {
  const router = Router();
  const controller = new AuthController(authService);

  // Register
  router.post('/register', controller.register);

  // Login
  router.post('/login', controller.login);

  // Refresh token
  router.post('/refresh', controller.refreshToken);

  // Logout
  router.post('/logout', authenticate, controller.logout);

  // Get current user
  router.get('/me', authenticate, controller.getMe);

  // Verify token (internal endpoint for other services)
  router.post('/verify', controller.verifyToken);

  // Admin: Get all users
  router.get('/users', authenticate, authorize('ADMIN'), controller.getUsers);

  // Admin: Update user role
  router.patch('/users/:userId/role', authenticate, authorize('ADMIN'), controller.updateUserRole);

  return router;
};

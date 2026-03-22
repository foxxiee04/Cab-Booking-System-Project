import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const createAuthRouter = (authService: AuthService): Router => {
  const router = Router();
  const controller = new AuthController(authService);

  // Register new account (INACTIVE until OTP verified)
  router.post('/register', controller.register);

  // Send OTP to phone (login or post-registration activation)
  router.post('/send-otp', controller.sendOtp);

  // Verify OTP and issue JWT
  router.post('/verify-otp', controller.verifyOtp);

  // Refresh access token using refresh token
  router.post('/refresh', controller.refreshToken);

  // Logout (revoke all refresh tokens)
  router.post('/logout', authenticate, controller.logout);

  // Get current user profile
  router.get('/me', authenticate, controller.getMe);

  // Update profile (email, name, avatar)
  router.patch('/me', authenticate, controller.updateMe);

  // Verify token (internal — called by API gateway)
  router.post('/verify', controller.verifyToken);

  // Admin: list all users
  router.get('/users', authenticate, authorize('ADMIN'), controller.getUsers);

  // Admin: change user role
  router.patch('/users/:userId/role', authenticate, authorize('ADMIN'), controller.updateUserRole);

  return router;
};

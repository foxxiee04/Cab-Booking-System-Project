import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const createAuthRouter = (authService: AuthService): Router => {
  const router = Router();
  const controller = new AuthController(authService);

  // Register new account (creates INACTIVE user + auto-sends OTP)
  router.post('/register', controller.register);

  // New registration flow: phone -> OTP -> profile completion
  router.post('/register-phone/start', controller.registerPhoneStart);
  router.post('/register-phone/verify', controller.registerPhoneVerify);
  router.post('/register-phone/complete', controller.registerPhoneComplete);

  // Login with phone + password
  router.post('/login', controller.login);

  // Resend OTP (for registration phone verification)
  router.post('/send-otp', controller.sendOtp);

  // Verify OTP and activate account (returns JWT)
  router.post('/verify-otp', controller.verifyOtp);

  // Forgot password: send OTP to phone
  router.post('/forgot-password', controller.forgotPassword);

  // Reset password: verify OTP and set new password
  router.post('/reset-password', controller.resetPassword);

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

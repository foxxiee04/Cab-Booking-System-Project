import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import {
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  updateRoleSchema,
} from '../validators/auth.validator';
import { updateProfileSchema } from '../dto/auth.dto';
import { logger } from '../utils/logger';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Create a new user account (INACTIVE). Client must then call /send-otp to activate.
   */
  register = async (req: Request, res: Response) => {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      await this.authService.register(value);

      res.status(201).json({
        success: true,
        data: { message: 'Đăng ký thành công. Vui lòng xác minh số điện thoại qua OTP.' },
      });
    } catch (err) {
      logger.error('Register error:', err);
      const message = err instanceof Error ? err.message : 'Đăng ký thất bại';
      res.status(400).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message },
      });
    }
  };

  /**
   * POST /api/auth/send-otp
   * Send a one-time password to the given phone number (for login or registration).
   */
  sendOtp = async (req: Request, res: Response) => {
    try {
      const { error, value } = sendOtpSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const result = await this.authService.sendOtp({
        phone: value.phone,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          message: 'OTP đã được gửi đến số điện thoại của bạn.',
          resendDelay: result.resendDelay,
          ...(result.devOtp && { devOtp: result.devOtp }),
        },
      });
    } catch (err) {
      logger.error('Send OTP error:', err);
      const message = err instanceof Error ? err.message : 'Không thể gửi OTP';
      const status = message.includes('Quá nhiều') ? 429 : 400;
      res.status(status).json({
        success: false,
        error: { code: 'OTP_SEND_FAILED', message },
      });
    }
  };

  /**
   * POST /api/auth/verify-otp
   * Verify OTP and issue JWT tokens. Activates INACTIVE accounts.
   */
  verifyOtp = async (req: Request, res: Response) => {
    try {
      const { error, value } = verifyOtpSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const { user, tokens } = await this.authService.verifyOtpAndLogin({
        phone: value.phone,
        otp: value.otp,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            role: user.role,
            status: user.status,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
          },
          tokens,
        },
      });
    } catch (err) {
      logger.error('Verify OTP error:', err);
      const message = err instanceof Error ? err.message : 'Xác minh OTP thất bại';
      res.status(401).json({
        success: false,
        error: { code: 'OTP_VERIFY_FAILED', message },
      });
    }
  };

  refreshToken = async (req: Request, res: Response) => {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const tokens = await this.authService.refreshToken(value.refreshToken);

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
  };

  logout = async (req: AuthRequest, res: Response) => {
    try {
      await this.authService.logout(req.user!.userId);
      res.json({ success: true, data: { message: 'Đăng xuất thành công' } });
    } catch (err) {
      logger.error('Logout error:', err);
      res.status(500).json({
        success: false,
        error: { code: 'LOGOUT_FAILED', message: 'Logout failed' },
      });
    }
  };

  getMe = async (req: AuthRequest, res: Response) => {
    try {
      const user = await this.authService.getUserById(req.user!.userId);
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
            phone: user.phone,
            phoneNumber: user.phone,
            email: user.email,
            role: user.role,
            status: user.status,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
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
  };

  updateMe = async (req: AuthRequest, res: Response) => {
    try {
      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const user = await this.authService.updateProfile(req.user!.userId, value);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            phoneNumber: user.phone,
            email: user.email,
            role: user.role,
            status: user.status,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
          },
        },
      });
    } catch (err) {
      logger.error('Update profile error:', err);
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      res.status(400).json({
        success: false,
        error: { code: 'PROFILE_UPDATE_FAILED', message },
      });
    }
  };

  verifyToken = async (req: Request, res: Response) => {
    try {
      const token = req.body.token || req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_TOKEN', message: 'Token required' },
        });
      }

      const { userId, role } = await this.authService.verifyAccessToken(token);
      res.json({ success: true, data: { userId, role, valid: true } });
    } catch {
      res.json({ success: true, data: { valid: false } });
    }
  };

  getUsers = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const { users, total } = await this.authService.getUsers(page, limit);

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
  };

  updateUserRole = async (req: Request, res: Response) => {
    try {
      const { error, value } = updateRoleSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const user = await this.authService.updateUserRole(req.params.userId, value.role);
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
  };
}

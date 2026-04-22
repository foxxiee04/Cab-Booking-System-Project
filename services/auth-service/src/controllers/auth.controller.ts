import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  updateRoleSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  registerPhoneStartSchema,
  registerPhoneVerifySchema,
  registerCompleteSchema,
} from '../validators/auth.validator';
import { updateProfileSchema } from '../dto/auth.dto';
import { UserRole } from '../generated/prisma-client';
import { logger } from '../utils/logger';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/register-phone/start
   * Step 1: send OTP to phone before collecting profile info.
   */
  registerPhoneStart = async (req: Request, res: Response) => {
    try {
      const { error, value } = registerPhoneStartSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const result = await this.authService.startPhoneRegistration(value.phone, req.ip);

      res.json({
        success: true,
        data: {
          message: `OTP đã gửi tới ${result.maskedPhone}`,
          resendDelay: result.resendDelay,
          expiresInSeconds: result.expiresInSeconds,
          maxAttempts: result.maxAttempts,
          deliveryMethod: result.deliveryMethod,
        },
      });
    } catch (err) {
      logger.error('Register phone start error:', err);
      const message = err instanceof Error ? err.message : 'Không thể gửi OTP xác thực đăng ký';
      const status = message.includes('Quá nhiều') ? 429 : 400;
      res.status(status).json({
        success: false,
        error: { code: 'REGISTER_PHONE_START_FAILED', message },
      });
    }
  };

  /**
   * POST /api/auth/register-phone/verify
   * Step 2: verify OTP for registration phone.
   */
  registerPhoneVerify = async (req: Request, res: Response) => {
    try {
      const { error, value } = registerPhoneVerifySchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      await this.authService.verifyPhoneForRegistration(value.phone, value.otp, req.ip);

      res.json({
        success: true,
        data: { message: 'Xác thực số điện thoại thành công. Vui lòng tiếp tục điền thông tin đăng ký.' },
      });
    } catch (err) {
      logger.error('Register phone verify error:', err);
      const message = err instanceof Error ? err.message : 'Xác thực OTP đăng ký thất bại';
      // 422 Unprocessable Entity — wrong/expired OTP is a domain error, not an auth failure
      res.status(422).json({
        success: false,
        error: { code: 'REGISTER_PHONE_VERIFY_FAILED', message },
      });
    }
  };

  /**
   * POST /api/auth/register-phone/complete
   * Step 3: create account after phone verified.
   */
  registerPhoneComplete = async (req: Request, res: Response) => {
    try {
      const { error, value } = registerCompleteSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const { user, tokens } = await this.authService.completeRegistration({
        phone: value.phone,
        password: value.password,
        role: value.role,
        firstName: value.firstName,
        lastName: value.lastName,
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      res.status(201).json({
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
      logger.error('Register phone complete error:', err);
      const message = err instanceof Error ? err.message : 'Hoàn tất đăng ký thất bại';
      res.status(400).json({
        success: false,
        error: { code: 'REGISTER_PHONE_COMPLETE_FAILED', message },
      });
    }
  };

  /**
   * POST /api/auth/register
   * Create a new user account (INACTIVE) and auto-send OTP for phone verification.
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

      const result = await this.authService.register(value);

      res.status(201).json({
        success: true,
        data: {
          message: `OTP đã gửi tới ${result.maskedPhone}`,
          resendDelay: result.resendDelay,
          expiresInSeconds: result.expiresInSeconds,
          maxAttempts: result.maxAttempts,
          deliveryMethod: result.deliveryMethod,
        },
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
   * POST /api/auth/login
   * Login with identifier (admin account), email, or phone number plus password.
   */
  login = async (req: Request, res: Response) => {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const { user, tokens } = await this.authService.login({
        identifier: value.identifier,
        email: value.email,
        phone: value.phone,
        password: value.password,
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
      logger.error('Login error:', err);
      const message = err instanceof Error ? err.message : 'Đăng nhập thất bại';
      res.status(401).json({
        success: false,
        error: { code: 'LOGIN_FAILED', message },
      });
    }
  };

  /**
   * POST /api/auth/send-otp
   * Resend OTP to the given phone number (for phone verification during registration).
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
          message: `OTP đã gửi tới ${result.maskedPhone}`,
          resendDelay: result.resendDelay,
          expiresInSeconds: result.expiresInSeconds,
          maxAttempts: result.maxAttempts,
          deliveryMethod: result.deliveryMethod,
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
      res.status(422).json({
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

  changePassword = async (req: AuthRequest, res: Response) => {
    try {
      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      await this.authService.changePassword(
        req.user!.userId,
        value.currentPassword,
        value.newPassword,
        req.ip,
      );

      res.json({
        success: true,
        data: { message: 'Mật khẩu đã được cập nhật. Các phiên đăng nhập cũ đã được thu hồi.' },
      });
    } catch (err) {
      logger.error('Change password error:', err);
      const message = err instanceof Error ? err.message : 'Không thể cập nhật mật khẩu';
      res.status(400).json({
        success: false,
        error: { code: 'CHANGE_PASSWORD_FAILED', message },
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
      const roleParam = typeof req.query.role === 'string' ? req.query.role.toUpperCase() : undefined;
      const role = roleParam === 'CUSTOMER' || roleParam === 'DRIVER' || roleParam === 'ADMIN'
        ? roleParam as UserRole
        : undefined;

      const { users, total } = await this.authService.getUsers(page, limit, role);

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

  /**
   * POST /api/auth/forgot-password
   * Send OTP to phone for password reset flow.
   */
  forgotPassword = async (req: Request, res: Response) => {
    try {
      const { error, value } = forgotPasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      const result = await this.authService.forgotPassword(value.phone, req.ip);

      res.json({
        success: true,
        data: {
          message: `OTP đã gửi tới ${result.maskedPhone}`,
          resendDelay: result.resendDelay,
          expiresInSeconds: result.expiresInSeconds,
          maxAttempts: result.maxAttempts,
          deliveryMethod: result.deliveryMethod,
        },
      });
    } catch (err) {
      logger.error('Forgot password error:', err);
      const message = err instanceof Error ? err.message : 'Không thể gửi OTP';
      const status = message.includes('Quá nhiều') ? 429 : 400;
      res.status(status).json({
        success: false,
        error: { code: 'FORGOT_PASSWORD_FAILED', message },
      });
    }
  };

  /**
   * POST /api/auth/reset-password
   * Verify OTP and set new password.
   */
  resetPassword = async (req: Request, res: Response) => {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.details[0].message },
        });
      }

      await this.authService.resetPassword(value.phone, value.otp, value.newPassword, req.ip);

      res.json({
        success: true,
        data: { message: 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập lại.' },
      });
    } catch (err) {
      logger.error('Reset password error:', err);
      const message = err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại';
      res.status(400).json({
        success: false,
        error: { code: 'RESET_PASSWORD_FAILED', message },
      });
    }
  };
}

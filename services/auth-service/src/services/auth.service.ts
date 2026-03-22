import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, UserStatus } from '../generated/prisma-client';
import { config } from '../config';
import { prisma } from '../config/db';
import { EventPublisher } from '../events/publisher';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { auditLog } from '../utils/audit';

interface RegisterInput {
  phone: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
}

interface SendOtpInput {
  phone: string;
  ipAddress?: string;
}

interface VerifyOtpInput {
  phone: string;
  otp: string;
  deviceInfo?: string;
  ipAddress?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface UserResponse {
  id: string;
  phone: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateProfileInput {
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  email?: string;
}

export class AuthService {
  private eventPublisher: EventPublisher;
  private otpService: OtpService;
  private smsService: SmsService;

  constructor(eventPublisher: EventPublisher, otpService: OtpService) {
    this.eventPublisher = eventPublisher;
    this.otpService = otpService;
    this.smsService = new SmsService();
  }

  /**
   * Step 1 of Registration: create user account (INACTIVE) then send OTP.
   * After OTP verification the account is activated.
   */
  async register(input: RegisterInput): Promise<void> {
    // Prevent duplicate phone registrations
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new Error('Số điện thoại này đã được đăng ký.');
    }

    await prisma.user.create({
      data: {
        phone: input.phone,
        role: input.role || UserRole.CUSTOMER,
        status: UserStatus.INACTIVE, // activated after OTP verification
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    await auditLog({ action: 'REGISTER', phone: input.phone, success: true });
  }

  /**
   * Send OTP to a phone number.
   * Works for both login (existing user) and registration (newly created user).
   */
  async sendOtp(input: SendOtpInput): Promise<{ resendDelay: number; devOtp?: string }> {
    const ip = input.ipAddress || 'unknown';

    // Rate limit check
    const rateLimitError = await this.otpService.checkRateLimit(input.phone, ip);
    if (rateLimitError) {
      await auditLog({
        action: 'RATE_LIMIT_HIT',
        phone: input.phone,
        ipAddress: ip,
        success: false,
        metadata: { reason: rateLimitError },
      });
      throw new Error(rateLimitError);
    }

    // Resend cooldown check
    const resendDelay = await this.otpService.getResendDelay(input.phone);
    if (resendDelay > 0) {
      throw new Error(`Vui lòng đợi ${resendDelay} giây trước khi yêu cầu OTP mới.`);
    }

    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(input.phone, otp);
    await this.smsService.sendOtp(input.phone, otp);

    await auditLog({ action: 'OTP_REQUESTED', phone: input.phone, ipAddress: ip, success: true });

    // Return the delay for the NEXT resend attempt
    const nextDelay = await this.otpService.getResendDelay(input.phone);
    const result: { resendDelay: number; devOtp?: string } = { resendDelay: nextDelay };
    // Expose OTP in non-production for integration testing (never enabled in production)
    if (process.env.NODE_ENV !== 'production') {
      result.devOtp = otp;
    }
    return result;
  }

  /**
   * Step 2 (Login): Verify OTP and issue JWT tokens.
   * Also activates INACTIVE accounts (newly registered users).
   */
  async verifyOtpAndLogin(
    input: VerifyOtpInput,
  ): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const ip = input.ipAddress || 'unknown';

    const result = await this.otpService.verifyOtp(input.phone, input.otp);

    if (!result.success) {
      await auditLog({
        action: 'OTP_FAILED',
        phone: input.phone,
        ipAddress: ip,
        success: false,
        metadata: { reason: result.error },
      });
      throw new Error(result.error);
    }

    // Find user (must exist)
    const user = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (!user) {
      throw new Error('Tài khoản không tồn tại. Vui lòng đăng ký trước.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }

    // Activate INACTIVE account (newly registered via /register)
    const activeUser =
      user.status === UserStatus.INACTIVE
        ? await prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.ACTIVE },
          })
        : user;

    // Clear resend cooldown after successful verification
    await this.otpService.clearResendCooldown(input.phone);

    const tokens = await this.generateTokenPair(activeUser.id, input.deviceInfo, ip);

    await auditLog({
      action: 'LOGIN_SUCCESS',
      userId: activeUser.id,
      phone: activeUser.phone,
      ipAddress: ip,
      success: true,
    });
    await auditLog({ action: 'OTP_VERIFIED', phone: activeUser.phone, success: true });

    await this.eventPublisher.publish('user.logged_in', {
      userId: activeUser.id,
      phone: activeUser.phone,
      role: activeUser.role,
    });

    return { user: this.toUserResponse(activeUser), tokens };
  }

  async refreshToken(refreshTokenValue: string): Promise<TokenPair> {
    // Verify refresh token
    let decoded: { sub: string; tokenId: string };
    try {
      decoded = jwt.verify(refreshTokenValue, config.jwt.refreshSecret) as typeof decoded;
    } catch {
      throw new Error('Invalid refresh token');
    }

    // Find token in database
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenId: decoded.tokenId,
        userId: decoded.sub,
        revokedAt: null,
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new Error('Refresh token expired or revoked');
    }

    // Revoke old token (rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('User not found or inactive');
    }

    // Generate new token pair
    return this.generateTokenPair(user.id);
  }

  async logout(userId: string, tokenId?: string): Promise<void> {
    if (tokenId) {
      // Revoke specific token
      await prisma.refreshToken.updateMany({
        where: { tokenId, userId },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all tokens for user
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; role: string }> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { sub: string; role: string };
      return { userId: decoded.sub, role: decoded.role };
    } catch {
      throw new Error('Invalid access token');
    }
  }

  async getUserById(userId: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user ? this.toUserResponse(user) : null;
  }

  async getUsers(page = 1, limit = 20): Promise<{ users: UserResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return {
      users: users.map(u => this.toUserResponse(u)),
      total,
    };
  }

  async updateUserRole(userId: string, role: UserRole): Promise<UserResponse | null> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    if (user) {
      await this.eventPublisher.publish('user.role_changed', {
        userId: user.id,
        newRole: role,
      });
    }

    return this.toUserResponse(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserResponse> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        // Email is now optional profile info
        email:
          typeof input.email === 'string'
            ? input.email.trim() !== ''
              ? input.email.trim().toLowerCase()
              : null
            : undefined,
        firstName:
          typeof input.profile?.firstName === 'string'
            ? input.profile.firstName.trim() !== ''
              ? input.profile.firstName.trim()
              : null
            : undefined,
        lastName:
          typeof input.profile?.lastName === 'string'
            ? input.profile.lastName.trim() !== ''
              ? input.profile.lastName.trim()
              : null
            : undefined,
        avatar:
          typeof input.profile?.avatar === 'string'
            ? input.profile.avatar.trim() !== ''
              ? input.profile.avatar.trim()
              : null
            : undefined,
      },
    });

    await this.eventPublisher.publish('user.profile_updated', {
      userId: user.id,
      role: user.role,
    });

    await auditLog({ action: 'PROFILE_UPDATED', userId: user.id, phone: user.phone });

    return this.toUserResponse(user);
  }

  private async generateTokenPair(
    userId: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<TokenPair> {
    const tokenId = uuidv4();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Access token — phone replaces email as identity claim
    const accessToken = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        phone: user.phone,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
    );

    const refreshExpiresIn = this.parseExpiry(config.jwt.refreshExpiresIn);
    const expiresAt = new Date(Date.now() + refreshExpiresIn);

    const refreshToken = jwt.sign(
      { sub: user.id, tokenId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'] }
    );

    await prisma.refreshToken.create({
      data: { tokenId, userId: user.id, expiresAt, deviceInfo, ipAddress },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(config.jwt.expiresIn) / 1000,
    };
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }

  private toUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export { prisma };

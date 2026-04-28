import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
  password: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
}

interface LoginInput {
  phone?: string;
  email?: string;
  identifier?: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

interface SendOtpInput {
  phone: string;
  ipAddress?: string;
}

interface OtpDeliveryResult {
  resendDelay: number;
  maskedPhone: string;
  expiresInSeconds: number;
  maxAttempts: number;
  deliveryMethod: 'SERVER_LOG' | 'SMS';
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
   * Step 1 of Registration: create user account (INACTIVE), hash password, then auto-send OTP.
   * After OTP verification the account is activated.
   */
  async register(input: RegisterInput): Promise<OtpDeliveryResult> {
    // Prevent duplicate phone registrations
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new Error('Số điện thoại này đã được đăng ký.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    await prisma.user.create({
      data: {
        phone: input.phone,
        passwordHash,
        role: input.role || UserRole.CUSTOMER,
        status: UserStatus.INACTIVE, // activated after OTP verification
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    await auditLog({ action: 'REGISTER', phone: input.phone, success: true });

    // Auto-send OTP for phone verification
    return this.sendOtp({ phone: input.phone });
  }

  /**
   * New registration flow - Step 1: request OTP by phone first.
   */
  async startPhoneRegistration(phone: string, ipAddress?: string): Promise<OtpDeliveryResult> {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new Error('Số điện thoại này đã được đăng ký.');
    }

    return this.sendOtp({ phone, ipAddress }, 'register');
  }

  /**
   * New registration flow - Step 2: verify OTP and mark phone verified for completion.
   */
  async verifyPhoneForRegistration(phone: string, otp: string, ipAddress?: string): Promise<void> {
    const ip = ipAddress || 'unknown';
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new Error('Số điện thoại này đã được đăng ký.');
    }

    const result = await this.otpService.verifyOtp(phone, otp, 'register');
    if (!result.success) {
      await auditLog({
        action: 'OTP_FAILED',
        phone,
        ipAddress: ip,
        success: false,
        metadata: { reason: result.error },
      });
      throw new Error(result.error);
    }

    await this.otpService.markPhoneVerifiedForRegistration(phone);
    await this.otpService.clearResendCooldown(phone, 'register');
    await auditLog({ action: 'OTP_VERIFIED', phone, ipAddress: ip, success: true });
  }

  /**
   * New registration flow - Step 3: complete profile after phone has been verified.
   */
  async completeRegistration(
    input: RegisterInput & { deviceInfo?: string; ipAddress?: string },
  ): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const ip = input.ipAddress || 'unknown';

    const isVerified = await this.otpService.isPhoneVerifiedForRegistration(input.phone);
    if (!isVerified) {
      throw new Error('Số điện thoại chưa được xác thực. Vui lòng xác minh OTP trước.');
    }

    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      await this.otpService.clearPhoneVerifiedForRegistration(input.phone);
      throw new Error('Số điện thoại này đã được đăng ký.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        phone: input.phone,
        passwordHash,
        role: input.role || UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    await this.otpService.clearPhoneVerifiedForRegistration(input.phone);

    const tokens = await this.generateTokenPair(user.id, input.deviceInfo, ip);

    await auditLog({ action: 'REGISTER', phone: input.phone, userId: user.id, ipAddress: ip, success: true });
    await auditLog({ action: 'LOGIN_SUCCESS', phone: input.phone, userId: user.id, ipAddress: ip, success: true });
    await this.eventPublisher.publish('user.logged_in', {
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    return { user: this.toUserResponse(user), tokens };
  }

  /**
   * Login with identifier/email/phone + password. Returns JWT token pair.
   */
  async login(input: LoginInput): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const ip = input.ipAddress || 'unknown';

    const rawIdentifier = (input.identifier || input.email || input.phone || '').trim();
    if (!rawIdentifier) {
      throw new Error('Vui lòng nhập tài khoản đăng nhập.');
    }

    const normalizedIdentifier = rawIdentifier.toLowerCase();
    const isPhoneIdentifier = /^0\d{9}$/.test(rawIdentifier);

    let user = isPhoneIdentifier
      ? await prisma.user.findUnique({ where: { phone: rawIdentifier } })
      : await prisma.user.findFirst({
          where: {
            OR: [
              { email: normalizedIdentifier },
              { phone: rawIdentifier },
            ],
          },
        });

    if (!user && normalizedIdentifier === 'admin') {
      user = await prisma.user.findFirst({
        where: { role: UserRole.ADMIN },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!user) {
      await auditLog({
        action: 'LOGIN_FAILED',
        phone: input.phone,
        ipAddress: ip,
        success: false,
        metadata: { reason: 'user_not_found', identifier: rawIdentifier },
      });
      throw new Error('Tài khoản hoặc mật khẩu không đúng.');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new Error('Tài khoản chưa được xác minh. Vui lòng hoàn tất đăng ký.');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }
    if (!user.passwordHash) {
      throw new Error('Tài khoản này không có mật khẩu. Vui lòng liên hệ hỗ trợ.');
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatch) {
      await auditLog({ action: 'LOGIN_FAILED', phone: input.phone, ipAddress: ip, success: false, metadata: { reason: 'wrong_password' } });
      throw new Error('Tài khoản hoặc mật khẩu không đúng.');
    }

    const tokens = await this.generateTokenPair(user.id, input.deviceInfo, ip);
    await auditLog({ action: 'LOGIN_SUCCESS', userId: user.id, phone: user.phone, ipAddress: ip, success: true });
    await this.eventPublisher.publish('user.logged_in', { userId: user.id, phone: user.phone, role: user.role });

    return { user: this.toUserResponse(user), tokens };
  }

  /**
   * Send OTP to a phone number.
   * purpose='register' for phone verification during sign-up.
   * purpose='reset' for forgot-password flow.
   */
  async sendOtp(
    input: SendOtpInput,
    purpose: 'register' | 'reset' = 'register',
  ): Promise<OtpDeliveryResult> {
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
    const resendDelay = await this.otpService.getResendDelay(input.phone, purpose);
    if (resendDelay > 0) {
      throw new Error(`Vui lòng đợi ${resendDelay} giây trước khi yêu cầu OTP mới.`);
    }

    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(input.phone, otp, purpose);
    await this.smsService.sendOtp(input.phone, otp, purpose);
    // In mock mode store plaintext so the /internal/dev/otp endpoint can return it
    if (config.sms.mode === 'mock') {
      await this.otpService.storePlainOtp(input.phone, otp, purpose);
    }

    await auditLog({
      action: 'OTP_REQUESTED',
      phone: input.phone,
      ipAddress: ip,
      success: true,
      metadata: { purpose, maskedPhone: this.maskPhone(input.phone) },
    });

    // Return the delay for the NEXT resend attempt
    const nextDelay = await this.otpService.getResendDelay(input.phone, purpose);
    return {
      resendDelay: nextDelay,
      maskedPhone: this.maskPhone(input.phone),
      expiresInSeconds: config.otp.ttlSeconds,
      maxAttempts: config.otp.maxAttempts,
      deliveryMethod: config.sms.mode === 'mock' ? 'SERVER_LOG' : 'SMS',
    };
  }

  /**
   * Step 2 (Login): Verify OTP and issue JWT tokens.
   * Also activates INACTIVE accounts (newly registered users).
   */
  async verifyOtpAndLogin(
    input: VerifyOtpInput,
  ): Promise<{ user: UserResponse; tokens: TokenPair }> {
    const ip = input.ipAddress || 'unknown';

    const result = await this.otpService.verifyOtp(input.phone, input.otp, 'register');

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

    // Clear resend cooldown after successful registration verification
    await this.otpService.clearResendCooldown(input.phone, 'register');

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

  /**
   * Forgot Password Step 1: Send OTP to phone (user must exist and be ACTIVE).
   */
  async forgotPassword(
    phone: string,
    ipAddress?: string,
  ): Promise<OtpDeliveryResult> {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      await auditLog({
        action: 'OTP_REQUESTED',
        phone,
        ipAddress,
        success: true,
        metadata: { purpose: 'reset', maskedPhone: this.maskPhone(phone), userExists: false },
      });
      return {
        resendDelay: 0,
        maskedPhone: this.maskPhone(phone),
        expiresInSeconds: config.otp.ttlSeconds,
        maxAttempts: config.otp.maxAttempts,
        deliveryMethod: config.sms.mode === 'mock' ? 'SERVER_LOG' : 'SMS',
      };
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new Error('Tài khoản chưa được xác minh. Vui lòng hoàn tất đăng ký trước.');
    }
    return this.sendOtp({ phone, ipAddress }, 'reset');
  }

  maskPhone(phone: string): string {
    const normalized = phone.replace(/\D/g, '');

    if (!normalized) {
      return '+84****xxx';
    }

    const localPhone = normalized.startsWith('84') ? `0${normalized.slice(2)}` : normalized;
    const national = localPhone.startsWith('0') ? localPhone.slice(1) : localPhone;

    if (national.length < 3) {
      return '+84****xxx';
    }

    return `+84****${national.slice(-3)}`;
  }

  /**
   * Forgot Password Step 2: Verify OTP and set new password.
   */
  async resetPassword(
    phone: string,
    otp: string,
    newPassword: string,
    ipAddress?: string,
  ): Promise<void> {
    const ip = ipAddress || 'unknown';

    const result = await this.otpService.verifyOtp(phone, otp, 'reset');
    if (!result.success) {
      await auditLog({
        action: 'OTP_FAILED',
        phone,
        ipAddress: ip,
        success: false,
        metadata: { reason: result.error, purpose: 'reset' },
      });
      throw new Error(result.error);
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw new Error('Tài khoản không tồn tại.');
    if (user.status === UserStatus.SUSPENDED) {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke all existing sessions after password reset
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.otpService.clearResendCooldown(phone, 'reset');
    await auditLog({ action: 'OTP_VERIFIED', phone, ipAddress: ip, success: true });
    await auditLog({
      action: 'PROFILE_UPDATED',
      userId: user.id,
      phone,
      ipAddress: ip,
      success: true,
      metadata: { action: 'password_reset' },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
  ): Promise<void> {
    const ip = ipAddress || 'unknown';

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Tài khoản không tồn tại.');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }
    if (!user.passwordHash) {
      throw new Error('Tài khoản này chưa có mật khẩu khả dụng.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('Mật khẩu hiện tại không đúng.');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await auditLog({
      action: 'PROFILE_UPDATED',
      userId: user.id,
      phone: user.phone,
      ipAddress: ip,
      success: true,
      metadata: { action: 'password_changed' },
    });
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

  async getUsers(page = 1, limit = 20, role?: UserRole): Promise<{ users: UserResponse[]; total: number }> {
    const skip = (page - 1) * limit;
    const where = role ? { role } : undefined;
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
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

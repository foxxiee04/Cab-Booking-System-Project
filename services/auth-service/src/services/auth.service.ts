import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, IUser, UserRole, UserStatus } from '../models/user.model';
import { RefreshToken } from '../models/refresh-token.model';
import { config } from '../config';
import { EventPublisher } from '../events/publisher';

interface RegisterInput {
  email: string;
  password: string;
  phone?: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
}

interface LoginInput {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  async register(input: RegisterInput): Promise<{ user: IUser; tokens: TokenPair }> {
    // Check if user exists
    const existingUser = await User.findOne({ email: input.email.toLowerCase() });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Create user
    const user = new User({
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      role: input.role || UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      profile: {
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    await user.save();

    // Generate tokens
    const tokens = await this.generateTokenPair(user);

    // Publish event
    await this.eventPublisher.publish('user.registered', {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return { user, tokens };
  }

  async login(input: LoginInput): Promise<{ user: IUser; tokens: TokenPair }> {
    // Find user
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check status
    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Account is not active');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(user, input.deviceInfo, input.ipAddress);

    // Publish event
    await this.eventPublisher.publish('user.logged_in', {
      userId: user._id.toString(),
      email: user.email,
    });

    return { user, tokens };
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
    const storedToken = await RefreshToken.findOne({
      tokenId: decoded.tokenId,
      userId: decoded.sub,
      revokedAt: null,
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new Error('Refresh token expired or revoked');
    }

    // Revoke old token (rotation)
    storedToken.revokedAt = new Date();
    await storedToken.save();

    // Get user
    const user = await User.findById(decoded.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('User not found or inactive');
    }

    // Generate new token pair
    return this.generateTokenPair(user);
  }

  async logout(userId: string, tokenId?: string): Promise<void> {
    if (tokenId) {
      // Revoke specific token
      await RefreshToken.updateOne(
        { tokenId, userId },
        { revokedAt: new Date() }
      );
    } else {
      // Revoke all tokens for user
      await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { revokedAt: new Date() }
      );
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

  async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId).select('-passwordHash');
  }

  async getUsers(page = 1, limit = 20): Promise<{ users: IUser[]; total: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find().select('-passwordHash').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(),
    ]);
    return { users, total };
  }

  async updateUserRole(userId: string, role: UserRole): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-passwordHash');

    if (user) {
      await this.eventPublisher.publish('user.role_changed', {
        userId: user._id.toString(),
        newRole: role,
      });
    }

    return user;
  }

  private async generateTokenPair(
    user: IUser,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<TokenPair> {
    const tokenId = uuidv4();

    // Access token (short-lived)
    const accessToken = jwt.sign(
      {
        sub: user._id.toString(),
        role: user.role,
        email: user.email,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
    );

    // Calculate refresh token expiry
    const refreshExpiresIn = this.parseExpiry(config.jwt.refreshExpiresIn);
    const expiresAt = new Date(Date.now() + refreshExpiresIn);

    // Refresh token
    const refreshToken = jwt.sign(
      {
        sub: user._id.toString(),
        tokenId,
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'] }
    );

    // Store refresh token
    await RefreshToken.create({
      tokenId,
      userId: user._id,
      expiresAt,
      deviceInfo,
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(config.jwt.expiresIn) / 1000, // seconds
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
}

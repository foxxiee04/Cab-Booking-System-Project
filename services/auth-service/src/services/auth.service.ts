import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { config } from '../config';
import { EventPublisher } from '../events/publisher';

const prisma = new PrismaClient();

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

interface UserResponse {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthService {
  private eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  async register(input: RegisterInput): Promise<{ user: UserResponse; tokens: TokenPair }> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        phone: input.phone,
        passwordHash,
        role: input.role || UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id);

    // Publish event
    await this.eventPublisher.publish('user.registered', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const userResponse = this.toUserResponse(user);
    return { user: userResponse, tokens };
  }

  async login(input: LoginInput): Promise<{ user: UserResponse; tokens: TokenPair }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

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
    const tokens = await this.generateTokenPair(user.id, input.deviceInfo, input.ipAddress);

    // Publish event
    await this.eventPublisher.publish('user.logged_in', {
      userId: user.id,
      email: user.email,
    });

    const userResponse = this.toUserResponse(user);
    return { user: userResponse, tokens };
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

  private async generateTokenPair(
    userId: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<TokenPair> {
    const tokenId = uuidv4();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Access token (short-lived)
    const accessToken = jwt.sign(
      {
        sub: user.id,
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
        sub: user.id,
        tokenId,
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'] }
    );

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        tokenId,
        userId: user.id,
        expiresAt,
        deviceInfo,
        ipAddress,
      },
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

  private toUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
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

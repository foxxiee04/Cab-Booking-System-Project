import { prisma } from '../config/db';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

export class UserService {
  private eventPublisher?: EventPublisher;

  constructor(eventPublisher?: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  async createProfileFromAuth(data: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    try {
      const existing = await prisma.userProfile.findUnique({
        where: { userId: data.userId },
      });

      if (existing) {
        logger.warn('User profile already exists', { userId: data.userId });
        return existing;
      }

      const profile = await prisma.userProfile.create({
        data: {
          userId: data.userId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          status: 'ACTIVE',
        },
      });

      logger.info('User profile created', { userId: data.userId });

      await this.eventPublisher?.publish('user.profile.created', {
        userId: profile.userId,
        profileId: profile.id,
      });

      return profile;
    } catch (error) {
      logger.error('Failed to create user profile:', error);
      throw error;
    }
  }

  async getProfile(userId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('User profile not found');
    }

    return profile;
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    dateOfBirth?: Date;
    address?: string;
    city?: string;
    country?: string;
  }) {
    const profile = await prisma.userProfile.update({
      where: { userId },
      data,
    });

    await this.eventPublisher?.publish('user.profile.updated', {
      userId: profile.userId,
      profileId: profile.id,
    });

    return profile;
  }

  async updateStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'BANNED' | 'SUSPENDED') {
    const profile = await prisma.userProfile.update({
      where: { userId },
      data: { status },
    });

    await this.eventPublisher?.publish('user.status.changed', {
      userId: profile.userId,
      status,
    });

    return profile;
  }

  async deleteProfile(userId: string) {
    await prisma.userProfile.delete({
      where: { userId },
    });

    await this.eventPublisher?.publish('user.profile.deleted', {
      userId,
    });
  }
}

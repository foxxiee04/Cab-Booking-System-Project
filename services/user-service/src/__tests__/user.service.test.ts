// Mock Prisma before imports
const mockPrisma = {
  userProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('../config/db', () => ({
  prisma: mockPrisma,
}));

jest.mock('../events/publisher');

import { UserService } from '../services/user.service';
import { EventPublisher } from '../events/publisher';

describe('UserService - Complete Test Suite', () => {
  let userService: UserService;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks
    mockPrisma.userProfile.create.mockReset();
    mockPrisma.userProfile.findUnique.mockReset();
    mockPrisma.userProfile.update.mockReset();
    mockPrisma.userProfile.delete.mockReset();

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn(),
      close: jest.fn(),
    } as any;

    userService = new UserService(mockEventPublisher);
  });

  describe('CREATE PROFILE', () => {
    it('should create user profile from auth event', async () => {
      const profileData = {
        userId: 'user-123',
        firstName: 'Nguyen',
        lastName: 'Van A',
        phone: '+84901234567',
      };

      mockPrisma.userProfile.findUnique.mockResolvedValue(null);
      mockPrisma.userProfile.create.mockResolvedValue({
        id: 'profile-123',
        ...profileData,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await userService.createProfileFromAuth(profileData);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
    });

    it('should not create duplicate profile', async () => {
      const existing = {
        id: 'existing-profile',
        userId: 'user-123',
        firstName: 'Test',
        lastName: 'User',
      };
      
      mockPrisma.userProfile.findUnique.mockResolvedValue(existing);

      const result = await userService.createProfileFromAuth({
        userId: 'user-123',
        firstName: 'Test',
        lastName: 'User',
      });
      
      expect(result).toEqual(existing);
      expect(mockPrisma.userProfile.create).not.toHaveBeenCalled();
    });
  });

  describe('UPDATE PROFILE', () => {
    it('should update user profile', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'profile-123',
        userId: 'user-123',
      });

      mockPrisma.userProfile.update.mockResolvedValue({
        id: 'profile-123',
        firstName: 'Updated',
        lastName: 'Name',
      } as any);

      const result = await userService.updateProfile('user-123', {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(result.firstName).toBe('Updated');
    });

    it('should update avatar through updateProfile', async () => {
      mockPrisma.userProfile.update.mockResolvedValue({
        id: 'profile-123',
        userId: 'user-123',
        avatar: 'https://cdn.example.com/avatar.jpg',
      } as any);

      const result = await userService.updateProfile('user-123', {
        avatar: 'https://cdn.example.com/avatar.jpg'
      });

      expect(result.avatar).toContain('avatar.jpg');
    });

    it('should publish event after update', async () => {
      mockPrisma.userProfile.update.mockResolvedValue({
        id: 'profile-123',
        userId: 'user-123',
      } as any);

      await userService.updateProfile('user-123', { firstName: 'Updated' });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'user.profile.updated',
        expect.objectContaining({ userId: 'user-123' })
      );
    });
  });

  describe('GET PROFILE', () => {
    it('should get user profile by userId', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue({
        id: 'profile-123',
        userId: 'user-123',
        firstName: 'Nguyen',
        lastName: 'Van A',
      });

      const result = await userService.getProfile('user-123');

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
    });

    it('should throw error if profile not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      await expect(userService.getProfile('non-existent')).rejects.toThrow('User profile not found');
    });
  });

  describe('DELETE PROFILE', () => {
    it('should delete profile and publish event', async () => {
      mockPrisma.userProfile.delete.mockResolvedValue({
        id: 'profile-123',
        userId: 'user-123',
      } as any);

      await userService.deleteProfile('user-123');

      expect(mockPrisma.userProfile.delete).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'user.profile.deleted',
        { userId: 'user-123' }
      );
    });
  });

  describe('EDGE CASES', () => {
    it('should handle null inputs gracefully', async () => {
      await expect(userService.createProfileFromAuth(null as any)).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockPrisma.userProfile.create.mockRejectedValue(new Error('Database error'));

      await expect(
        userService.createProfileFromAuth({
          userId: 'user-123',
          firstName: 'Test',
          lastName: 'User',
        })
      ).rejects.toThrow('Database error');
    });
  });
});

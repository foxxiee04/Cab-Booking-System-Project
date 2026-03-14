// Mock Prisma Client before any imports
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../config/db', () => ({
  prisma: mockPrisma,
}));

import { getUserProfile, createUserProfile } from '../services/user.service';

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==============================
  // getUserProfile
  // ==============================
  describe('getUserProfile', () => {
    it('should return user profile when found', async () => {
      const mockUser = {
        id: 'profile-1',
        userId: 'user-123',
        firstName: 'Nguyen',
        lastName: 'Van A',
        phone: '0901234567',
        avatar: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.userProfile.findUnique.mockResolvedValue(mockUser);

      const result = await getUserProfile('user-123');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should return null when user not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const result = await getUserProfile('non-existent');

      expect(result).toBeNull();
      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'non-existent' },
      });
    });

    it('should propagate database errors', async () => {
      mockPrisma.userProfile.findUnique.mockRejectedValue(new Error('DB connection failed'));

      await expect(getUserProfile('user-123')).rejects.toThrow('DB connection failed');
    });
  });

  // ==============================
  // createUserProfile
  // ==============================
  describe('createUserProfile', () => {
    it('should create user profile with all fields', async () => {
      const input = {
        userId: 'user-456',
        firstName: 'Tran',
        lastName: 'Thi B',
        phone: '0912345678',
        avatar: 'https://example.com/avatar.jpg',
      };

      const mockCreated = {
        id: 'profile-2',
        ...input,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.userProfile.create.mockResolvedValue(mockCreated);

      const result = await createUserProfile(input);

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.userProfile.create).toHaveBeenCalledWith({
        data: { ...input },
      });
    });

    it('should create user profile with only userId (optional fields omitted)', async () => {
      const input = { userId: 'user-789' };

      const mockCreated = {
        id: 'profile-3',
        userId: 'user-789',
        firstName: null,
        lastName: null,
        phone: null,
        avatar: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.userProfile.create.mockResolvedValue(mockCreated);

      const result = await createUserProfile(input);

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.userProfile.create).toHaveBeenCalledWith({
        data: { userId: 'user-789' },
      });
    });

    it('should propagate unique constraint error for duplicate userId', async () => {
      const input = { userId: 'user-duplicate' };

      mockPrisma.userProfile.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`user_id`)')
      );

      await expect(createUserProfile(input)).rejects.toThrow('Unique constraint');
    });
  });
});

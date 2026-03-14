// Mock Prisma before imports
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

import { Request, Response } from 'express';
import { getUser, createUser } from '../controllers/user.controller';

// Helper to create mock Express objects
function mockReq(overrides: Partial<Request> = {}): Request {
  return { params: {}, body: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('UserController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==============================
  // getUser
  // ==============================
  describe('getUser', () => {
    it('should return 200 with user data when user exists', async () => {
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

      const req = mockReq({ params: { userId: 'user-123' } });
      const res = mockRes();

      await getUser(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { user: mockUser },
      });
    });

    it('should return 404 when user not found', async () => {
      mockPrisma.userProfile.findUnique.mockResolvedValue(null);

      const req = mockReq({ params: { userId: 'non-existent' } });
      const res = mockRes();

      await getUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    });
  });

  // ==============================
  // createUser
  // ==============================
  describe('createUser', () => {
    it('should return 201 with created user', async () => {
      const body = {
        userId: 'user-new',
        firstName: 'Le',
        lastName: 'Van C',
        phone: '0987654321',
      };

      const mockCreated = {
        id: 'profile-99',
        ...body,
        avatar: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.userProfile.create.mockResolvedValue(mockCreated);

      const req = mockReq({ body });
      const res = mockRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { user: mockCreated },
      });
    });
  });
});

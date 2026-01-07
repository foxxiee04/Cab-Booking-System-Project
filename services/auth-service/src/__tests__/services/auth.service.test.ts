jest.mock('uuid', () => ({
  v4: () => 'uuid-token-001',
}));

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn(async () => 'salt'),
  hash: jest.fn(async () => 'hash'),
  compare: jest.fn(async () => true),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'jwt-signed'),
  verify: jest.fn(() => ({ sub: 'user-1', tokenId: 'uuid-token-001' })),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../models/user.model', () => {
  const mockUserDoc: any = {
    _id: { toString: () => 'user-1' },
    email: 'test@example.com',
    phone: '0900000000',
    passwordHash: 'hash',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    profile: { firstName: 'A', lastName: 'B' },
    save: jest.fn(async () => mockUserDoc),
  };

  const User: any = Object.assign(jest.fn(() => mockUserDoc), {
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    __mockUserDoc: mockUserDoc,
  });

  return {
    UserRole: {
      CUSTOMER: 'CUSTOMER',
      DRIVER: 'DRIVER',
      ADMIN: 'ADMIN',
    },
    UserStatus: {
      ACTIVE: 'ACTIVE',
      INACTIVE: 'INACTIVE',
      SUSPENDED: 'SUSPENDED',
    },
    User,
  };
});

jest.mock('../../models/refresh-token.model', () => {
  const RefreshToken: any = {
    create: jest.fn(async () => ({ tokenId: 'uuid-token-001' })),
    findOne: jest.fn(async () => null),
    updateOne: jest.fn(async () => ({ acknowledged: true })),
    updateMany: jest.fn(async () => ({ acknowledged: true })),
  };
  return { RefreshToken };
});

describe('AuthService (Application/use-case)', () => {
  let AuthService: any;
  let eventPublisher: { publish: jest.Mock };
  let service: any;

  beforeEach(() => {
    ({ AuthService } = require('../../services/auth.service'));
    eventPublisher = { publish: jest.fn() };
    service = new AuthService(eventPublisher as any);
    jest.clearAllMocks();
  });

  it('register: creates user, stores refresh token, publishes user.registered', async () => {
    const { User } = require('../../models/user.model');
    const { RefreshToken } = require('../../models/refresh-token.model');
    const mockUserDoc = User.__mockUserDoc;

    User.findOne.mockResolvedValue(null);

    const result = await service.register({
      email: 'TEST@EXAMPLE.COM',
      password: 'Passw0rd!',
      phone: '0900000000',
      firstName: 'A',
      lastName: 'B',
    } as any);

    expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    expect(User).toHaveBeenCalledTimes(1);
    expect(mockUserDoc.save).toHaveBeenCalledTimes(1);

    expect(RefreshToken.create).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'user.registered',
      expect.objectContaining({ userId: 'user-1', email: 'test@example.com', role: 'CUSTOMER' })
    );

    expect(result.tokens).toEqual(
      expect.objectContaining({
        accessToken: 'jwt-signed',
        refreshToken: 'jwt-signed',
        expiresIn: expect.any(Number),
      })
    );
  });

  it('register: throws if email already exists', async () => {
    const { User } = require('../../models/user.model');
    User.findOne.mockResolvedValue({ _id: 'existing' });

    await expect(
      service.register({ email: 'test@example.com', password: 'x' } as any)
    ).rejects.toThrow('Email already registered');
  });

  it('login: throws on invalid credentials (password mismatch)', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.compare as any).mockResolvedValue(false);

    const { User } = require('../../models/user.model');
    const mockUserDoc = User.__mockUserDoc;

    User.findOne.mockResolvedValue({ ...mockUserDoc, email: 'test@example.com', status: 'ACTIVE', passwordHash: 'hash' });

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' } as any)
    ).rejects.toThrow('Invalid credentials');
  });

  it('refreshToken: rotates old token and issues new pair', async () => {
    const jwt = await import('jsonwebtoken');
    (jwt.verify as any).mockReturnValue({ sub: 'user-1', tokenId: 'uuid-token-001' });

    const { User } = require('../../models/user.model');
    const { RefreshToken } = require('../../models/refresh-token.model');
    const mockUserDoc = User.__mockUserDoc;

    const storedTokenDoc: any = {
      tokenId: 'uuid-token-001',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      save: jest.fn(async () => storedTokenDoc),
    };

    RefreshToken.findOne.mockResolvedValue(storedTokenDoc);
    User.findById.mockResolvedValue({ ...mockUserDoc, status: 'ACTIVE' });

    const tokens = await service.refreshToken('refresh-token-value');

    expect(RefreshToken.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ tokenId: 'uuid-token-001', userId: 'user-1', revokedAt: null })
    );
    expect(storedTokenDoc.save).toHaveBeenCalledTimes(1);
    expect(RefreshToken.create).toHaveBeenCalledTimes(1);

    expect(tokens).toEqual(
      expect.objectContaining({
        accessToken: 'jwt-signed',
        refreshToken: 'jwt-signed',
        expiresIn: expect.any(Number),
      })
    );
  });

  it('logout: revokes specific token when tokenId provided', async () => {
    const { RefreshToken } = require('../../models/refresh-token.model');
    await service.logout('user-1', 'token-1');
    expect(RefreshToken.updateOne).toHaveBeenCalledWith(
      { tokenId: 'token-1', userId: 'user-1' },
      { revokedAt: expect.any(Date) }
    );
  });

  it('logout: revokes all tokens when tokenId not provided', async () => {
    const { RefreshToken } = require('../../models/refresh-token.model');
    await service.logout('user-1');
    expect(RefreshToken.updateMany).toHaveBeenCalledWith(
      { userId: 'user-1', revokedAt: null },
      { revokedAt: expect.any(Date) }
    );
  });
});

import { Request, Response } from 'express';
import { AuthController } from '../controllers/auth.controller';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('AuthController', () => {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getUserById: jest.fn(),
    verifyAccessToken: jest.fn(),
    getUsers: jest.fn(),
    updateUserRole: jest.fn(),
  } as any;

  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService);
  });

  it('register should return 400 on validation error', async () => {
    const req = mockReq({ body: { email: 'bad-email' } });
    const res = mockRes();

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('register should return 201 with user and tokens', async () => {
    authService.register.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        firstName: 'Test',
        lastName: 'User',
      },
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });

    const req = mockReq({
      body: { email: 'test@example.com', password: 'TestPassword123!', firstName: 'Test', lastName: 'User' },
    });
    const res = mockRes();

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'CUSTOMER',
          firstName: 'Test',
          lastName: 'User',
        },
        tokens: { accessToken: 'access', refreshToken: 'refresh' },
      },
    });
  });

  it('login should pass user-agent and ip to service', async () => {
    authService.login.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: 'CUSTOMER', firstName: 'Test', lastName: 'User' },
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    });

    const req = mockReq({
      body: { email: 'test@example.com', password: 'TestPassword123!' },
      headers: { 'user-agent': 'jest-agent' },
      ip: '10.0.0.1',
    });
    const res = mockRes();

    await controller.login(req, res);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'TestPassword123!',
      deviceInfo: 'jest-agent',
      ipAddress: '10.0.0.1',
    });
    expect(res.json).toHaveBeenCalled();
  });

  it('refreshToken should return 400 on validation error', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();

    await controller.refreshToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('verifyToken should return 400 when token is missing', async () => {
    const req = mockReq({ body: {}, headers: {} });
    const res = mockRes();

    await controller.verifyToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('verifyToken should return valid false when verification fails', async () => {
    authService.verifyAccessToken.mockRejectedValue(new Error('invalid token'));
    const req = mockReq({ body: { token: 'bad-token' } });
    const res = mockRes();

    await controller.verifyToken(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { valid: false } });
  });

  it('getUsers should parse pagination and return meta', async () => {
    authService.getUsers.mockResolvedValue({ users: [{ id: 'user-1' }], total: 1 });
    const req = mockReq({ query: { page: '2', limit: '5' } });
    const res = mockRes();

    await controller.getUsers(req, res);

    expect(authService.getUsers).toHaveBeenCalledWith(2, 5, undefined);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { users: [{ id: 'user-1' }] },
      meta: { page: 2, limit: 5, total: 1 },
    });
  });

  it('updateUserRole should return 404 when user is not found', async () => {
    authService.updateUserRole.mockResolvedValue(null);
    const req = mockReq({ params: { userId: 'missing-user' }, body: { role: 'ADMIN' } });
    const res = mockRes();

    await controller.updateUserRole(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

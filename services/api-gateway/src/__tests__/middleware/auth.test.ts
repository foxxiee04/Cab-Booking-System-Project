jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-token';
  });

  it('skips auth for public paths', () => {
    const { authMiddleware } = require('../../middleware/auth');

    const req: any = { path: '/health', headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips auth for dev OTP retrieval outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.OTP_ENABLE_DEV_ENDPOINT;
    const { authMiddleware } = require('../../middleware/auth');

    const req: any = { path: '/api/auth/dev/otp', headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips auth for dev OTP in production when OTP_ENABLE_DEV_ENDPOINT=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.OTP_ENABLE_DEV_ENDPOINT = 'true';
    const { authMiddleware } = require('../../middleware/auth');

    const req: any = { path: '/api/auth/dev/otp', headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    delete process.env.OTP_ENABLE_DEV_ENDPOINT;
  });

  it('returns 401 when Authorization header missing', () => {
    const { authMiddleware } = require('../../middleware/auth');

    const req: any = { path: '/api/rides', headers: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token invalid', () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementation(() => {
      throw new Error('bad token');
    });

    const { authMiddleware } = require('../../middleware/auth');

    const req: any = { path: '/api/rides', headers: { authorization: 'Bearer bad' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid or expired token' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('sets x-user-* headers and calls next for valid token', () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockReturnValue({ userId: 'u1', email: 'u1@example.com', role: 'CUSTOMER' });

    const { authMiddleware } = require('../../middleware/auth');

    const req: any = { path: '/api/rides', headers: { authorization: 'Bearer good' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.headers['x-user-id']).toBe('u1');
    expect(req.headers['x-user-email']).toBe('u1@example.com');
    expect(req.headers['x-user-role']).toBe('CUSTOMER');
    expect(next).toHaveBeenCalledTimes(1);
  });
});

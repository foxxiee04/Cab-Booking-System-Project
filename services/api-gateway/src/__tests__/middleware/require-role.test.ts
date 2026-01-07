jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('requireRole', () => {
  it('returns 401 if req.user missing', () => {
    const { requireRole } = require('../../middleware/auth');

    const mw = requireRole('ADMIN');
    const req: any = { user: undefined };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 if role not allowed', () => {
    const { requireRole } = require('../../middleware/auth');

    const mw = requireRole('ADMIN');
    const req: any = { user: { role: 'CUSTOMER' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next if role allowed', () => {
    const { requireRole } = require('../../middleware/auth');

    const mw = requireRole('ADMIN', 'CUSTOMER');
    const req: any = { user: { role: 'CUSTOMER' } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

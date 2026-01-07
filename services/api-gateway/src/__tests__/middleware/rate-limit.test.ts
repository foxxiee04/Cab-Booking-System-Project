jest.mock('express-rate-limit', () => {
  const rateLimit = jest.fn((options: any) => {
    const mw = (req: any, res: any, next: any) => next();
    (mw as any).__options = options;
    return mw;
  });

  return {
    __esModule: true,
    default: rateLimit,
  };
});

jest.mock('../../config', () => ({
  config: {
    rateLimit: {
      windowMs: 12345,
      maxRequests: 99,
    },
  },
}));

describe('rate-limit middleware', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('creates general/auth/expensive limiters with correct options', () => {
    const { generalLimiter, authLimiter, expensiveLimiter } = require('../../middleware/rate-limit');
    const rateLimit = require('express-rate-limit').default;

    expect(typeof generalLimiter).toBe('function');
    expect(typeof authLimiter).toBe('function');
    expect(typeof expensiveLimiter).toBe('function');

    expect(rateLimit).toHaveBeenCalledTimes(3);

    const calls = rateLimit.mock.calls.map((c: any[]) => c[0]);

    expect(calls[0]).toEqual(
      expect.objectContaining({
        windowMs: 12345,
        max: 99,
        message: {
          success: false,
          message: 'Too many requests, please try again later.',
        },
        standardHeaders: true,
        legacyHeaders: false,
      })
    );

    expect(calls[1]).toEqual(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: {
          success: false,
          message: 'Too many authentication attempts, please try again later.',
        },
        standardHeaders: true,
        legacyHeaders: false,
      })
    );

    expect(calls[2]).toEqual(
      expect.objectContaining({
        windowMs: 60 * 1000,
        max: 10,
        message: {
          success: false,
          message: 'Rate limit exceeded for this operation.',
        },
        standardHeaders: true,
        legacyHeaders: false,
      })
    );

    expect((generalLimiter as any).__options).toEqual(calls[0]);
    expect((authLimiter as any).__options).toEqual(calls[1]);
    expect((expensiveLimiter as any).__options).toEqual(calls[2]);
  });
});

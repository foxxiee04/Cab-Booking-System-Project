import { Request, Response, NextFunction } from 'express';
import { validateCreateUser, validateUpdateUser } from '../validators/user.validator';

function mockReq(body: any = {}): Request {
  return { body } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockNext(): NextFunction {
  return jest.fn();
}

describe('User Validators', () => {
  // ==============================
  // validateCreateUser
  // ==============================
  describe('validateCreateUser', () => {
    it('should call next() when all required fields are valid', () => {
      const req = mockReq({ email: 'test@example.com', firstName: 'A', lastName: 'B' });
      const res = mockRes();
      const next = mockNext();

      validateCreateUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', () => {
      const req = mockReq({ firstName: 'A', lastName: 'B' });
      const res = mockRes();
      const next = mockNext();

      validateCreateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when firstName is missing', () => {
      const req = mockReq({ email: 'test@example.com', lastName: 'B' });
      const res = mockRes();
      const next = mockNext();

      validateCreateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'First name and last name are required' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when lastName is missing', () => {
      const req = mockReq({ email: 'test@example.com', firstName: 'A' });
      const res = mockRes();
      const next = mockNext();

      validateCreateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'First name and last name are required' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid email format', () => {
      const req = mockReq({ email: 'not-an-email', firstName: 'A', lastName: 'B' });
      const res = mockRes();
      const next = mockNext();

      validateCreateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept valid email formats', () => {
      const emails = ['user@domain.com', 'a.b@c.d.e', 'test+tag@gmail.com'];
      for (const email of emails) {
        const req = mockReq({ email, firstName: 'A', lastName: 'B' });
        const res = mockRes();
        const next = mockNext();

        validateCreateUser(req, res, next);

        expect(next).toHaveBeenCalled();
      }
    });
  });

  // ==============================
  // validateUpdateUser
  // ==============================
  describe('validateUpdateUser', () => {
    it('should call next() when no email is provided (update other fields)', () => {
      const req = mockReq({ firstName: 'Updated' });
      const res = mockRes();
      const next = mockNext();

      validateUpdateUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next() when valid email is provided', () => {
      const req = mockReq({ email: 'valid@new.com' });
      const res = mockRes();
      const next = mockNext();

      validateUpdateUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when email format is invalid on update', () => {
      const req = mockReq({ email: 'bad-email' });
      const res = mockRes();
      const next = mockNext();

      validateUpdateUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() when body is empty', () => {
      const req = mockReq({});
      const res = mockRes();
      const next = mockNext();

      validateUpdateUser(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

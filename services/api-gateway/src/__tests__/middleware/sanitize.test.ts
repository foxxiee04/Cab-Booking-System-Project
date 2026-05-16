import { sanitizeBody } from '../../middleware/sanitize';
import { Request, Response, NextFunction } from 'express';

function makeReq(body: unknown): Request {
  return { body } as unknown as Request;
}
const res = {} as Response;
const next: NextFunction = jest.fn();

describe('sanitizeBody middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('strips <script> tags and their content', () => {
    const req = makeReq({ name: '<script>alert("xss")</script>Nguyen Van A' });
    sanitizeBody(req, res, next);
    expect(req.body.name).toBe('Nguyen Van A');
    expect(next).toHaveBeenCalled();
  });

  it('strips generic HTML tags', () => {
    const req = makeReq({ firstName: '<b>Bold</b><img src=x onerror=alert(1)>' });
    sanitizeBody(req, res, next);
    expect(req.body.firstName).toBe('Bold');
  });

  it('removes javascript: URI scheme', () => {
    const req = makeReq({ url: 'javascript:alert(1)' });
    sanitizeBody(req, res, next);
    expect(req.body.url).not.toContain('javascript:');
  });

  it('removes inline event handlers', () => {
    const req = makeReq({ label: '<div onclick="steal()">click</div>' });
    sanitizeBody(req, res, next);
    expect(req.body.label).toBe('click');
    expect(req.body.label).not.toContain('onclick');
  });

  it('preserves clean strings unchanged', () => {
    const req = makeReq({ firstName: 'Nguyễn Văn A', lastName: 'Trần' });
    sanitizeBody(req, res, next);
    expect(req.body.firstName).toBe('Nguyễn Văn A');
    expect(req.body.lastName).toBe('Trần');
  });

  it('sanitizes nested objects recursively', () => {
    const req = makeReq({ user: { name: '<script>x</script>Alice', age: 25 } });
    sanitizeBody(req, res, next);
    expect(req.body.user.name).toBe('Alice');
    expect(req.body.user.age).toBe(25);
  });

  it('sanitizes strings inside arrays', () => {
    const req = makeReq({ tags: ['<b>foo</b>', 'bar', '<script>bad</script>'] });
    sanitizeBody(req, res, next);
    expect(req.body.tags).toEqual(['foo', 'bar', '']);
  });

  it('skips non-object bodies gracefully', () => {
    const req = makeReq(null);
    expect(() => sanitizeBody(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it('preserves numbers and booleans inside objects', () => {
    const req = makeReq({ amount: 150000, active: true, score: 4.5 });
    sanitizeBody(req, res, next);
    expect(req.body.amount).toBe(150000);
    expect(req.body.active).toBe(true);
    expect(req.body.score).toBe(4.5);
  });

  // Password and secret fields must NEVER be touched — they are hashed
  // immediately and must reach the auth service exactly as the user typed.
  it('does NOT sanitize password fields', () => {
    const pw = 'Pass<script>bad</script>word123!';
    const req = makeReq({ password: pw });
    sanitizeBody(req, res, next);
    expect(req.body.password).toBe(pw);
  });

  it('does NOT sanitize currentPassword or newPassword', () => {
    const cur = 'Old<b>Pass</b>1!';
    const next_ = 'New<i>Pass</i>2!';
    const req = makeReq({ currentPassword: cur, newPassword: next_ });
    sanitizeBody(req, res, next);
    expect(req.body.currentPassword).toBe(cur);
    expect(req.body.newPassword).toBe(next_);
  });

  it('does NOT sanitize otp or refreshToken', () => {
    const req = makeReq({ otp: '123456', refreshToken: '<fake>token</fake>' });
    sanitizeBody(req, res, next);
    expect(req.body.otp).toBe('123456');
    expect(req.body.refreshToken).toBe('<fake>token</fake>');
  });

  it('sanitizes non-secret fields alongside skipped fields in the same request', () => {
    const req = makeReq({
      firstName: '<script>bad</script>Alice',
      password: 'MyPass<word>1!',
    });
    sanitizeBody(req, res, next);
    expect(req.body.firstName).toBe('Alice');
    expect(req.body.password).toBe('MyPass<word>1!');
  });
});

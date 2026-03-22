import Joi from 'joi';

const phoneSchema = Joi.string()
  .pattern(/^0\d{9}$/)
  .required()
  .messages({
    'string.pattern.base': 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0',
    'any.required': 'Số điện thoại là bắt buộc',
  });

/** Password: min 8 chars, at least 1 uppercase, at least 1 special character */
const passwordSchema = Joi.string()
  .min(8)
  .max(100)
  .pattern(/^(?=.*[A-Z])(?=.*[^A-Za-z0-9])/)
  .required()
  .messages({
    'string.min': 'Mật khẩu phải có ít nhất 8 ký tự',
    'string.pattern.base': 'Mật khẩu phải chứa ít nhất 1 chữ hoa (A-Z) và 1 ký tự đặc biệt (!@#$%...)',
    'any.required': 'Mật khẩu là bắt buộc',
  });

export const registerSchema = Joi.object({
  phone: phoneSchema,
  password: passwordSchema,
  role: Joi.string().valid('CUSTOMER', 'DRIVER').optional(),
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
});

export const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^0\d{9}$/).optional(),
  email: Joi.string().email().optional(),
  identifier: Joi.string().trim().min(2).max(120).optional(),
  password: Joi.string().required().messages({
    'any.required': 'Mật khẩu là bắt buộc',
  }),
}).custom((value, helpers) => {
  if (!value.phone && !value.email && !value.identifier) {
    return helpers.error('any.required', { key: 'identifier' });
  }
  return value;
}, 'login identifier validation');

export const sendOtpSchema = Joi.object({
  phone: phoneSchema,
});

export const registerPhoneStartSchema = Joi.object({
  phone: phoneSchema,
});

export const registerPhoneVerifySchema = Joi.object({
  phone: phoneSchema,
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'OTP phải gồm 6 chữ số',
    'string.pattern.base': 'OTP chỉ gồm các chữ số',
    'any.required': 'OTP là bắt buộc',
  }),
});

export const registerCompleteSchema = Joi.object({
  phone: phoneSchema,
  password: passwordSchema,
  role: Joi.string().valid('CUSTOMER', 'DRIVER').optional(),
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
});

export const verifyOtpSchema = Joi.object({
  phone: phoneSchema,
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'OTP phải gồm 6 chữ số',
    'string.pattern.base': 'OTP chỉ gồm các chữ số',
    'any.required': 'OTP là bắt buộc',
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const updateRoleSchema = Joi.object({
  role: Joi.string().valid('CUSTOMER', 'DRIVER', 'ADMIN').required(),
});

export const forgotPasswordSchema = Joi.object({
  phone: phoneSchema,
});

export const resetPasswordSchema = Joi.object({
  phone: phoneSchema,
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'OTP phải gồm 6 chữ số',
    'string.pattern.base': 'OTP chỉ gồm các chữ số',
    'any.required': 'OTP là bắt buộc',
  }),
  newPassword: passwordSchema,
});

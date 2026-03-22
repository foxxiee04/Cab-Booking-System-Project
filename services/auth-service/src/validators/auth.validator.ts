import Joi from 'joi';

const phoneSchema = Joi.string()
  .pattern(/^0\d{9}$/)
  .required()
  .messages({
    'string.pattern.base': 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0',
    'any.required': 'Số điện thoại là bắt buộc',
  });

export const registerSchema = Joi.object({
  phone: phoneSchema,
  role: Joi.string().valid('CUSTOMER', 'DRIVER').optional(),
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
});

export const sendOtpSchema = Joi.object({
  phone: phoneSchema,
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

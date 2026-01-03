import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  phone: Joi.string().pattern(/^[+]?[\d\s-]+$/).optional(),
  role: Joi.string().valid('CUSTOMER', 'DRIVER').optional(),
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const updateRoleSchema = Joi.object({
  role: Joi.string().valid('CUSTOMER', 'DRIVER', 'ADMIN').required(),
});

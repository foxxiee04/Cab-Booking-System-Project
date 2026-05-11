import Joi from 'joi';

// Register DTO — phone is the primary identifier (no password)
export interface RegisterUserDto {
  phone: string;
  role: 'CUSTOMER' | 'DRIVER';
  firstName?: string;
  lastName?: string;
}

export const registerUserSchema = Joi.object<RegisterUserDto>({
  phone: Joi.string().pattern(/^0\d{9}$/).required().messages({
    'string.pattern.base': 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0',
    'any.required': 'Số điện thoại là bắt buộc',
  }),
  role: Joi.string().valid('CUSTOMER', 'DRIVER').required().messages({
    'any.only': 'Role phải là CUSTOMER hoặc DRIVER',
    'any.required': 'Role là bắt buộc',
  }),
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
});

// OTP Request DTO
export interface SendOtpDto {
  phone: string;
}

export const sendOtpSchema = Joi.object<SendOtpDto>({
  phone: Joi.string().pattern(/^0\d{9}$/).required().messages({
    'string.pattern.base': 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0',
    'any.required': 'Số điện thoại là bắt buộc',
  }),
});

// OTP Verify DTO
export interface VerifyOtpDto {
  phone: string;
  otp: string;
}

export const verifyOtpSchema = Joi.object<VerifyOtpDto>({
  phone: Joi.string().pattern(/^0\d{9}$/).required(),
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'OTP phải gồm 6 chữ số',
    'string.pattern.base': 'OTP chỉ gồm các chữ số',
    'any.required': 'OTP là bắt buộc',
  }),
});

// Refresh Token DTO
export interface RefreshTokenDto {
  refreshToken: string;
}

export const refreshTokenSchema = Joi.object<RefreshTokenDto>({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token là bắt buộc',
  }),
});

// Update Profile DTO — email is now an optional profile field, not auth
export interface UpdateProfileDto {
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  email?: string;
}

/** Avatar: URL https hoặc data URL ảnh (base64). DB dùng TEXT — giới hạn mềm ~8MB. */
const AVATAR_MAX = 8 * 1024 * 1024;

export const updateProfileSchema = Joi.object<UpdateProfileDto>({
  profile: Joi.object({
    firstName: Joi.string().min(1).max(50).optional(),
    lastName: Joi.string().min(1).max(50).optional(),
    avatar: Joi.string().max(AVATAR_MAX).optional().allow('', null),
  }).optional(),
  email: Joi.string().email().optional().messages({
    'string.email': 'Email không hợp lệ',
  }),
});

// Auth Response DTOs
export interface TokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserResponseDto {
  id: string;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  createdAt: Date;
}

export interface AuthResponseDto {
  user: UserResponseDto;
  tokens: TokensDto;
}

// Login DTO
export const loginSchema = Joi.object({
  email: Joi.string().required().messages({ 'any.required': 'Email is required' }),
  password: Joi.string().required().messages({ 'any.required': 'Password is required' }),
});

// Change Password DTO
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

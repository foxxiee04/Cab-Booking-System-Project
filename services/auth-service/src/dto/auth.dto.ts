import Joi from 'joi';

// Register User DTO
export interface RegisterUserDto {
  email: string;
  password: string;
  phone: string;
  role: 'CUSTOMER' | 'DRIVER';
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export const registerUserSchema = Joi.object<RegisterUserDto>({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must not exceed 128 characters',
    'any.required': 'Password is required',
  }),
  phone: Joi.string().pattern(/^[0-9]{10,15}$/).required().messages({
    'string.pattern.base': 'Phone number must be 10-15 digits',
    'any.required': 'Phone number is required',
  }),
  role: Joi.string().valid('CUSTOMER', 'DRIVER').required().messages({
    'any.only': 'Role must be either CUSTOMER or DRIVER',
    'any.required': 'Role is required',
  }),
  profile: Joi.object({
    firstName: Joi.string().min(1).max(50).required().messages({
      'any.required': 'First name is required',
    }),
    lastName: Joi.string().min(1).max(50).required().messages({
      'any.required': 'Last name is required',
    }),
    avatar: Joi.string().uri().optional(),
  }).required(),
});

// Login DTO
export interface LoginDto {
  email: string;
  password: string;
}

export const loginSchema = Joi.object<LoginDto>({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// Refresh Token DTO
export interface RefreshTokenDto {
  refreshToken: string;
}

export const refreshTokenSchema = Joi.object<RefreshTokenDto>({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

// Update Profile DTO
export interface UpdateProfileDto {
  profile?: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  phone?: string;
}

export const updateProfileSchema = Joi.object<UpdateProfileDto>({
  profile: Joi.object({
    firstName: Joi.string().min(1).max(50).optional(),
    lastName: Joi.string().min(1).max(50).optional(),
    avatar: Joi.string().uri().optional(),
  }).optional(),
  phone: Joi.string().pattern(/^[0-9]{10,15}$/).optional(),
});

// Change Password DTO
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export const changePasswordSchema = Joi.object<ChangePasswordDto>({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

// Auth Response DTOs
export interface TokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserResponseDto {
  id: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  createdAt: Date;
}

export interface AuthResponseDto {
  user: UserResponseDto;
  tokens: TokensDto;
}

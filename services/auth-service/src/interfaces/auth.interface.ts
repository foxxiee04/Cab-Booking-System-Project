// User entity interface
export interface IUser {
  _id: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  profile: IUserProfile;
  refreshTokens: IRefreshToken[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface IRefreshToken {
  token: string;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
}

export type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

// Auth service interfaces
export interface IAuthService {
  register(input: IRegisterInput): Promise<IAuthResult>;
  login(input: ILoginInput): Promise<IAuthResult>;
  logout(userId: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<ITokens>;
  getUserById(userId: string): Promise<IUser | null>;
  updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  validateToken(token: string): Promise<ITokenPayload>;
}

export interface IRegisterInput {
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  profile: IUserProfile;
}

export interface ILoginInput {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface IAuthResult {
  user: IUser;
  tokens: ITokens;
}

export interface ITokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ITokenPayload {
  sub: string; // userId
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

// Repository interface
export interface IUserRepository {
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  findByPhone(phone: string): Promise<IUser | null>;
  create(user: Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>): Promise<IUser>;
  update(id: string, data: Partial<IUser>): Promise<IUser | null>;
  delete(id: string): Promise<boolean>;
  addRefreshToken(userId: string, token: IRefreshToken): Promise<void>;
  removeRefreshToken(userId: string, token: string): Promise<void>;
  clearRefreshTokens(userId: string): Promise<void>;
}

// Events
export interface IUserRegisteredEvent {
  userId: string;
  email: string;
  role: UserRole;
  timestamp: Date;
}

export interface IUserLoggedInEvent {
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  timestamp: Date;
}

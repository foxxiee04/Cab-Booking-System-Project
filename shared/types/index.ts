export * from './events';

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// JWT Payload
export interface JwtPayload {
  sub: string; // userId
  role: string;
  email?: string;
  iat: number;
  exp: number;
}

// Pagination
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Common entity fields
export interface BaseEntity {
  createdAt: Date;
  updatedAt: Date;
}

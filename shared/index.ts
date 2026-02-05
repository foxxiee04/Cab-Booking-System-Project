/**
 * Shared Library - Main Entry Point
 * 
 * Exports all types, utilities, and API client for use in frontend apps
 */

// Export API Client
export { ApiClient, default as default } from './api-client';
export type { ApiResponse, User, AuthTokens } from './api-client';

// Export Types & Events
export * from './types';

// Export Utilities
export * from './utils';

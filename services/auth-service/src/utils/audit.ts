/**
 * Audit Logger - Security event tracking for auth operations
 * Logs OTP requests, login attempts, and auth events.
 */
import { prisma } from '../config/db';
import { logger } from './logger';

export type AuditAction =
  | 'OTP_REQUESTED'
  | 'OTP_VERIFIED'
  | 'OTP_FAILED'
  | 'LOGIN_SUCCESS'
  | 'LOGOUT'
  | 'REGISTER'
  | 'TOKEN_REFRESHED'
  | 'ROLE_CHANGED'
  | 'PROFILE_UPDATED'
  | 'RATE_LIMIT_HIT';

export interface AuditEntry {
  action: AuditAction;
  phone?: string;
  userId?: string;
  ipAddress?: string;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        phone: entry.phone,
        userId: entry.userId,
        ipAddress: entry.ipAddress,
        success: entry.success ?? true,
        metadata: entry.metadata as any,
      },
    });
  } catch (err) {
    // Audit failures must never break the main flow
    logger.error('Audit log write failed:', { action: entry.action, err });
  }
}

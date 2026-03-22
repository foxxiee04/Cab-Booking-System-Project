/**
 * SMS Service — Mock mode
 * No external SMS provider. OTP is logged server-side and retrievable via
 * GET /api/auth/dev/otp/:phone (non-production only).
 */
import { logger } from '../utils/logger';

export class SmsService {
  async sendOtp(phone: string, otp: string): Promise<void> {
    logger.info('[MOCK SMS] OTP generated', {
      phone: this.maskPhone(phone),
      hint: 'Retrieve OTP via GET /api/auth/dev/otp/:phone',
    });
    // Plaintext intentionally NOT logged — use the dev endpoint instead.
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return phone;
    return phone.slice(0, 4) + '***' + phone.slice(-3);
  }
}

/**
 * SMS Service
 * Sends real OTP via Twilio ONLY to the configured PERSONAL_SMS_PHONE.
 * All other numbers are mocked (OTP is logged, not sent).
 */
import twilio from 'twilio';
import { config } from '../config';
import { logger } from '../utils/logger';

export class SmsService {
  private client: twilio.Twilio | null = null;

  constructor() {
    if (config.twilio.enabled && config.twilio.accountSid && config.twilio.authToken) {
      this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    }
  }

  /**
   * Send OTP SMS.
   * Real SMS is sent only when phone === PERSONAL_SMS_PHONE and Twilio is configured.
   * All other numbers get a mock (logged OTP).
   */
  async sendOtp(phone: string, otp: string): Promise<void> {
    const ttlMinutes = Math.floor(config.otp.ttlSeconds / 60);
    const message =
      `[CabBooking] Mã OTP của bạn là: ${otp}. ` +
      `Hiệu lực trong ${ttlMinutes} phút. ` +
      `Không chia sẻ mã này với bất kỳ ai.`;

    const isPersonalPhone = config.sms.personalPhone && phone === config.sms.personalPhone;

    if (isPersonalPhone && this.client) {
      try {
        await this.client.messages.create({
          body: message,
          from: config.twilio.fromPhone,
          to: this.toE164(phone),
        });
        logger.info('OTP SMS sent (personal phone)', { phone: this.maskPhone(phone) });
      } catch (err) {
        logger.error('Twilio SMS send failed:', { phone: this.maskPhone(phone), err });
        throw new Error('Không thể gửi SMS. Vui lòng thử lại.');
      }
    } else {
      // Mock for all non-personal numbers
      logger.info(`[MOCK SMS] OTP for ${this.maskPhone(phone)}: ${otp}`);
    }
  }

  /** Convert Vietnamese local number (0xxxxxxxxx) to E.164 (+84xxxxxxxxx) */
  private toE164(phone: string): string {
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('0')) return '+84' + phone.slice(1);
    return '+84' + phone;
  }

  /** Mask phone for safe logging: 0912***456 */
  private maskPhone(phone: string): string {
    if (phone.length <= 6) return phone;
    return phone.slice(0, 4) + '***' + phone.slice(-3);
  }
}

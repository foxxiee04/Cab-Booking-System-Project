/**
 * SMS Service - Send OTP via Twilio (or log in development)
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
   * Send OTP via SMS.
   * In development (TWILIO_ENABLED=false), logs the OTP instead of sending.
   */
  async sendOtp(phone: string, otp: string): Promise<void> {
    const ttlMinutes = Math.floor(config.otp.ttlSeconds / 60);
    const message =
      `[CabBooking] Mã OTP của bạn là: ${otp}. ` +
      `Hiệu lực trong ${ttlMinutes} phút. ` +
      `Không chia sẻ mã này với bất kỳ ai.`;

    if (config.twilio.enabled && this.client) {
      try {
        await this.client.messages.create({
          body: message,
          from: config.twilio.fromPhone,
          to: this.toE164(phone),
        });
        logger.info('OTP SMS sent', { phone: this.maskPhone(phone) });
      } catch (err) {
        logger.error('Twilio SMS send failed:', { phone: this.maskPhone(phone), err });
        throw new Error('Không thể gửi SMS. Vui lòng thử lại.');
      }
    } else {
      // Development: log OTP clearly
      logger.info(`[DEV] OTP for ${this.maskPhone(phone)}: ${otp}`);
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

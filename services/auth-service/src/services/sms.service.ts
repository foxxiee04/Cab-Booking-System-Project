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
    if (
      config.twilio.enabled
      && config.twilio.accountSid
      && config.twilio.authToken
      && config.twilio.fromPhone
    ) {
      this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
    } else if (config.twilio.enabled) {
      logger.warn('Twilio SMS is enabled but configuration is incomplete. Falling back to mock SMS.', {
        hasAccountSid: Boolean(config.twilio.accountSid),
        hasAuthToken: Boolean(config.twilio.authToken),
        hasFromPhone: Boolean(config.twilio.fromPhone),
      });
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

    const personalPhone = this.normalizePhoneForComparison(config.sms.personalPhone);
    const targetPhone = this.normalizePhoneForComparison(phone);
    const isPersonalPhone = Boolean(personalPhone) && targetPhone === personalPhone;

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
      if (!config.twilio.enabled) {
        logger.info('SMS delivery is running in mock mode because TWILIO_ENABLED=false', {
          phone: this.maskPhone(phone),
        });
      } else if (!isPersonalPhone) {
        logger.info('SMS delivery is mocked because target phone does not match PERSONAL_SMS_PHONE', {
          phone: this.maskPhone(phone),
          configuredPhone: this.maskPhone(config.sms.personalPhone),
        });
      } else if (!this.client) {
        logger.info('SMS delivery is mocked because Twilio client is not ready', {
          phone: this.maskPhone(phone),
        });
      }

      // Mock for all non-personal numbers
      logger.info(`[MOCK SMS] OTP for ${this.maskPhone(phone)}: ${otp}`);
    }
  }

  private normalizePhoneForComparison(phone: string): string {
    const digitsOnly = phone.replace(/\D/g, '');

    if (!digitsOnly) {
      return '';
    }

    if (digitsOnly.startsWith('84') && digitsOnly.length === 11) {
      return `0${digitsOnly.slice(2)}`;
    }

    return digitsOnly;
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

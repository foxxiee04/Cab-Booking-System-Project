import Twilio from 'twilio';
import { config } from '../config';
import { logger } from '../utils/logger';

export class SmsService {
  private readonly mode = config.sms.mode;

  async sendOtp(phone: string, otp: string, purpose: 'register' | 'reset'): Promise<void> {
    if (this.mode === 'twilio') {
      await this.sendViaTwilio(phone, otp, purpose);
      return;
    }

    this.logMockOtp(phone, otp, purpose);
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return phone;
    return phone.slice(0, 4) + '***' + phone.slice(-3);
  }

  private logMockOtp(phone: string, otp: string, purpose: 'register' | 'reset'): void {
    logger.info(`[OTP][${purpose}] ${phone}: ${otp}`);
    logger.info('[MOCK SMS] OTP dispatched via server log', {
      mode: 'mock',
      purpose,
      phone: this.maskPhone(phone),
      ttlSeconds: config.otp.ttlSeconds,
      maxAttempts: config.otp.maxAttempts,
      hint: 'Lay OTP trong log auth-service (docker logs / pm2 logs), khong truy xuat qua API.',
    });
  }

  private async sendViaTwilio(phone: string, otp: string, purpose: 'register' | 'reset'): Promise<void> {
    const { accountSid, authToken, fromPhone } = config.sms.twilio;

    if (!accountSid || !authToken || !fromPhone) {
      throw new Error('Twilio SMS mode chua duoc cau hinh day du.');
    }

    const client = Twilio(accountSid, authToken);
    await client.messages.create({
      from: fromPhone,
      to: this.toE164(phone),
      body: `Cab Booking OTP (${purpose}): ${otp}. Ma co hieu luc trong ${config.otp.ttlSeconds} giay.`,
    });

    logger.info('[SMS] OTP dispatched via Twilio', {
      mode: 'twilio',
      purpose,
      phone: this.maskPhone(phone),
    });
  }

  private toE164(phone: string): string {
    const normalized = phone.replace(/\D/g, '');

    if (normalized.startsWith('84')) {
      return `+${normalized}`;
    }

    if (normalized.startsWith('0')) {
      return `+84${normalized.slice(1)}`;
    }

    return `+${normalized}`;
  }
}

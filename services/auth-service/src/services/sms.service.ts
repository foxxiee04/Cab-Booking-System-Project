import Twilio from 'twilio';
import { config } from '../config';
import { logger } from '../utils/logger';

// ─── OTP message builder ─────────────────────────────────────────────────────

function buildOtpMessage(otp: string, purpose: 'register' | 'reset', ttlSeconds: number): string {
  const purposeVi = purpose === 'register' ? 'xac thuc dang ky' : 'dat lai mat khau';
  return `[CabBooking] Ma OTP ${purposeVi} la: ${otp}. Co hieu luc ${ttlSeconds} giay. Tuyet doi khong cung cap ma nay cho bat ky ai.`;
}

// ─── SMS Service ─────────────────────────────────────────────────────────────

export class SmsService {
  private readonly mode = config.sms?.mode ?? 'mock';

  async sendOtp(phone: string, otp: string, purpose: 'register' | 'reset'): Promise<void> {
    switch (this.mode) {
      case 'twilio':
        await this.sendViaTwilio(phone, otp, purpose);
        break;
      case 'speedsms':
        await this.sendViaSpeedSms(phone, otp, purpose);
        break;
      case 'sns':
        await this.sendViaAwsSns(phone, otp, purpose);
        break;
      default:
        this.logMockOtp(phone, otp, purpose);
    }
  }

  // ─── Mock (development) ────────────────────────────────────────────────────

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

  // ─── Twilio ────────────────────────────────────────────────────────────────

  private async sendViaTwilio(phone: string, otp: string, purpose: 'register' | 'reset'): Promise<void> {
    const { accountSid, authToken, fromPhone } = config.sms.twilio;

    if (!accountSid || !authToken || !fromPhone) {
      throw new Error('Twilio chua duoc cau hinh (thieu TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_PHONE).');
    }

    const client = Twilio(accountSid, authToken);
    await client.messages.create({
      from: fromPhone,
      to: this.toE164(phone),
      body: buildOtpMessage(otp, purpose, config.otp.ttlSeconds),
    });

    logger.info('[SMS] OTP sent via Twilio', { mode: 'twilio', purpose, phone: this.maskPhone(phone) });
  }

  // ─── SpeedSMS (Vietnamese provider — speedsms.vn) ─────────────────────────
  // Docs: https://speedsms.vn/tai-lieu-tich-hop-api-sms/
  // sms_type 2 = OTP / transactional (no template needed, delivered fast)

  private async sendViaSpeedSms(phone: string, otp: string, purpose: 'register' | 'reset'): Promise<void> {
    const { apiKey, senderName } = config.sms.speedsms;

    if (!apiKey) {
      throw new Error('SpeedSMS chua duoc cau hinh (thieu SPEEDSMS_API_KEY).');
    }

    const body = JSON.stringify({
      to:       [this.toLocal84(phone)],
      content:  buildOtpMessage(otp, purpose, config.otp.ttlSeconds),
      sms_type: 2,
      sender:   senderName || '',
    });

    const credentials = Buffer.from(`${apiKey}:x`).toString('base64');
    const res = await fetch('https://api.speedsms.vn/index.php/sms/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${credentials}` },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`SpeedSMS HTTP ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { status?: string; code?: number; message?: string };
    if (json.status !== 'success') {
      throw new Error(`SpeedSMS error: ${json.message ?? JSON.stringify(json)}`);
    }

    logger.info('[SMS] OTP sent via SpeedSMS', { mode: 'speedsms', purpose, phone: this.maskPhone(phone) });
  }

  // ─── AWS SNS (Simple Notification Service) ────────────────────────────────
  // On EC2 / ECS: attach IAM role with sns:Publish permission — no access keys needed.
  // Local dev: set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION env vars.

  private async sendViaAwsSns(phone: string, otp: string, purpose: 'register' | 'reset'): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const awsSdk = (() => { try { return require('@aws-sdk/client-sns'); } catch { return null; } })();
    if (!awsSdk) throw new Error('@aws-sdk/client-sns not installed. Run: npm install @aws-sdk/client-sns');
    const { SNSClient, PublishCommand } = awsSdk;

    const region = process.env.AWS_REGION || 'ap-southeast-1';
    const client = new SNSClient({ region });

    await client.send(new PublishCommand({
      PhoneNumber: this.toE164(phone),
      Message:     buildOtpMessage(otp, purpose, config.otp.ttlSeconds),
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType':     { DataType: 'String', StringValue: 'Transactional' },
        'AWS.SNS.SMS.SenderID':    { DataType: 'String', StringValue: 'CabBook' },
      },
    }));

    logger.info('[SMS] OTP sent via AWS SNS', { mode: 'sns', purpose, phone: this.maskPhone(phone) });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private maskPhone(phone: string): string {
    if (phone.length <= 6) return phone;
    return phone.slice(0, 4) + '***' + phone.slice(-3);
  }

  /** Convert to E.164 international format: 0971234567 → +84971234567 */
  private toE164(phone: string): string {
    const d = phone.replace(/\D/g, '');
    if (d.startsWith('84'))  return `+${d}`;
    if (d.startsWith('0'))   return `+84${d.slice(1)}`;
    return `+${d}`;
  }

  /** SpeedSMS requires 84xxxxxxxxx (no +) */
  private toLocal84(phone: string): string {
    return this.toE164(phone).replace('+', '');
  }
}

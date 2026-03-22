/**
 * OTP Service - Phone-based One Time Password management
 *
 * Security features:
 *  - SHA-256 hashed OTP storage (never stored in plaintext)
 *  - Redis TTL: OTP expires in 5 minutes
 *  - Max 5 verification attempts before OTP is invalidated
 *  - Rate limiting: max 3 OTPs per phone per 10 min
 *  - Rate limiting: max 10 requests per IP per minute
 *  - Anti-spam resend delay: 0s → 30s → 60s
 */
import crypto from 'crypto';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

interface OtpData {
  hash: string;
  attempts: number;
  expiresAt: number; // Unix ms
  sendCount: number;
  lastSentAt: number; // Unix ms
}

export class OtpService {
  private redis: RedisClientType;

  constructor() {
    this.redis = createClient({ url: config.redis.url }) as RedisClientType;
    this.redis.on('error', (err) => logger.error('Redis OTP client error:', err));
  }

  async connect(): Promise<void> {
    await this.redis.connect();
    logger.info('OTP Redis client connected');
  }

  async disconnect(): Promise<void> {
    if (this.redis.isReady) {
      await this.redis.quit();
    }
  }

  isConnected(): boolean {
    return this.redis.isReady;
  }

  /** Generate a cryptographically random 6-digit OTP */
  generateOtp(): string {
    // Using crypto.randomInt for unbiased uniform distribution
    return crypto.randomInt(100000, 1000000).toString();
  }

  /** SHA-256 hash of the OTP */
  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  // Redis key builders
  private otpKey(phone: string, purpose: string = 'register') { return `otp:data:${purpose}:${phone}`; }
  private phoneLimitKey(phone: string)  { return `otp:rate:phone:${phone}`; }
  private ipLimitKey(ip: string)        { return `otp:rate:ip:${ip}`; }
  private resendKey(phone: string, purpose: string = 'register') { return `otp:resend:${purpose}:${phone}`; }
  private verifiedPhoneKey(phone: string) { return `otp:verified:register:${phone}`; }
  /** Dev-only key: stores plaintext OTP for retrieval via dev endpoint */
  private devPlainKey(phone: string, purpose: string) { return `otp:dev:plain:${purpose}:${phone}`; }

  /**
   * Check both per-phone and per-IP rate limits.
   * Returns null if allowed, an error string if blocked.
   */
  async checkRateLimit(phone: string, ip: string): Promise<string | null> {
    const { rateLimit } = config.otp;

    // --- Per-phone limit ---
    const phoneCount = await this.redis.incr(this.phoneLimitKey(phone));
    if (phoneCount === 1) {
      await this.redis.expire(this.phoneLimitKey(phone), rateLimit.phoneWindowSeconds);
    }
    if (phoneCount > rateLimit.maxOtpPerPhone) {
      const ttl = await this.redis.ttl(this.phoneLimitKey(phone));
      return `Quá nhiều yêu cầu OTP cho số điện thoại này. Thử lại sau ${ttl} giây.`;
    }

    // --- Per-IP limit ---
    const ipCount = await this.redis.incr(this.ipLimitKey(ip));
    if (ipCount === 1) {
      await this.redis.expire(this.ipLimitKey(ip), rateLimit.ipWindowSeconds);
    }
    if (ipCount > rateLimit.maxPerIp) {
      const ttl = await this.redis.ttl(this.ipLimitKey(ip));
      return `Quá nhiều yêu cầu từ địa chỉ IP này. Thử lại sau ${ttl} giây.`;
    }

    return null;
  }

  /**
   * Get the remaining resend cooldown in seconds.
   * Returns 0 when the user can send now.
   */
  async getResendDelay(phone: string, purpose: string = 'register'): Promise<number> {
    const raw = await this.redis.get(this.resendKey(phone, purpose));
    if (!raw) return 0;

    const data = JSON.parse(raw) as { count: number; lastAt: number };
    const { resendDelays } = config.otp;
    const delayIndex = Math.min(data.count, resendDelays.length - 1);
    const requiredDelay = resendDelays[delayIndex];

    const elapsedSeconds = Math.floor((Date.now() - data.lastAt) / 1000);
    return Math.max(0, requiredDelay - elapsedSeconds);
  }

  /**
   * Store a new OTP (hashed) in Redis with TTL.
   * Overwrites any existing OTP for the phone.
   */
  async storeOtp(phone: string, otp: string, purpose: string = 'register'): Promise<void> {
    const hash = this.hashOtp(otp);

    // Determine send count from resend tracker
    let sendCount = 1;
    const resendRaw = await this.redis.get(this.resendKey(phone, purpose));
    if (resendRaw) {
      const existing = JSON.parse(resendRaw) as { count: number; lastAt: number };
      sendCount = existing.count + 1;
    }

    const otpData: OtpData = {
      hash,
      attempts: 0,
      expiresAt: Date.now() + config.otp.ttlSeconds * 1000,
      sendCount,
      lastSentAt: Date.now(),
    };

    await this.redis.setEx(
      this.otpKey(phone, purpose),
      config.otp.ttlSeconds,
      JSON.stringify(otpData),
    );

    // In non-production environments, store plaintext OTP for the dev endpoint
    if (process.env.NODE_ENV !== 'production') {
      await this.redis.setEx(this.devPlainKey(phone, purpose), config.otp.ttlSeconds, otp);
    }

    // Update resend cooldown tracker (TTL: 1 hour)
    await this.redis.setEx(
      this.resendKey(phone, purpose),
      3600,
      JSON.stringify({ count: sendCount, lastAt: Date.now() }),
    );
  }

  /**
   * Retrieve plaintext OTP for a phone (non-production only).
   * Returns null if not available.
   */
  async getDevOtp(phone: string, purpose: string = 'register'): Promise<string | null> {
    if (process.env.NODE_ENV === 'production') return null;
    return this.redis.get(this.devPlainKey(phone, purpose));
  }

  /**
   * Verify an OTP submission.
   * Increments attempts on failure. Deletes OTP on success to prevent reuse.
   */
  async verifyOtp(phone: string, otp: string, purpose: string = 'register'): Promise<{ success: boolean; error?: string }> {
    const raw = await this.redis.get(this.otpKey(phone, purpose));

    if (!raw) {
      return { success: false, error: 'OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu OTP mới.' };
    }

    const data = JSON.parse(raw) as OtpData;

    // Double-check expiry (Redis TTL may have a brief lag)
    if (Date.now() > data.expiresAt) {
      await this.redis.del(this.otpKey(phone, purpose));
      return { success: false, error: 'OTP đã hết hạn. Vui lòng yêu cầu OTP mới.' };
    }

    // Check max attempts
    if (data.attempts >= config.otp.maxAttempts) {
      await this.redis.del(this.otpKey(phone, purpose));
      return { success: false, error: 'Quá nhiều lần nhập sai. Vui lòng yêu cầu OTP mới.' };
    }

    // Verify hash (timing-safe comparison)
    const inputHash = this.hashOtp(otp);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(data.hash, 'hex'),
    );

    if (!isValid) {
      data.attempts += 1;
      const remaining = config.otp.maxAttempts - data.attempts;
      // Recalculate remaining TTL to avoid extending expiry
      const remainingTtl = Math.max(1, Math.floor((data.expiresAt - Date.now()) / 1000));
      await this.redis.setEx(this.otpKey(phone, purpose), remainingTtl, JSON.stringify(data));
      return { success: false, error: `OTP không hợp lệ. Còn ${remaining} lần thử.` };
    }

    // OTP valid — delete immediately to prevent reuse
    await this.redis.del(this.otpKey(phone, purpose));
    return { success: true };
  }

  /** Clear resend cooldown after successful verification */
  async clearResendCooldown(phone: string, purpose: string = 'register'): Promise<void> {
    await this.redis.del(this.resendKey(phone, purpose));
  }

  async markPhoneVerifiedForRegistration(phone: string, ttlSeconds = 15 * 60): Promise<void> {
    await this.redis.setEx(this.verifiedPhoneKey(phone), ttlSeconds, '1');
  }

  async isPhoneVerifiedForRegistration(phone: string): Promise<boolean> {
    const value = await this.redis.get(this.verifiedPhoneKey(phone));
    return value === '1';
  }

  async clearPhoneVerifiedForRegistration(phone: string): Promise<void> {
    await this.redis.del(this.verifiedPhoneKey(phone));
  }
}

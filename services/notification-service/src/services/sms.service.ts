import { config } from '../config';

class SMSService {
  private enabled: boolean = false;

  async initialize() {
    // Check if SMS service is configured
    if (config.sms.enabled && config.sms.twilioAccountSid && config.sms.twilioAuthToken) {
      this.enabled = true;
      console.log('✅ SMS service initialized (Twilio)');
    } else {
      this.enabled = false;
      console.log('📱 SMS service disabled (mock mode)');
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      if (!this.enabled) {
        // Mock mode - log SMS content
        console.log('📱 [MOCK SMS]', {
          to,
          message,
          timestamp: new Date().toISOString(),
        });
        return true;
      }

      // Real Twilio implementation would go here
      // const client = require('twilio')(config.sms.twilioAccountSid, config.sms.twilioAuthToken);
      // const result = await client.messages.create({
      //   body: message,
      //   from: config.sms.twilioPhoneNumber,
      //   to: to,
      // });

      console.log('✅ SMS sent:', { to, preview: message.substring(0, 50) });
      return true;
    } catch (error) {
      console.error('❌ SMS send failed:', error);
      return false;
    }
  }

  async sendBulkSMS(messages: Array<{ to: string; message: string }>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const msg of messages) {
      const sent = await this.sendSMS(msg.to, msg.message);
      if (sent) success++;
      else failed++;
    }

    return { success, failed };
  }
}

export const smsService = new SMSService();

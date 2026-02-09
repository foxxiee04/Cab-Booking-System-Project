import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';

class EmailService {
  private transporter: Transporter | null = null;

  async initialize() {
    if (config.email.enabled) {
      try {
        this.transporter = nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port,
          secure: config.email.secure,
          auth: config.email.auth.user
            ? {
                user: config.email.auth.user,
                pass: config.email.auth.pass,
              }
            : undefined,
        });

        // Verify connection
        await this.transporter.verify();
        console.log('✅ Email service initialized');
      } catch (error) {
        console.warn('⚠️ Email service unavailable, using mock mode:', error);
        this.transporter = null;
      }
    } else {
      console.log('📧 Email service disabled (mock mode)');
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      if (!this.transporter) {
        // Mock mode - log email content
        console.log('📧 [MOCK EMAIL]', {
          to,
          subject,
          preview: html.substring(0, 100) + '...',
          timestamp: new Date().toISOString(),
        });
        return true;
      }

      const result = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html,
      });

      console.log('✅ Email sent:', {
        to,
        subject,
        messageId: result.messageId,
      });

      return true;
    } catch (error) {
      console.error('❌ Email send failed:', error);
      return false;
    }
  }

  async sendBulkEmails(
    emails: Array<{ to: string; subject: string; html: string }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const email of emails) {
      const sent = await this.sendEmail(email.to, email.subject, email.html);
      if (sent) success++;
      else failed++;
    }

    return { success, failed };
  }
}

export const emailService = new EmailService();

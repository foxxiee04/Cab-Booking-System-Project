import {
  NotificationModel,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  INotification,
} from '../models/notification.model';
import { emailService } from './email.service';
import { smsService } from './sms.service';
import { emailTemplates, smsTemplates } from '../templates';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  recipient: string;
  templateName?: string;
  subject?: string;
  message?: string;
  metadata?: Record<string, any>;
  priority?: NotificationPriority;
}

class NotificationService {
  async createNotification(dto: CreateNotificationDto): Promise<INotification> {
    const notification = await NotificationModel.create({
      userId: dto.userId,
      type: dto.type,
      recipient: dto.recipient,
      subject: dto.subject,
      message: dto.message || '',
      metadata: dto.metadata,
      priority: dto.priority || NotificationPriority.MEDIUM,
      status: NotificationStatus.PENDING,
      retryCount: 0,
    });

    return notification;
  }

  async sendNotification(notificationId: string): Promise<boolean> {
    const notification = await NotificationModel.findById(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    let success = false;

    try {
      if (notification.type === NotificationType.EMAIL) {
        success = await emailService.sendEmail(
          notification.recipient,
          notification.subject || 'Notification',
          notification.message
        );
      } else if (notification.type === NotificationType.SMS) {
        success = await smsService.sendSMS(notification.recipient, notification.message);
      } else {
        // IN_APP or PUSH notifications - mark as sent (would be handled by WebSocket/FCM)
        success = true;
      }

      if (success) {
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
      } else {
        notification.status = NotificationStatus.FAILED;
        notification.failureReason = 'Send failed';
        notification.retryCount += 1;
      }

      await notification.save();
      return success;
    } catch (error: any) {
      notification.status = NotificationStatus.FAILED;
      notification.failureReason = error.message;
      notification.retryCount += 1;
      await notification.save();
      return false;
    }
  }

  async sendBookingCreatedNotification(data: {
    userId: string;
    email: string;
    phone: string;
    bookingId: string;
    customerName: string;
    vehicleType: string;
    pickupAddress: string;
    dropoffAddress: string;
    estimatedFare: number;
  }): Promise<void> {
    const template = emailTemplates.BOOKING_CREATED;
    const smsTemplate = smsTemplates.BOOKING_CREATED;

    // Send email
    const emailNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.EMAIL,
      recipient: data.email,
      subject: template.subject.replace('#{bookingId}', data.bookingId),
      message: template.html(data),
      metadata: { bookingId: data.bookingId, event: 'BOOKING_CREATED' },
      priority: NotificationPriority.HIGH,
    });

    await this.sendNotification(emailNotification._id.toString());

    // Send SMS
    const smsNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.SMS,
      recipient: data.phone,
      message: smsTemplate(data),
      metadata: { bookingId: data.bookingId, event: 'BOOKING_CREATED' },
      priority: NotificationPriority.HIGH,
    });

    await this.sendNotification(smsNotification._id.toString());
  }

  async sendRideAcceptedNotification(data: {
    userId: string;
    email: string;
    phone: string;
    bookingId: string;
    customerName: string;
    driverName: string;
    vehicleMake: string;
    vehicleModel: string;
    licensePlate: string;
    eta: number;
  }): Promise<void> {
    const template = emailTemplates.RIDE_ACCEPTED;
    const smsTemplate = smsTemplates.RIDE_ACCEPTED;

    // Send email
    const emailNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.EMAIL,
      recipient: data.email,
      subject: template.subject.replace('#{bookingId}', data.bookingId),
      message: template.html(data),
      metadata: { bookingId: data.bookingId, event: 'RIDE_ACCEPTED' },
      priority: NotificationPriority.URGENT,
    });

    await this.sendNotification(emailNotification._id.toString());

    // Send SMS
    const smsNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.SMS,
      recipient: data.phone,
      message: smsTemplate(data),
      metadata: { bookingId: data.bookingId, event: 'RIDE_ACCEPTED' },
      priority: NotificationPriority.URGENT,
    });

    await this.sendNotification(smsNotification._id.toString());
  }

  async sendRideCompletedNotification(data: {
    userId: string;
    email: string;
    phone: string;
    bookingId: string;
    customerName: string;
    distance: number;
    duration: number;
    finalFare: number;
  }): Promise<void> {
    const template = emailTemplates.RIDE_COMPLETED;
    const smsTemplate = smsTemplates.RIDE_COMPLETED;

    // Send email
    const emailNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.EMAIL,
      recipient: data.email,
      subject: template.subject.replace('#{bookingId}', data.bookingId),
      message: template.html(data),
      metadata: { bookingId: data.bookingId, event: 'RIDE_COMPLETED' },
      priority: NotificationPriority.HIGH,
    });

    await this.sendNotification(emailNotification._id.toString());

    // Send SMS
    const smsNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.SMS,
      recipient: data.phone,
      message: smsTemplate(data),
      metadata: { bookingId: data.bookingId, event: 'RIDE_COMPLETED' },
      priority: NotificationPriority.MEDIUM,
    });

    await this.sendNotification(smsNotification._id.toString());
  }

  async sendPaymentNotification(
    data: {
      userId: string;
      email: string;
      phone: string;
      bookingId: string;
      customerName: string;
      amount: number;
      paymentMethod: string;
      transactionId: string;
      paymentDate: string;
    },
    success: boolean
  ): Promise<void> {
    const template = success ? emailTemplates.PAYMENT_SUCCESSFUL : emailTemplates.PAYMENT_FAILED;
    const smsTemplate = success ? smsTemplates.PAYMENT_SUCCESSFUL : smsTemplates.PAYMENT_FAILED;

    // Send email
    const emailNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.EMAIL,
      recipient: data.email,
      subject: template.subject.replace('#{bookingId}', data.bookingId),
      message: template.html(data),
      metadata: { bookingId: data.bookingId, event: success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED' },
      priority: success ? NotificationPriority.MEDIUM : NotificationPriority.HIGH,
    });

    await this.sendNotification(emailNotification._id.toString());

    // Send SMS
    const smsNotification = await this.createNotification({
      userId: data.userId,
      type: NotificationType.SMS,
      recipient: data.phone,
      message: smsTemplate(data),
      metadata: { bookingId: data.bookingId, event: success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED' },
      priority: success ? NotificationPriority.MEDIUM : NotificationPriority.HIGH,
    });

    await this.sendNotification(smsNotification._id.toString());
  }

  async getUserNotifications(userId: string, limit = 50): Promise<INotification[]> {
    return NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
  }

  async retryFailedNotifications(): Promise<{ retried: number; success: number }> {
    const failed = await NotificationModel.find({
      status: NotificationStatus.FAILED,
      retryCount: { $lt: 3 },
    }).limit(100);

    let success = 0;

    for (const notification of failed) {
      const sent = await this.sendNotification(notification._id.toString());
      if (sent) success++;
    }

    return { retried: failed.length, success };
  }
}

export const notificationService = new NotificationService();

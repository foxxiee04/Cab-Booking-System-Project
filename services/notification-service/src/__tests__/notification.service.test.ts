import {
  NotificationType,
  NotificationStatus,
  NotificationPriority,
} from '../models/notification.model';

// Mock NotificationModel
const mockCreate = jest.fn();
const mockFindById = jest.fn();
const mockFind = jest.fn();

jest.mock('../models/notification.model', () => {
  const actual = jest.requireActual('../models/notification.model');
  return {
    ...actual,
    NotificationModel: {
      create: (...args: any[]) => mockCreate(...args),
      findById: (...args: any[]) => mockFindById(...args),
      find: (...args: any[]) => mockFind(...args),
    },
  };
});

// Mock email & sms services
jest.mock('../services/email.service', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../services/sms.service', () => ({
  smsService: {
    sendSMS: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../templates', () => ({
  emailTemplates: {
    BOOKING_CREATED: { subject: 'Booking #{bookingId}', html: () => '<p>test</p>' },
    RIDE_ACCEPTED: { subject: 'Ride #{bookingId}', html: () => '<p>test</p>' },
    RIDE_COMPLETED: { subject: 'Complete #{bookingId}', html: () => '<p>test</p>' },
    PAYMENT_SUCCESSFUL: { subject: 'Payment #{bookingId}', html: () => '<p>test</p>' },
    PAYMENT_FAILED: { subject: 'Failed #{bookingId}', html: () => '<p>test</p>' },
  },
  smsTemplates: {
    BOOKING_CREATED: () => 'Booking SMS',
    RIDE_ACCEPTED: () => 'Ride SMS',
    RIDE_COMPLETED: () => 'Complete SMS',
    PAYMENT_SUCCESSFUL: () => 'Payment SMS',
    PAYMENT_FAILED: () => 'Failed SMS',
  },
}));

import { notificationService } from '../services/notification.service';
import { emailService } from '../services/email.service';
import { smsService } from '../services/sms.service';

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const dto = {
        userId: 'user-1',
        type: NotificationType.EMAIL,
        recipient: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test message',
        priority: NotificationPriority.HIGH,
        metadata: { bookingId: 'b1' },
      };

      const expected = {
        _id: 'notif-1',
        ...dto,
        status: NotificationStatus.PENDING,
        retryCount: 0,
      };
      mockCreate.mockResolvedValue(expected);

      const result = await notificationService.createNotification(dto);

      expect(mockCreate).toHaveBeenCalledWith({
        userId: dto.userId,
        type: dto.type,
        recipient: dto.recipient,
        subject: dto.subject,
        message: dto.message,
        metadata: dto.metadata,
        priority: dto.priority,
        status: NotificationStatus.PENDING,
        retryCount: 0,
      });
      expect(result).toEqual(expected);
    });

    it('should default priority to MEDIUM when not provided', async () => {
      const dto = {
        userId: 'user-1',
        type: NotificationType.SMS,
        recipient: '+84123456789',
        message: 'Test SMS',
      };

      mockCreate.mockResolvedValue({ _id: 'notif-2', ...dto });

      await notificationService.createNotification(dto);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: NotificationPriority.MEDIUM,
        })
      );
    });
  });

  describe('sendNotification', () => {
    it('should send EMAIL notification successfully', async () => {
      const notification = {
        _id: 'notif-1',
        type: NotificationType.EMAIL,
        recipient: 'test@example.com',
        subject: 'Test',
        message: '<p>Hello</p>',
        status: NotificationStatus.PENDING,
        retryCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindById.mockResolvedValue(notification);
      (emailService.sendEmail as jest.Mock).mockResolvedValue(true);

      const result = await notificationService.sendNotification('notif-1');

      expect(result).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test',
        '<p>Hello</p>'
      );
      expect(notification.status).toBe(NotificationStatus.SENT);
      expect(notification.save).toHaveBeenCalled();
    });

    it('should send SMS notification successfully', async () => {
      const notification = {
        _id: 'notif-2',
        type: NotificationType.SMS,
        recipient: '+84123456789',
        message: 'Hello SMS',
        status: NotificationStatus.PENDING,
        retryCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindById.mockResolvedValue(notification);
      (smsService.sendSMS as jest.Mock).mockResolvedValue(true);

      const result = await notificationService.sendNotification('notif-2');

      expect(result).toBe(true);
      expect(smsService.sendSMS).toHaveBeenCalledWith('+84123456789', 'Hello SMS');
      expect(notification.status).toBe(NotificationStatus.SENT);
    });

    it('should mark IN_APP notification as sent without external send', async () => {
      const notification = {
        _id: 'notif-3',
        type: NotificationType.IN_APP,
        recipient: 'user-1',
        message: 'In-app message',
        status: NotificationStatus.PENDING,
        retryCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindById.mockResolvedValue(notification);

      const result = await notificationService.sendNotification('notif-3');

      expect(result).toBe(true);
      expect(notification.status).toBe(NotificationStatus.SENT);
      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(smsService.sendSMS).not.toHaveBeenCalled();
    });

    it('should throw when notification not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        notificationService.sendNotification('non-existent')
      ).rejects.toThrow('Notification not found');
    });

    it('should mark as FAILED when email send fails', async () => {
      const notification = {
        _id: 'notif-4',
        type: NotificationType.EMAIL,
        recipient: 'test@example.com',
        subject: 'Test',
        message: 'msg',
        status: NotificationStatus.PENDING,
        retryCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindById.mockResolvedValue(notification);
      (emailService.sendEmail as jest.Mock).mockResolvedValue(false);

      const result = await notificationService.sendNotification('notif-4');

      expect(result).toBe(false);
      expect(notification.status).toBe(NotificationStatus.FAILED);
      expect(notification.retryCount).toBe(1);
    });

    it('should handle send exception and mark as FAILED', async () => {
      const notification: any = {
        _id: 'notif-5',
        type: NotificationType.EMAIL,
        recipient: 'test@example.com',
        subject: 'Test',
        message: 'msg',
        status: NotificationStatus.PENDING,
        retryCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindById.mockResolvedValue(notification);
      (emailService.sendEmail as jest.Mock).mockRejectedValue(new Error('SMTP error'));

      const result = await notificationService.sendNotification('notif-5');

      expect(result).toBe(false);
      expect(notification.status).toBe(NotificationStatus.FAILED);
      expect(notification.failureReason).toBe('SMTP error');
    });
  });

  describe('sendInAppNotification', () => {
    it('should create and send an in-app notification using the user id as recipient', async () => {
      const createdNotification = {
        _id: 'notif-in-app',
        userId: 'user-1',
        type: NotificationType.IN_APP,
        recipient: 'user-1',
        message: 'Ride completed',
      };

      const persistedNotification = {
        _id: 'notif-in-app',
        type: NotificationType.IN_APP,
        recipient: 'user-1',
        message: 'Ride completed',
        status: NotificationStatus.PENDING,
        retryCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      mockCreate.mockResolvedValue(createdNotification);
      mockFindById.mockResolvedValue(persistedNotification);

      await notificationService.sendInAppNotification({
        userId: 'user-1',
        subject: 'Ride completed',
        message: 'Ride ride-123 completed successfully.',
        metadata: { event: 'ride.completed', rideId: 'ride-123' },
        priority: NotificationPriority.HIGH,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.IN_APP,
        recipient: 'user-1',
        subject: 'Ride completed',
        message: 'Ride ride-123 completed successfully.',
        metadata: { event: 'ride.completed', rideId: 'ride-123' },
        priority: NotificationPriority.HIGH,
        status: NotificationStatus.PENDING,
        retryCount: 0,
      });
      expect(mockFindById).toHaveBeenCalledWith('notif-in-app');
      expect(persistedNotification.save).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications sorted by createdAt desc', async () => {
      const notifications = [
        { _id: 'n1', userId: 'user-1', message: 'msg1' },
        { _id: 'n2', userId: 'user-1', message: 'msg2' },
      ];
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(notifications),
        }),
      });

      const result = await notificationService.getUserNotifications('user-1');

      expect(mockFind).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(result).toEqual(notifications);
    });

    it('should respect custom limit', async () => {
      const limitMock = jest.fn().mockResolvedValue([]);
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: limitMock,
        }),
      });

      await notificationService.getUserNotifications('user-1', 10);

      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  describe('retryFailedNotifications', () => {
    it('should retry failed notifications with retryCount < 3', async () => {
      const failedNotifs = [
        { _id: { toString: () => 'n1' } },
        { _id: { toString: () => 'n2' } },
      ];
      mockFind.mockReturnValue({
        limit: jest.fn().mockResolvedValue(failedNotifs),
      });

      // Mock sendNotification for retries
      const sendSpy = jest
        .spyOn(notificationService, 'sendNotification')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await notificationService.retryFailedNotifications();

      expect(result).toEqual({ retried: 2, success: 1 });
      expect(sendSpy).toHaveBeenCalledTimes(2);
      sendSpy.mockRestore();
    });
  });
});

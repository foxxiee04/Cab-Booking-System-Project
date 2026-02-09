import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { NotificationType, NotificationPriority } from '../models/notification.model';

export const notificationController = {
  // Get user notifications
  async getUserNotifications(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await notificationService.getUserNotifications(userId, limit);

      res.json({
        success: true,
        count: notifications.length,
        notifications,
      });
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Send custom notification (admin/internal use)
  async sendNotification(req: Request, res: Response) {
    try {
      const { userId, type, recipient, subject, message, priority, metadata } = req.body;

      if (!userId || !type || !recipient || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const notification = await notificationService.createNotification({
        userId,
        type: type as NotificationType,
        recipient,
        subject,
        message,
        priority: priority as NotificationPriority,
        metadata,
      });

      const sent = await notificationService.sendNotification(notification._id.toString());

      res.json({
        success: true,
        notification,
        sent,
      });
    } catch (error: any) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Retry failed notifications (admin endpoint)
  async retryFailedNotifications(req: Request, res: Response) {
    try {
      const result = await notificationService.retryFailedNotifications();

      res.json({
        ...result,
      });
    } catch (error: any) {
      console.error('Error retrying notifications:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Health statistics
  async getStatistics(req: Request, res: Response) {
    try {
      const { NotificationModel } = await import('../models/notification.model');

      const [total, pending, sent, failed] = await Promise.all([
        NotificationModel.countDocuments(),
        NotificationModel.countDocuments({ status: 'PENDING' }),
        NotificationModel.countDocuments({ status: 'SENT' }),
        NotificationModel.countDocuments({ status: 'FAILED' }),
      ]);

      res.json({
        success: true,
        statistics: {
          total,
          pending,
          sent,
          failed,
          successRate: total > 0 ? ((sent / total) * 100).toFixed(2) + '%' : 'N/A',
        },
      });
    } catch (error: any) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

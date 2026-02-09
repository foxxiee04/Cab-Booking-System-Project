import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

// Get user notifications
router.get('/notifications', notificationController.getUserNotifications);

// Send custom notification (admin/internal)
router.post('/notifications/send', notificationController.sendNotification);

// Retry failed notifications (admin)
router.post('/notifications/retry', notificationController.retryFailedNotifications);

// Get statistics
router.get('/notifications/statistics', notificationController.getStatistics);

export default router;

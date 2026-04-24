import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Get user notifications
router.get('/notifications', authenticate, notificationController.getUserNotifications);

// Send custom notification (admin/internal)
router.post('/notifications/send', authenticate, requireRole('ADMIN', 'SYSTEM'), notificationController.sendNotification);

// Retry failed notifications (admin)
router.post('/notifications/retry', authenticate, requireRole('ADMIN', 'SYSTEM'), notificationController.retryFailedNotifications);

// Get statistics
router.get('/notifications/statistics', authenticate, requireRole('ADMIN', 'SYSTEM'), notificationController.getStatistics);

export default router;

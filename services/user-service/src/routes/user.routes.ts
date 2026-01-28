import { Router } from 'express';
import { UserService } from '../services/user.service';
import { EventPublisher } from '../events/publisher';
import { logger } from '../utils/logger';

export function createUserRouter(userService: UserService): Router {
  const router = Router();

  // Get user profile
  router.get('/:userId', async (req, res) => {
    try {
      const profile = await userService.getProfile(req.params.userId);
      res.json({ success: true, data: { profile } });
    } catch (error: any) {
      logger.error('Get profile error:', error);
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: error.message },
      });
    }
  });

  // Update user profile
  router.put('/:userId', async (req, res) => {
    try {
      const profile = await userService.updateProfile(req.params.userId, req.body);
      res.json({ success: true, data: { profile } });
    } catch (error: any) {
      logger.error('Update profile error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_FAILED', message: error.message },
      });
    }
  });

  // Update user status (admin only)
  router.patch('/:userId/status', async (req, res) => {
    try {
      const { status } = req.body;
      const profile = await userService.updateStatus(req.params.userId, status);
      res.json({ success: true, data: { profile } });
    } catch (error: any) {
      logger.error('Update status error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'STATUS_UPDATE_FAILED', message: error.message },
      });
    }
  });

  // Delete user profile (admin only)
  router.delete('/:userId', async (req, res) => {
    try {
      await userService.deleteProfile(req.params.userId);
      res.json({ success: true, message: 'Profile deleted' });
    } catch (error: any) {
      logger.error('Delete profile error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: error.message },
      });
    }
  });

  return router;
}

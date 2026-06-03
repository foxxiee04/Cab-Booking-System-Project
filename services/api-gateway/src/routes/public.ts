import { Router } from 'express';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

router.get('/api/public/ride-shares/:token', async (req, res) => {
  try {
    const response = await axios.get(`${config.services.ride}/internal/ride-shares/${req.params.token}`, {
      timeout: 3000,
      headers: { 'x-internal-token': config.internalServiceToken },
    });

    return res.status(response.status).json(response.data);
  } catch (err: any) {
    logger.warn('Public ride share lookup failed', {
      error: err?.message,
      status: err?.response?.status,
    });

    return res.status(err?.response?.status || 404).json(
      err?.response?.data || {
        success: false,
        error: { code: 'SHARE_NOT_FOUND', message: 'Share link is invalid or expired' },
      },
    );
  }
});

export default router;

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
};

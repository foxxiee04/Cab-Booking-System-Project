import { NextFunction, Request, Response } from 'express';
import { createInternalServiceAuth } from '../../../../shared/dist';
import { config } from '../config';

export const requireInternalServiceAuth = createInternalServiceAuth(
  () => config.internalServiceToken
) as (req: Request, res: Response, next: NextFunction) => unknown;
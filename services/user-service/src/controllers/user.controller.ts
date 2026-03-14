import { Request, Response } from 'express';
import { createUserProfile, getUserProfile } from '../services/user.service';

export async function getUser(req: Request, res: Response) {
  const user = await getUserProfile(req.params.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }
  res.json({ success: true, data: { user } });
}

export async function createUser(req: Request, res: Response) {
  try {
    const { userId, firstName, lastName, phone, avatar, email } = req.body;
    const user = await createUserProfile({ userId, firstName, lastName, phone, avatar, email });
    res.status(201).json({ success: true, data: { user } });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create user' },
    });
  }
}

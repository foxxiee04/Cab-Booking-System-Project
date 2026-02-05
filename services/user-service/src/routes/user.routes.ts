import { Router } from 'express';
import { createUser, getUser } from '../controllers/user.controller';
import { validateCreateUser } from '../validators/user.validator';

const router = Router();

router.post('/', validateCreateUser, createUser);
router.get('/:userId', getUser);

export default router;

import { Router } from 'express';
import { loginSchema } from '@rbs/shared';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as authService from '../services/authService';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), async (_req, res) => {
  const { email, password } = res.locals.body;
  res.json(await authService.login(email, password));
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

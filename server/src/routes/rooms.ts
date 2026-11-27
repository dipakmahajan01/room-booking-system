import { Router } from 'express';
import { dateQuerySchema } from '@rbs/shared';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as roomService from '../services/roomService';

export const roomsRouter = Router();

// GET /api/rooms?date=YYYY-MM-DD
roomsRouter.get('/', requireAuth, validate(dateQuerySchema, 'query'), async (_req, res) => {
  res.json(await roomService.listRoomsWithBookings(res.locals.query.date));
});

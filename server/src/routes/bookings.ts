import { Router } from 'express';
import { bookingIdParamSchema, createBookingSchema } from '@rbs/shared';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as bookingService from '../services/bookingService';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

bookingsRouter.post('/', validate(createBookingSchema), async (req, res) => {
  const booking = await bookingService.createBooking(req.user!.id, res.locals.body);
  res.status(201).json(booking);
});

bookingsRouter.get('/mine', async (req, res) => {
  res.json(await bookingService.listMyBookings(req.user!.id));
});

bookingsRouter.delete('/:id', validate(bookingIdParamSchema, 'params'), async (req, res) => {
  await bookingService.cancelBooking(req.user!.id, res.locals.params.id);
  res.status(204).end();
});

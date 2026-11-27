import { z } from 'zod';
import { MAX_BOOKING_MINUTES, MIN_BOOKING_MINUTES } from './constants';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const dateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), 'Invalid date'),
});

export const bookingIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid booking id'),
});

/**
 * Shape + duration rules for a new booking.
 * Shared by the client form and the API so the rules can't drift apart.
 * "Cannot start in the past" depends on the current time, so it is checked separately.
 */
export const createBookingSchema = z
  .object({
    roomId: z.number({ invalid_type_error: 'Choose a room' }).int().positive('Choose a room'),
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
    startTime: z.string().datetime({ offset: true, message: 'Invalid start time' }),
    endTime: z.string().datetime({ offset: true, message: 'Invalid end time' }),
  })
  .superRefine((b, ctx) => {
    const minutes = (Date.parse(b.endTime) - Date.parse(b.startTime)) / 60_000;
    if (minutes <= 0) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
    } else if (minutes < MIN_BOOKING_MINUTES) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: `Booking must be at least ${MIN_BOOKING_MINUTES} minutes` });
    } else if (minutes > MAX_BOOKING_MINUTES) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: `Booking cannot be longer than ${MAX_BOOKING_MINUTES / 60} hours` });
    }
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

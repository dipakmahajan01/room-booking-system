import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@rbs/shared';
import { AppError, notFound } from '../errors';

/** Postgres error codes we translate into HTTP responses. */
const PG_EXCLUSION_VIOLATION = '23P01'; // no_overlap constraint
const PG_CHECK_VIOLATION = '23514';
const PG_FOREIGN_KEY_VIOLATION = '23503';

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.') || 'body', message: i.message }));
    return new AppError(422, 'VALIDATION_ERROR', details[0]?.message ?? 'Invalid input', details);
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    return new AppError(422, 'VALIDATION_ERROR', 'Request body is not valid JSON');
  }

  const pgCode = (err as { code?: string })?.code;
  if (pgCode === PG_EXCLUSION_VIOLATION) {
    return new AppError(409, 'BOOKING_CONFLICT', 'This room is already booked for part of that time');
  }
  if (pgCode === PG_CHECK_VIOLATION) {
    return new AppError(422, 'VALIDATION_ERROR', 'Booking violates a data rule (duration or title)');
  }
  if (pgCode === PG_FOREIGN_KEY_VIOLATION) {
    return notFound('Referenced room or user does not exist');
  }

  console.error(err);
  return new AppError(500, 'INTERNAL', 'Something went wrong');
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const appError = toAppError(err);
  const body: ApiErrorBody = {
    error: { code: appError.code, message: appError.message, ...(appError.details && { details: appError.details }) },
  };
  res.status(appError.status).json(body);
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('Route not found'));

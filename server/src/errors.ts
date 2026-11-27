import type { ErrorCode, FieldError } from '@rbs/shared';

/** An expected error that becomes an HTTP response with the standard error body. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details?: FieldError[],
  ) {
    super(message);
  }
}

export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
export const forbidden = (message: string) => new AppError(403, 'FORBIDDEN', message);
export const unauthenticated = (message = 'Please log in') => new AppError(401, 'UNAUTHENTICATED', message);
export const validationError = (field: string, message: string) =>
  new AppError(422, 'VALIDATION_ERROR', message, [{ field, message }]);

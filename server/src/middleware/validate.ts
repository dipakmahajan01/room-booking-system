import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Validates req.body / req.query / req.params with a zod schema.
 * On success the parsed value is stored in res.locals[source];
 * on failure the ZodError goes to errorHandler (→ 422).
 */
export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    res.locals[source] = result.data;
    next();
  };

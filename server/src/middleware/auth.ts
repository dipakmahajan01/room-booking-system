import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { unauthenticated } from '../errors';

interface TokenPayload {
  sub: string;
  name: string;
  email: string;
}

/** Requires a valid "Authorization: Bearer <token>" header and sets req.user. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthenticated());

  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as TokenPayload;
    req.user = { id: Number(payload.sub), name: payload.name, email: payload.email };
    next();
  } catch {
    next(unauthenticated('Session expired or invalid, please log in again'));
  }
};

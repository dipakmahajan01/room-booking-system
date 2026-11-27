import type { User } from '@rbs/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth middleware. */
      user?: User;
    }
  }
}

export {};

import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { roomsRouter } from './routes/rooms';

/** Builds the Express app (no listen), so tests can call it with supertest. */
export function createApp() {
  const app = express();
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/bookings', bookingsRouter);

  // Express 5 forwards errors thrown in async handlers to here automatically.
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { officeDate, officeTime } from '../src/utils/time';
import { app, book, DAY, loginAs, pool, request, resetDb, slot } from './helpers';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('bookings API', () => {
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    await resetDb();
    alice = await loginAs('alice@example.com');
    bob = await loginAs('bob@example.com');
  });
  afterAll(() => pool.end());

  describe('POST /api/bookings', () => {
    it('creates a booking and returns it', async () => {
      const res = await book(alice, slot(1, '10:00', '11:00', 'Standup'));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        roomId: 1,
        roomName: 'Room A',
        title: 'Standup',
        organiser: { id: 1, name: 'Alice' },
      });
    });

    it('requires login (401)', async () => {
      const res = await request(app).post('/api/bookings').send(slot(1, '10:00', '11:00'));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it.each([
      ['shorter than 15 minutes', '10:00', '10:10'],
      ['longer than 4 hours', '09:00', '13:30'],
      ['end before start', '11:00', '10:00'],
    ])('rejects a booking %s (422)', async (_name, start, end) => {
      const res = await book(alice, slot(1, start, end));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('endTime');
    });

    it('accepts exactly 15 minutes and exactly 4 hours', async () => {
      expect((await book(alice, slot(1, '08:00', '08:15'))).status).toBe(201);
      expect((await book(alice, slot(1, '09:00', '13:00'))).status).toBe(201);
    });

    it('rejects a booking that starts in the past (422)', async () => {
      const yesterday = officeDate(-1);
      const res = await book(alice, {
        roomId: 1,
        title: 'Too late',
        startTime: officeTime(yesterday, '10:00').toISOString(),
        endTime: officeTime(yesterday, '11:00').toISOString(),
      });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('startTime');
    });

    it('rejects a missing title (422)', async () => {
      const res = await book(alice, { ...slot(1, '10:00', '11:00'), title: '  ' });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0].field).toBe('title');
    });

    it('returns 404 for an unknown room', async () => {
      const res = await book(alice, slot(999, '10:00', '11:00'));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/rooms', () => {
    it('lists every room with that day\'s bookings', async () => {
      await book(alice, slot(1, '10:00', '11:00'));
      const res = await request(app).get(`/api/rooms?date=${DAY}`).set(auth(alice));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].bookings).toHaveLength(1);
      expect(res.body[1].bookings).toHaveLength(0);
    });

    it('rejects a bad date (422)', async () => {
      const res = await request(app).get('/api/rooms?date=tomorrow').set(auth(alice));
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/bookings/mine', () => {
    it('returns only my own upcoming bookings', async () => {
      await book(alice, slot(1, '10:00', '11:00', 'Alice meeting'));
      await book(bob, slot(2, '10:00', '11:00', 'Bob meeting'));

      const res = await request(app).get('/api/bookings/mine').set(auth(alice));
      expect(res.status).toBe(200);
      expect(res.body.map((b: { title: string }) => b.title)).toEqual(['Alice meeting']);
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('only lets the organiser cancel (403 for others)', async () => {
      const created = await book(alice, slot(1, '10:00', '11:00'));
      const res = await request(app).delete(`/api/bookings/${created.body.id}`).set(auth(bob));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('lets the organiser cancel (204) and removes it from "mine"', async () => {
      const created = await book(alice, slot(1, '10:00', '11:00'));
      const res = await request(app).delete(`/api/bookings/${created.body.id}`).set(auth(alice));
      expect(res.status).toBe(204);

      const mine = await request(app).get('/api/bookings/mine').set(auth(alice));
      expect(mine.body).toHaveLength(0);
    });

    it('returns 404 for an unknown or already-cancelled booking', async () => {
      expect((await request(app).delete('/api/bookings/999').set(auth(alice))).status).toBe(404);

      const created = await book(alice, slot(1, '10:00', '11:00'));
      await request(app).delete(`/api/bookings/${created.body.id}`).set(auth(alice));
      expect((await request(app).delete(`/api/bookings/${created.body.id}`).set(auth(alice))).status).toBe(404);
    });
  });
});

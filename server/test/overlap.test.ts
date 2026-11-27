import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, book, loginAs, pool, request, resetDb, slot } from './helpers';

describe('overlap rule', () => {
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    await resetDb();
    alice = await loginAs('alice@example.com');
    bob = await loginAs('bob@example.com');
    expect((await book(alice, slot(1, '10:00', '11:00'))).status).toBe(201);
  });
  afterAll(() => pool.end());

  it('rejects the exact same slot with 409', async () => {
    const res = await book(bob, slot(1, '10:00', '11:00'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_CONFLICT');
  });

  it('rejects a booking overlapping the start', async () => {
    expect((await book(bob, slot(1, '09:30', '10:15'))).status).toBe(409);
  });

  it('rejects a booking overlapping the end', async () => {
    expect((await book(bob, slot(1, '10:45', '11:30'))).status).toBe(409);
  });

  it('rejects a booking inside an existing one', async () => {
    expect((await book(bob, slot(1, '10:15', '10:45'))).status).toBe(409);
  });

  it('rejects a booking that fully contains an existing one', async () => {
    expect((await book(bob, slot(1, '09:00', '12:00'))).status).toBe(409);
  });

  it('allows back-to-back bookings (end is exclusive)', async () => {
    expect((await book(bob, slot(1, '11:00', '12:00'))).status).toBe(201);
    expect((await book(bob, slot(1, '09:00', '10:00'))).status).toBe(201);
  });

  it('allows the same time in a different room', async () => {
    expect((await book(bob, slot(2, '10:00', '11:00'))).status).toBe(201);
  });

  it('frees the slot once the booking is cancelled', async () => {
    const mine = await request(app).get('/api/bookings/mine').set('Authorization', `Bearer ${alice}`);
    const id = mine.body[0].id;
    const del = await request(app).delete(`/api/bookings/${id}`).set('Authorization', `Bearer ${alice}`);
    expect(del.status).toBe(204);

    expect((await book(bob, slot(1, '10:00', '11:00'))).status).toBe(201);
  });
});

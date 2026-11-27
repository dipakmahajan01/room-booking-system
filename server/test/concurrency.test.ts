import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { book, loginAs, pool, resetDb, slot } from './helpers';

describe('concurrent booking requests', () => {
  let token: string;

  beforeAll(async () => {
    await resetDb();
    token = await loginAs('alice@example.com');
  });
  afterAll(() => pool.end());

  it('lets exactly one of 10 simultaneous requests for the same slot succeed', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => book(token, slot(1, '14:00', '15:00', `Race ${i}`)));
    const statuses = (await Promise.all(requests)).map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);

    const { rows } = await pool.query("SELECT count(*)::int AS n FROM bookings WHERE status = 'active'");
    expect(rows[0].n).toBe(1);
  });

  it('handles overlapping (not identical) simultaneous requests too', async () => {
    const results = await Promise.all([
      book(token, slot(2, '09:00', '10:00')),
      book(token, slot(2, '09:30', '10:30')),
      book(token, slot(2, '09:45', '11:00')),
    ]);
    const created = results.filter((r) => r.status === 201);
    expect(created).toHaveLength(1);
  });
});

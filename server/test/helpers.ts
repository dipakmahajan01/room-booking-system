import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { pool } from '../src/db/pool';
import { officeDate, officeTime } from '../src/utils/time';

export const app = createApp();
export const PASSWORD = 'password123';

let passwordHash: string | undefined;

/** Migrates the test DB, wipes it and inserts 2 users + 2 rooms. */
export async function resetDb() {
  await runMigrations(pool);
  await pool.query('TRUNCATE bookings, rooms, users RESTART IDENTITY CASCADE');
  passwordHash ??= await bcrypt.hash(PASSWORD, 4);
  await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES
       ('Alice', 'alice@example.com', $1),
       ('Bob',   'bob@example.com',   $1)`,
    [passwordHash],
  );
  await pool.query(
    `INSERT INTO rooms (name, capacity, equipment) VALUES
       ('Room A', 6, '{whiteboard}'),
       ('Room B', 4, '{}')`,
  );
}

export async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return res.body.token;
}

/** A date a week from now, so test bookings are always in the future. */
export const DAY = officeDate(7);

/** Booking payload for `hh:mm`–`hh:mm` office time on DAY. */
export function slot(roomId: number, start: string, end: string, title = 'Meeting') {
  return {
    roomId,
    title,
    startTime: officeTime(DAY, start).toISOString(),
    endTime: officeTime(DAY, end).toISOString(),
  };
}

export function book(token: string, body: object) {
  return request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`).send(body);
}

export { pool, request };

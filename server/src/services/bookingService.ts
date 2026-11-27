import type { Booking, CreateBookingInput } from '@rbs/shared';
import { pool } from '../db/pool';
import { forbidden, notFound, validationError } from '../errors';
import { BOOKING_SELECT, toBooking } from './bookingMapper';

/**
 * Creates a booking.
 * Shape and duration were already validated by createBookingSchema.
 *
 * Overlaps are NOT checked here with a SELECT: a "check then insert" has a race window
 * where two requests both see the slot free. Instead the INSERT relies on the database's
 * no_overlap EXCLUDE constraint; a conflict raises Postgres error 23P01, which
 * errorHandler turns into 409 BOOKING_CONFLICT.
 */
export async function createBooking(organiserId: number, input: CreateBookingInput): Promise<Booking> {
  if (new Date(input.startTime).getTime() < Date.now()) {
    throw validationError('startTime', 'Booking cannot start in the past');
  }

  const room = await pool.query('SELECT 1 FROM rooms WHERE id = $1', [input.roomId]);
  if (room.rowCount === 0) throw notFound('Room not found');

  const { rows } = await pool.query(
    `INSERT INTO bookings (room_id, organiser_id, title, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [input.roomId, organiserId, input.title, input.startTime, input.endTime],
  );

  const created = await pool.query(`${BOOKING_SELECT} WHERE b.id = $1`, [rows[0].id]);
  return toBooking(created.rows[0]);
}

/** The user's active bookings that haven't ended yet, soonest first. */
export async function listMyBookings(organiserId: number): Promise<Booking[]> {
  const { rows } = await pool.query(
    `${BOOKING_SELECT}
     WHERE b.organiser_id = $1 AND b.status = 'active' AND b.end_time > now()
     ORDER BY b.start_time`,
    [organiserId],
  );
  return rows.map(toBooking);
}

/** Cancels (soft-deletes) a booking. Only its organiser may do this. */
export async function cancelBooking(userId: number, bookingId: number): Promise<void> {
  const { rows } = await pool.query(
    'SELECT organiser_id, status, end_time FROM bookings WHERE id = $1',
    [bookingId],
  );
  const booking = rows[0];

  if (!booking || booking.status !== 'active') throw notFound('Booking not found');
  if (booking.organiser_id !== userId) throw forbidden('Only the organiser can cancel this booking');
  if (booking.end_time.getTime() <= Date.now()) {
    throw validationError('id', 'This booking has already ended');
  }

  await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = 'active'", [bookingId]);
}

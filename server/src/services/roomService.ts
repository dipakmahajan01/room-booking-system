import type { RoomWithBookings } from '@rbs/shared';
import { pool } from '../db/pool';
import { officeDayRange } from '../utils/time';
import { BOOKING_SELECT, toBooking } from './bookingMapper';

/** All rooms, each with its active bookings that overlap the given office-timezone day. */
export async function listRoomsWithBookings(date: string): Promise<RoomWithBookings[]> {
  const { start, end } = officeDayRange(date);

  const [roomsResult, bookingsResult] = await Promise.all([
    pool.query('SELECT id, name, capacity, equipment FROM rooms ORDER BY id'),
    pool.query(
      `${BOOKING_SELECT}
       WHERE b.status = 'active' AND b.start_time < $2 AND b.end_time > $1
       ORDER BY b.start_time`,
      [start, end],
    ),
  ]);

  const bookings = bookingsResult.rows.map(toBooking);
  return roomsResult.rows.map((room) => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    equipment: room.equipment,
    bookings: bookings.filter((b) => b.roomId === room.id),
  }));
}

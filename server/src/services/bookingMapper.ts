import type { Booking } from '@rbs/shared';

/** SELECT list + joins that produce rows for toBooking(). */
export const BOOKING_SELECT = `
  SELECT b.id, b.room_id, r.name AS room_name, b.title,
         b.organiser_id, u.name AS organiser_name, b.start_time, b.end_time
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id
  JOIN users u ON u.id = b.organiser_id`;

interface BookingRow {
  id: number;
  room_id: number;
  room_name: string;
  title: string;
  organiser_id: number;
  organiser_name: string;
  start_time: Date;
  end_time: Date;
}

/** DB row (snake_case) → API object (camelCase). */
export function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.room_name,
    title: row.title,
    organiser: { id: row.organiser_id, name: row.organiser_name },
    startTime: row.start_time.toISOString(),
    endTime: row.end_time.toISOString(),
  };
}

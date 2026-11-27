import { addDays, format } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { OFFICE_TZ } from '@rbs/shared';

/**
 * The UTC instants where an office-timezone day starts and ends.
 * e.g. '2026-11-27' in Asia/Kolkata → 2026-11-26T18:30Z .. 2026-11-27T18:30Z
 */
export function officeDayRange(date: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${date}T00:00:00`, OFFICE_TZ);
  const nextDay = format(addDays(new Date(`${date}T12:00:00Z`), 1), 'yyyy-MM-dd');
  const end = fromZonedTime(`${nextDay}T00:00:00`, OFFICE_TZ);
  return { start, end };
}

/** A wall-clock time in the office timezone as a UTC Date, e.g. officeTime('2026-11-27', '10:00'). */
export function officeTime(date: string, hhmm: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, OFFICE_TZ);
}

/** Today's date in the office timezone, as YYYY-MM-DD, offset by `plusDays`. */
export function officeDate(plusDays = 0): string {
  return formatInTimeZone(addDays(new Date(), plusDays), OFFICE_TZ, 'yyyy-MM-dd');
}

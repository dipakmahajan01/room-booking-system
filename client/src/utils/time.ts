import { addDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { DAY_END_HOUR, DAY_START_HOUR, OFFICE_TZ, SLOT_MINUTES } from '@rbs/shared';

/** Today's date in the office timezone (YYYY-MM-DD), whatever the browser's timezone is. */
export const todayInOffice = () => formatInTimeZone(new Date(), OFFICE_TZ, 'yyyy-MM-dd');

/** Shift a YYYY-MM-DD date by n days. */
export const shiftDate = (date: string, days: number) => format(addDays(parseISO(date), days), 'yyyy-MM-dd');

/** Office wall-clock date + 'HH:mm' → ISO string (UTC). */
export const toOfficeISO = (date: string, hhmm: string) => fromZonedTime(`${date}T${hhmm}:00`, OFFICE_TZ).toISOString();

/** ISO → 'HH:mm' in office time. */
export const formatOfficeTime = (iso: string) => formatInTimeZone(iso, OFFICE_TZ, 'HH:mm');

/** ISO → 'yyyy-MM-dd' in office time. */
export const officeDateOf = (iso: string) => formatInTimeZone(iso, OFFICE_TZ, 'yyyy-MM-dd');

/** ISO → e.g. 'Fri 27 Nov' in office time. */
export const formatOfficeDay = (iso: string) => formatInTimeZone(iso, OFFICE_TZ, 'EEE d MMM');

/** Human label for a YYYY-MM-DD date, e.g. 'Friday, 27 November 2026'. */
export const formatDateLabel = (date: string) => format(parseISO(date), 'EEEE, d MMMM yyyy');

/** Minutes since midnight in office time. */
export const officeMinutes = (iso: string) => {
  const [h, m] = formatOfficeTime(iso).split(':').map(Number);
  return h * 60 + m;
};

/** 'HH:mm' labels for each grid slot start, e.g. 08:00, 08:30 … 19:30. */
export function gridSlots(): string[] {
  const slots: string[] = [];
  for (let m = DAY_START_HOUR * 60; m < DAY_END_HOUR * 60; m += SLOT_MINUTES) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
}

/** Add minutes to an 'HH:mm' string (clamped to 23:59). */
export function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

import { DAY_END_HOUR, DAY_START_HOUR, SLOT_MINUTES, type Booking, type RoomWithBookings } from '@rbs/shared';
import { useAuth } from '../auth/AuthContext';
import { addMinutesToHHMM, formatOfficeTime, gridSlots, officeDateOf, officeMinutes, todayInOffice } from '../utils/time';

/**
 * Rooms × time grid for one day. Built by hand with CSS grid:
 * each grid column is 15 minutes; column 1 is the room name.
 * Free 30-minute slots are buttons; bookings are blocks placed over them.
 */
const COL_MINUTES = 15;
const DAY_START = DAY_START_HOUR * 60;
const DAY_END = DAY_END_HOUR * 60;
const COLUMNS = (DAY_END - DAY_START) / COL_MINUTES;

/** Booking start/end as minutes since midnight of `date`, clipped to the visible hours. */
function visibleRange(b: Booking, date: string) {
  const start = officeDateOf(b.startTime) < date ? 0 : officeMinutes(b.startTime);
  const end = officeDateOf(b.endTime) > date ? 24 * 60 : officeMinutes(b.endTime);
  return { start: Math.max(start, DAY_START), end: Math.min(end, DAY_END) };
}

const toColumn = (minutes: number) => (minutes - DAY_START) / COL_MINUTES + 2; // +2: 1-based, after the name column

export function RoomDayGrid({
  rooms,
  date,
  onSlotClick,
}: {
  rooms: RoomWithBookings[];
  date: string;
  onSlotClick: (roomId: number, start: string) => void;
}) {
  const { user } = useAuth();
  const slots = gridSlots();
  const today = todayInOffice();
  const nowMinutes = officeMinutes(new Date().toISOString());
  const isPast = (slotMinutes: number) => date < today || (date === today && slotMinutes + SLOT_MINUTES <= nowMinutes);

  const gridStyle = { gridTemplateColumns: `minmax(110px, 140px) repeat(${COLUMNS}, minmax(22px, 1fr))` };

  return (
    <div className="grid-scroll">
      <div className="grid" style={gridStyle} role="table" aria-label="Room availability">
        {/* Header row: hour labels */}
        <div className="grid__corner" style={{ gridRow: 1, gridColumn: 1 }}>
          Room
        </div>
        {slots
          .filter((s) => s.endsWith(':00'))
          .map((s) => {
            const m = Number(s.slice(0, 2)) * 60;
            return (
              <div key={s} className="grid__hour" style={{ gridRow: 1, gridColumn: `${toColumn(m)} / span 4` }}>
                {s}
              </div>
            );
          })}

        {rooms.map((room, i) => {
          const row = i + 2;
          const ranges = room.bookings.map((b) => ({ booking: b, ...visibleRange(b, date) }));
          const isBooked = (slotStart: number) =>
            ranges.some((r) => r.start < slotStart + SLOT_MINUTES && r.end > slotStart);

          return [
            <div key={`name-${room.id}`} className="grid__room" style={{ gridRow: row, gridColumn: 1 }}>
              <strong>{room.name}</strong>
              <small>
                {room.capacity} ppl{room.equipment.length ? ` · ${room.equipment.join(', ')}` : ''}
              </small>
            </div>,

            ...slots.map((s) => {
              const m = Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
              const style = { gridRow: row, gridColumn: `${toColumn(m)} / span ${SLOT_MINUTES / COL_MINUTES}` };
              if (isBooked(m)) return <div key={`${room.id}-${s}`} className="grid__cell" style={style} />;
              const past = isPast(m);
              return (
                <button
                  key={`${room.id}-${s}`}
                  type="button"
                  className="grid__cell grid__cell--free"
                  style={style}
                  disabled={past}
                  title={past ? 'In the past' : `Book ${room.name} at ${s}`}
                  aria-label={`${room.name} ${s}–${addMinutesToHHMM(s, SLOT_MINUTES)} free`}
                  onClick={() => onSlotClick(room.id, s)}
                />
              );
            }),

            ...ranges
              .filter((r) => r.end > r.start)
              .map(({ booking, start, end }) => {
                const startCol = Math.floor(toColumn(start));
                const endCol = Math.ceil(toColumn(end));
                const mine = booking.organiser.id === user?.id;
                return (
                  <div
                    key={`b-${booking.id}`}
                    className={`grid__booking${mine ? ' grid__booking--mine' : ''}`}
                    style={{ gridRow: row, gridColumn: `${startCol} / ${endCol}` }}
                    title={`${booking.title} · ${formatOfficeTime(booking.startTime)}–${formatOfficeTime(booking.endTime)} · ${booking.organiser.name}`}
                  >
                    <span className="grid__booking-title">{booking.title}</span>
                    <span className="grid__booking-meta">
                      {formatOfficeTime(booking.startTime)}–{formatOfficeTime(booking.endTime)} · {booking.organiser.name}
                    </span>
                  </div>
                );
              }),
          ];
        })}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SLOT_MINUTES } from '@rbs/shared';
import { useRooms } from '../api/hooks';
import { BookingForm, type BookingFormDefaults } from '../components/BookingForm';
import { Modal } from '../components/Modal';
import { RoomDayGrid } from '../components/RoomDayGrid';
import { Empty, ErrorState, Loading } from '../components/StateViews';
import { addMinutesToHHMM, formatDateLabel, shiftDate, todayInOffice } from '../utils/time';

export function DayViewPage() {
  // Keep the chosen date in the URL (?date=YYYY-MM-DD) so refresh/back keeps it.
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? todayInOffice();
  const setDate = (d: string) => setParams(d ? { date: d } : {});

  const [minCapacity, setMinCapacity] = useState(0);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [formDefaults, setFormDefaults] = useState<BookingFormDefaults | null>(null);

  const { data: rooms, isPending, isError, error, refetch, isFetching } = useRooms(date);

  const allEquipment = useMemo(() => [...new Set(rooms?.flatMap((r) => r.equipment))].sort(), [rooms]);
  const visibleRooms = useMemo(
    () => rooms?.filter((r) => r.capacity >= minCapacity && equipment.every((e) => r.equipment.includes(e))) ?? [],
    [rooms, minCapacity, equipment],
  );

  const toggleEquipment = (e: string) =>
    setEquipment((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));

  return (
    <section>
      <div className="toolbar">
        <div className="date-nav">
          <button type="button" className="btn" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
            ‹
          </button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <button type="button" className="btn" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">
            ›
          </button>
          <button type="button" className="btn" onClick={() => setDate(todayInOffice())}>
            Today
          </button>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setFormDefaults({ date })} disabled={!rooms}>
          New booking
        </button>
      </div>

      <h1 className="page-title">
        {formatDateLabel(date)} {isFetching && !isPending && <small className="muted">updating…</small>}
      </h1>

      {rooms && rooms.length > 0 && (
        <div className="filters">
          <label>
            Min capacity{' '}
            <select value={minCapacity} onChange={(e) => setMinCapacity(Number(e.target.value))}>
              {[0, 2, 4, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'Any' : `${n}+`}
                </option>
              ))}
            </select>
          </label>
          {allEquipment.map((e) => (
            <label key={e} className="chip">
              <input type="checkbox" checked={equipment.includes(e)} onChange={() => toggleEquipment(e)} /> {e}
            </label>
          ))}
        </div>
      )}

      {isPending ? (
        <Loading label="Loading rooms…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rooms.length === 0 ? (
        <Empty>No rooms have been set up yet.</Empty>
      ) : visibleRooms.length === 0 ? (
        <Empty>No rooms match these filters.</Empty>
      ) : (
        <>
          <RoomDayGrid
            rooms={visibleRooms}
            date={date}
            onSlotClick={(roomId, start) =>
              setFormDefaults({ roomId, date, start, end: addMinutesToHHMM(start, SLOT_MINUTES * 2) })
            }
          />
          <p className="hint">Click a free slot to book it. Your bookings are highlighted.</p>
        </>
      )}

      {formDefaults && rooms && (
        <Modal title="Book a room" onClose={() => setFormDefaults(null)}>
          <BookingForm rooms={rooms} defaults={formDefaults} onDone={() => setFormDefaults(null)} />
        </Modal>
      )}
    </section>
  );
}

import { useState, type FormEvent } from 'react';
import { createBookingSchema, type Room } from '@rbs/shared';
import { ApiClientError } from '../api/client';
import { useCreateBooking } from '../api/hooks';
import { toOfficeISO } from '../utils/time';

export interface BookingFormDefaults {
  roomId?: number;
  date: string;
  start?: string;
  end?: string;
}

type Field = 'roomId' | 'title' | 'startTime' | 'endTime';
type FieldErrors = Partial<Record<Field, string>>;

export function BookingForm({
  rooms,
  defaults,
  onDone,
}: {
  rooms: Room[];
  defaults: BookingFormDefaults;
  onDone: () => void;
}) {
  const [roomId, setRoomId] = useState(defaults.roomId ? String(defaults.roomId) : '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaults.date);
  const [start, setStart] = useState(defaults.start ?? '09:00');
  const [end, setEnd] = useState(defaults.end ?? '10:00');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const createBooking = useCreateBooking();

  function validate() {
    const errors: FieldErrors = {};
    if (!date || !start) errors.startTime = 'Choose a date and start time';
    if (!end) errors.endTime = 'Choose an end time';
    if (Object.keys(errors).length) return { errors };

    const input = {
      roomId: Number(roomId) || 0,
      title,
      startTime: toOfficeISO(date, start),
      endTime: toOfficeISO(date, end),
    };
    // Same schema the server uses.
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        errors[field] ??= issue.message;
      }
    } else if (Date.parse(input.startTime) < Date.now()) {
      errors.startTime = 'Booking cannot start in the past';
    }
    return Object.keys(errors).length ? { errors } : { data: parsed.data! };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const result = validate();
    if (!result.data) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});

    try {
      await createBooking.mutateAsync(result.data);
      onDone();
    } catch (err) {
      // Show errors returned by the server: field errors next to inputs, the rest as a banner.
      if (err instanceof ApiClientError) {
        if (err.code === 'BOOKING_CONFLICT') {
          setFormError('That room is already booked for part of this time. Pick another time or room.');
        } else if (err.details.length) {
          const errors: FieldErrors = {};
          for (const d of err.details) errors[d.field as Field] ??= d.message;
          setFieldErrors(errors);
          setFormError(err.message);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  }

  const error = (field: Field) =>
    fieldErrors[field] && (
      <span className="field__error" role="alert">
        {fieldErrors[field]}
      </span>
    );

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <label className="field">
        <span>Room</span>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-invalid={!!fieldErrors.roomId}>
          <option value="">Choose a room…</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.capacity} people)
            </option>
          ))}
        </select>
        {error('roomId')}
      </label>

      <label className="field">
        <span>Title</span>
        <input
          value={title}
          maxLength={200}
          placeholder="e.g. Sprint planning"
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!fieldErrors.title}
        />
        {error('title')}
      </label>

      <label className="field">
        <span>Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div className="form__row">
        <label className="field">
          <span>Start</span>
          <input
            type="time"
            step={900}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-invalid={!!fieldErrors.startTime}
          />
          {error('startTime')}
        </label>
        <label className="field">
          <span>End</span>
          <input
            type="time"
            step={900}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={!!fieldErrors.endTime}
          />
          {error('endTime')}
        </label>
      </div>
      <p className="hint">Between 15 minutes and 4 hours.</p>

      {formError && (
        <p className="alert" role="alert">
          {formError}
        </p>
      )}

      <div className="form__actions">
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={createBooking.isPending}>
          {createBooking.isPending ? 'Booking…' : 'Book room'}
        </button>
      </div>
    </form>
  );
}

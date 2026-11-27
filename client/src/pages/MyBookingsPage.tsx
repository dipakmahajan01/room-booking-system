import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Booking } from '@rbs/shared';
import { useCancelBooking, useMyBookings } from '../api/hooks';
import { Empty, ErrorState, Loading } from '../components/StateViews';
import { formatOfficeDay, formatOfficeTime, officeDateOf } from '../utils/time';

export function MyBookingsPage() {
  const { data: bookings, isPending, isError, error, refetch } = useMyBookings();

  return (
    <section>
      <h1 className="page-title">My upcoming bookings</h1>
      {isPending ? (
        <Loading label="Loading your bookings…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : bookings.length === 0 ? (
        <Empty>
          You have no upcoming bookings. <Link to="/">Book a room</Link>
        </Empty>
      ) : (
        <ul className="booking-list">
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const [confirming, setConfirming] = useState(false);
  const cancel = useCancelBooking();

  return (
    <li className="card booking-item">
      <div className="booking-item__info">
        <strong>{booking.title}</strong>
        <span>
          <Link to={`/?date=${officeDateOf(booking.startTime)}`}>{formatOfficeDay(booking.startTime)}</Link> ·{' '}
          {formatOfficeTime(booking.startTime)}–{formatOfficeTime(booking.endTime)} · {booking.roomName}
        </span>
        {cancel.isError && (
          <span className="field__error" role="alert">
            {cancel.error.message}
          </span>
        )}
      </div>
      <div className="booking-item__actions">
        {confirming ? (
          <>
            <span className="muted">Cancel this booking?</span>
            <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={cancel.isPending}>
              Keep
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => cancel.mutate(booking.id)}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? 'Cancelling…' : 'Yes, cancel'}
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirming(true)}>
            Cancel
          </button>
        )}
      </div>
    </li>
  );
}

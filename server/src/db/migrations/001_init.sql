-- Needed so a GiST index can combine "room_id =" with a time-range overlap check.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL
);

CREATE TABLE rooms (
  id        serial PRIMARY KEY,
  name      text NOT NULL UNIQUE,
  capacity  int  NOT NULL CHECK (capacity > 0),
  equipment text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE bookings (
  id           serial PRIMARY KEY,
  room_id      int NOT NULL REFERENCES rooms(id),
  organiser_id int NOT NULL REFERENCES users(id),
  title        text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  start_time   timestamptz NOT NULL,
  end_time     timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- 15 minutes to 4 hours (also guarantees end_time > start_time).
  CONSTRAINT booking_duration CHECK (
    end_time - start_time BETWEEN interval '15 minutes' AND interval '4 hours'
  ),

  -- No two ACTIVE bookings for the same room may overlap.
  -- '[)' = start inclusive, end exclusive, so back-to-back bookings are allowed.
  -- Postgres enforces this atomically, so it also holds for concurrent requests.
  CONSTRAINT no_overlap EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status = 'active')
);

CREATE INDEX bookings_organiser_start_idx ON bookings (organiser_id, start_time);

# Meeting Room Booking

A small full-stack app for booking the office's 6 meeting rooms: see which rooms are free on a day, book a slot, and manage your own bookings. Double bookings are impossible, including when two requests arrive at the same moment.

**Stack:** React + TypeScript (Vite, TanStack Query) · Node.js + TypeScript (Express 5) · PostgreSQL · Vitest + Supertest

**Office timezone:** all times are **Asia/Kolkata (IST, UTC+5:30)**. They are stored as `timestamptz` (UTC) and always shown in office time, whatever the browser's timezone.

Design docs: [docs/HLD.md](docs/HLD.md) (high level) and [docs/LLD.md](docs/LLD.md) (low level).

---

## Setup (about 5 minutes)

**Prerequisites:** Node.js 20+ and PostgreSQL 14+ running locally.

```bash
# 1. Create the app database and a separate test database
createdb -U postgres booking
createdb -U postgres booking_test

# 2. Configure the server
cp server/.env.example server/.env
#    then edit server/.env: set your postgres user/password in DATABASE_URL and
#    TEST_DATABASE_URL, and set JWT_SECRET to any long random string

# 3. Install, create tables, seed data
npm install
npm run db:migrate
npm run db:seed

# 4. Run API (port 4000) + web app (port 5173)
npm run dev
```

Open **http://localhost:5173**.

`npm run db:seed` can be re-run at any time to reset the data. It also runs any pending migrations.

## Seeded logins

| User | Email | Password |
|---|---|---|
| Alice Sharma | alice@example.com | password123 |
| Bob Verma | bob@example.com | password123 |
| Carol Mehta | carol@example.com | password123 |

The seed also creates 6 rooms (Everest, Kailash, Nanda, Annapurna, Kanchenjunga, Dhaulagiri) with different capacities and equipment, and 4 sample bookings for tomorrow and the day after.

## Running the tests

```bash
npm test
```

The tests run against the real `booking_test` PostgreSQL database (from `TEST_DATABASE_URL`), which is wiped before each test. They cover:

- **Overlap rule** (`overlap.test.ts`): same slot, partial overlaps, containment → 409; back-to-back, other room, slot freed by a cancel → 201.
- **Concurrency** (`concurrency.test.ts`): 10 simultaneous requests for one slot → exactly one 201 and nine 409, with one row in the database.
- **API endpoints** (`bookings.api.test.ts`, `auth.test.ts`): 401/403/404/422 cases, duration limits (exactly 15 min and exactly 4 h allowed), past start rejected, "my bookings" only shows your own, only the organiser can cancel.
- **Timezone helpers** (`time.test.ts`).

`npm run typecheck` type-checks server and client.

## API

| Method | Path | Success | Errors |
|---|---|---|---|
| POST | `/api/auth/login` | 200 `{ token, user }` | 401, 422 |
| GET | `/api/auth/me` | 200 user | 401 |
| GET | `/api/rooms?date=YYYY-MM-DD` | 200 rooms, each with that day's bookings | 401, 422 |
| POST | `/api/bookings` `{ roomId, title, startTime, endTime }` | 201 booking | 401, 404, 409, 422 |
| GET | `/api/bookings/mine` | 200 my upcoming bookings | 401 |
| DELETE | `/api/bookings/:id` | 204 | 401, 403, 404, 422 |

All endpoints except login need `Authorization: Bearer <token>`. Every error has the same shape:

```json
{ "error": { "code": "BOOKING_CONFLICT", "message": "This room is already booked for part of that time",
             "details": [{ "field": "endTime", "message": "..." }] } }
```

Codes: `VALIDATION_ERROR` (422), `UNAUTHENTICATED` / `INVALID_CREDENTIALS` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BOOKING_CONFLICT` (409), `INTERNAL` (500).

## Decisions and why

### Preventing double bookings
The overlap rule lives in the **database**, as a PostgreSQL exclusion constraint:

```sql
CONSTRAINT no_overlap EXCLUDE USING gist (
  room_id WITH =,
  tstzrange(start_time, end_time, '[)') WITH &&
) WHERE (status = 'active')
```

It reads: no two active bookings may have the same room and overlapping time ranges.

- **Why not check in code first?** A "SELECT to see if the slot is free, then INSERT" has a race window: two requests can both see the slot free and both insert. Locking or SERIALIZABLE transactions could fix that, but the constraint is simpler and can't be forgotten.
- **Concurrent requests:** Postgres checks the constraint atomically. When two transactions insert overlapping rows at once, the second waits for the first and then fails with error `23P01`. The API turns that into **409 BOOKING_CONFLICT**. The guarantee holds even with several API servers.
- **`'[)'` ranges** include the start and exclude the end, so 10:00–11:00 and 11:00–12:00 don't conflict.
- **`WHERE status = 'active'`** means cancelled bookings don't block the slot.
- The concurrency test proves this with 10 parallel requests.

### Other rules, in layers
1. **Client** validates with the same zod schema as the server (`shared/src/schemas.ts`) for instant feedback.
2. **Server** validates shape and duration (15 min–4 h) → 422, rejects a past start → 422, checks the room exists → 404, and checks that only the organiser cancels → 403.
3. **Database** has `CHECK` constraints for duration and title, and foreign keys, as a last line of defence.

"Cannot start in the past" is checked in the service, not a DB `CHECK`, because a check using `now()` would make old rows invalid later.

### Other choices
- **Raw SQL with `pg`, no ORM:** every query is visible and easy to explain, and the exclusion constraint needs SQL anyway.
- **Soft cancel** (`status = 'cancelled'`) keeps history.
- **npm workspaces with a `shared` package:** types and validation are defined once and used by both client and server, so they can't drift apart.
- **JWT bearer token** (8 h) kept in localStorage: simple and stateless. Any 401 logs the user out on the client.
- **No roles:** every user is an employee. The "organiser" is just the user who created a booking (`bookings.organiser_id`).
- **Day view is hand-built** with CSS grid (15-minute columns, 08:00–20:00), with no calendar library. On narrow screens it scrolls sideways and keeps the room column fixed.
- **TanStack Query** handles loading, error and refetch; creating or cancelling refreshes the day view and "My bookings".

### Stretch goal
- **Filter rooms by capacity and equipment** in the day view (client-side).

## What I cut / would do next
- Docker Compose for one-command setup (left out on purpose for now), and CI running lint and tests.
- httpOnly cookie instead of localStorage for the token, plus rate limiting on login.
- Live updates (SSE or WebSocket) so other users see new bookings without a refresh. Today it refetches on window focus.
- Bookings outside 08:00–20:00 are valid but only the visible part shows in the grid; add a list view for those.
- Recurring bookings, admin role, attendees and room-capacity checks.
- Frontend component tests (React Testing Library) and an end-to-end test (Playwright).

## Time spent
Roughly **__ hours** in total. Most of it went into design, business logic, code review and testing rather than typing code:

- **Design (most of the time):** reading the brief, then working out the architecture, the request flows, the database structure and how to prevent double bookings. This is written up as the plan, [HLD](docs/HLD.md) and [LLD](docs/LLD.md). I reviewed each document in full and asked questions wherever something was unclear (for example: why a connection pool, why a shared types package, whether "organiser" needs a separate role).
- **Iterating on the design:** when I wanted something changed (for example, no Docker for now), I asked for the plan, HLD and LLD to be updated, then reviewed the updated parts before accepting them.
- **Business logic:** working through the booking rules and how each is enforced: no overlaps (database constraint, 409), the 15-minute to 4-hour duration, no bookings in the past, only the organiser can cancel (403), and cancelled bookings freeing the slot. I also worked out which layer checks each rule: client, server or database.
- **Code review (a large share of the time):** the code was generated from the agreed LLD. I reviewed it file by file, especially the schema, `bookingService` and the error handling, and checked it matched the business rules above.
- **Testing (a large share of the time):** I turned each business rule into test cases and covered the edge cases around it:
  - **Overlap:** same slot, overlap at the start or end, a booking inside or around another → 409; back-to-back, a different room, or a slot freed by a cancel → 201.
  - **Concurrency:** 10 simultaneous requests for one slot → exactly one succeeds; partly overlapping simultaneous requests → exactly one succeeds.
  - **Duration and time:** exactly 15 minutes and exactly 4 hours allowed; 10 minutes, over 4 hours, end before start, or a start in the past → 422.
  - **Permissions:** only the organiser can cancel (403 for others); unknown or already-cancelled booking → 404; no token → 401.
  - **Data:** "My bookings" shows only my own upcoming bookings; a blank title, unknown room or bad date → 422/404.

  I also tested the app manually in the browser: booking, seeing conflicts, cancelling, and the phone-width layout.
- **README and final review.**

## Use of AI
I used an AI coding assistant (Claude Code) as a pair programmer:

- **I owned the design decisions.** The assistant drafted the plan, HLD and LLD. I reviewed them, asked questions until each part was clear, and requested changes where I wanted a different approach.
- **The assistant wrote the code and tests** from the agreed LLD.
- **I reviewed the result** and verified it by running the test suite and using the app.

The important decisions (database-level overlap prevention, the validation layers, the error format, no roles beyond "organiser") are explained above. I can walk through and change any part of the code.

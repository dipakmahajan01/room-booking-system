# HLD (High-Level Design) — Meeting Room Booking

## 1. Goals / Non-goals
- **Goals:** see room availability for a day; book a room; view/cancel own bookings; never allow overlapping bookings for a room (even under concurrent requests); clear errors; works on laptop + phone.
- **Non-goals:** sign-up, password reset, OAuth, multi-timezone, recurring bookings, admin role, notifications, Docker (for now). Only stretch goal built: room filter by capacity/equipment.

## 2. Architecture
```
 Browser (React SPA, Vite)
   │  HTTPS/JSON, Authorization: Bearer <JWT>
   ▼
 Express API (Node + TS)
   routes → middleware (auth, validation, error handler) → services → pg Pool
   │  SQL
   ▼
 PostgreSQL 16  (tables + CHECK + EXCLUDE constraints = final guard)
```
Three tiers, stateless API (JWT), single DB. `shared/` package holds types + zod schemas used by client and server.

## 3. Components
| Layer | Component | Responsibility |
|---|---|---|
| Client | AuthContext | holds token/user, protects routes |
| Client | api/client.ts | fetch wrapper; adds token; parses `{error}` body into typed ApiError |
| Client | DayViewPage + RoomDayGrid | rooms × time grid for a date, click free slot to book |
| Client | BookingForm | zod client validation; shows server 409/422 errors |
| Client | MyBookingsPage | upcoming bookings + cancel |
| Client | StateViews | Loading / Empty / Error(retry) components |
| Server | auth middleware | verify JWT → `req.user` |
| Server | errorHandler | maps AppError / zod / pg errors → status + consistent JSON |
| Server | routes (auth, rooms, bookings) | HTTP layer only |
| Server | bookingService | business rules, SQL, pg error 23P01 → 409 |
| Server | db/pool, migrations, seed | connection pool, schema, sample data |
| DB | constraints | duration CHECK, EXCLUDE no-overlap, FKs |

## 4. Data model (ER)
```
users 1 ───< bookings >─── 1 rooms
users:    id, name, email(unique), password_hash
rooms:    id, name(unique), capacity, equipment text[]
bookings: id, room_id FK, organiser_id FK, title, start_time timestamptz,
          end_time timestamptz, status(active|cancelled), created_at
          CHECK 15min ≤ end-start ≤ 4h
          EXCLUDE gist (room_id =, tstzrange(start,end,'[)') &&) WHERE status='active'
Index: bookings(organiser_id, start_time) for "my bookings"; gist index from EXCLUDE serves day queries.
```

## 5. API summary
| Endpoint | Auth | Success | Errors |
|---|---|---|---|
| POST /api/auth/login | no | 200 {token,user} | 401, 422 |
| GET /api/auth/me | yes | 200 user | 401 |
| GET /api/rooms?date= | yes | 200 rooms[+bookings] | 401, 422 |
| POST /api/bookings | yes | 201 booking | 401, 404, 409, 422 |
| GET /api/bookings/mine | yes | 200 bookings | 401 |
| DELETE /api/bookings/:id | yes | 204 | 401, 403, 404 |
Error format: `{ error: { code, message, details?[{field,message}] } }`.

## 6. Key flows
**Login:** form → POST /login → find user by email → bcrypt.compare → sign JWT (8h, payload {sub,name}) → client stores token → redirect to day view.

**Day view:** pick date → GET /rooms?date=D → server computes [D 00:00, D+1 00:00) in Asia/Kolkata → UTC → `SELECT ... WHERE status='active' AND start_time < dayEnd AND end_time > dayStart` → grid renders booked blocks, rest are free.

**Create booking (critical):**
```
Client: zod validate → POST /bookings
Server: auth → zod validate (422) → start >= now (422) → room exists (404)
      → INSERT INTO bookings ...
          ├─ ok → 201
          └─ pg 23P01 exclusion_violation → 409 BOOKING_CONFLICT
Client: 201 → invalidate rooms+mine queries; 409/422 → show on form
```
**Cancel:** DELETE /bookings/:id → load booking (404) → organiser_id ≠ user (403) → UPDATE status='cancelled' → 204 → client refetches.

## 7. Concurrency design (double-booking)
- No "SELECT to check then INSERT" in app code — that has a race window.
- DB EXCLUDE constraint: Postgres checks the gist index atomically; when two transactions insert overlapping ranges at the same time, the second waits for the first and then fails with 23P01. Exactly one wins.
- Works across multiple API instances, since the guarantee lives in the DB.
- Proven by test: 10 parallel POSTs → 1×201, 9×409.

## 8. Time handling
- Office TZ = Asia/Kolkata (config constant). DB stores `timestamptz` (UTC). API exchanges ISO-8601 with offset. Client converts picker input (office local time) → ISO using date-fns-tz; renders in office TZ regardless of browser TZ.

## 9. Security
- bcrypt password hashes (bcryptjs); JWT signed with `JWT_SECRET` from .env; auth required on all non-login routes.
- Parameterised SQL only (`$1`) → no SQL injection. React escapes output → XSS-safe by default.
- Authorization: organiser check on cancel done server-side.
- CORS limited to client origin in dev. Token in localStorage (trade-off noted in README; httpOnly cookie as next step).

## 10. Error handling & validation layers
1. Client zod (fast feedback) → 2. Server zod + business rules (authoritative) → 3. DB constraints (last line of defence). Central errorHandler gives one JSON format; unknown errors → 500 with generic message, logged server-side.

## 11. Frontend state
- Server state: TanStack Query (keys `['rooms', date]`, `['myBookings']`) — provides loading/error/refetch; mutations invalidate keys.
- Local UI state: useState (selected date, form fields, modal open).
- Auth state: React context + localStorage.

## 12. Testing strategy
- Integration tests (Vitest + Supertest) against real Postgres `booking_test` — overlap rules, concurrency, validation (422), auth (401/403), happy paths.
- Unit test for duration/time validation helper.
- Manual checklist in Verification section.

## 13. Non-functional
- Scale: 6 rooms, tens of users — single Node process + one Postgres is plenty.
- Performance: day query uses gist index; pool max 10.
- Responsiveness: CSS grid, horizontal scroll for grid on <600px.
- Setup < 5 min via README scripts.

## 14. Trade-offs & future work
- Raw SQL over ORM: transparent, exclusion constraint needs SQL anyway.
- Soft cancel keeps history; constraint ignores cancelled rows.
- JWT in localStorage: simple; move to httpOnly cookie later.
- Next: Docker Compose, CI, recurring bookings, live updates (SSE/WebSocket), admin role.

# LLD (Low-Level Design)

## 1. Config & scripts
`server/.env`: `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `PORT=4000`, `CLIENT_ORIGIN=http://localhost:5173`. Office timezone is the constant `OFFICE_TZ='Asia/Kolkata'` in `shared/src/constants.ts`.
Root scripts: `dev` (server+client via concurrently), `test`. Server: `dev` (tsx watch), `db:migrate`, `db:seed`, `test` (vitest). Client: `dev`, `build`.
`server/src/config.ts` reads env once, throws on missing values.

## 2. Server files
```
server/src/
  index.ts            app.listen(PORT)
  app.ts              createApp(): express.json, cors, routes, notFound, errorHandler
  config.ts
  db/pool.ts          export pool (pg Pool)
  db/migrate.ts       runs migrations/*.sql in order, tracks in schema_migrations
  db/seed.ts          truncate + insert users/rooms/sample bookings
  errors.ts           AppError + ErrorCode
  middleware/auth.ts          requireAuth
  middleware/validate.ts      validate(schema, 'body'|'query'|'params')
  middleware/errorHandler.ts
  routes/auth.ts  routes/rooms.ts  routes/bookings.ts
  services/authService.ts  services/roomService.ts  services/bookingService.ts
  utils/time.ts       officeDayRange(date), officeTime(date,'HH:mm'), officeDate(+n)
  services/bookingMapper.ts  BOOKING_SELECT + toBooking(row) (snake_case → camelCase)
```

## 3. Errors (`errors.ts`)
```ts
type ErrorCode = 'VALIDATION_ERROR'|'UNAUTHENTICATED'|'INVALID_CREDENTIALS'
  |'FORBIDDEN'|'NOT_FOUND'|'BOOKING_CONFLICT'|'INTERNAL';
class AppError extends Error {
  constructor(public status: number, public code: ErrorCode,
              message: string, public details?: {field:string;message:string}[]) {}
}
```
`errorHandler` mapping:
| Source | Status | Code |
|---|---|---|
| AppError | its status | its code |
| ZodError | 422 | VALIDATION_ERROR (details from issues: path→field) |
| pg `23P01` exclusion_violation | 409 | BOOKING_CONFLICT |
| pg `23514` check_violation | 422 | VALIDATION_ERROR |
| pg `23503` FK violation | 404 | NOT_FOUND |
| anything else | 500 | INTERNAL (logged, generic message) |
Unknown route → 404 NOT_FOUND.

## 4. Middleware
- `requireAuth`: read `Authorization: Bearer <t>` → `jwt.verify(t, JWT_SECRET)` → `req.user = {id, name, email}`; missing/invalid → 401 UNAUTHENTICATED. Express `Request` type augmented in `types/express.d.ts`.
- `validate(schema, source)`: `schema.safeParse(req[source])`; parsed value stored in `res.locals[source]` (Express 5 makes `req.query` read-only); ZodError flows to errorHandler.
- Express 5 forwards errors thrown in async handlers to errorHandler, so no try/catch wrappers in routes.

## 5. Shared package (`shared/src`)
```ts
// types.ts
interface User { id:number; name:string; email:string }
interface Room { id:number; name:string; capacity:number; equipment:string[] }
interface Booking { id:number; roomId:number; roomName:string; title:string;
  organiser:{id:number; name:string}; startTime:string; endTime:string }
interface RoomWithBookings extends Room { bookings: Booking[] }
interface ApiErrorBody { error:{ code:string; message:string; details?:{field:string;message:string}[] } }
// schemas.ts (zod)
loginSchema        = { email: email(), password: string().min(1) }
dateQuerySchema    = { date: regex /^\d{4}-\d{2}-\d{2}$/ }
bookingIdParam     = { id: coerce.number().int().positive() }
createBookingSchema = { roomId:int>0, title:trim 1..200, startTime:datetime(offset), endTime:datetime(offset) }
  .refine(end > start, path endTime)
  .refine(15 ≤ minutes ≤ 240, path endTime)
// constants.ts
MIN_MINUTES=15, MAX_MINUTES=240, OFFICE_TZ='Asia/Kolkata', DAY_START_HOUR=8, DAY_END_HOUR=20
```

## 6. Routes → services
| Route | Middleware | Service call |
|---|---|---|
| POST /api/auth/login | validate(loginSchema) | authService.login(email, pw) |
| GET /api/auth/me | requireAuth | return req.user |
| GET /api/rooms | requireAuth, validate(dateQuerySchema,'query') | roomService.listRoomsWithBookings(date) |
| POST /api/bookings | requireAuth, validate(createBookingSchema) | bookingService.createBooking(user.id, body) → 201 |
| GET /api/bookings/mine | requireAuth | bookingService.listMyBookings(user.id) |
| DELETE /api/bookings/:id | requireAuth, validate(bookingIdParam,'params') | bookingService.cancelBooking(user.id, id) → 204 |

## 7. Services (logic + SQL)
**authService.login(email, password)**
```sql
SELECT id, name, email, password_hash FROM users WHERE lower(email) = lower($1)
```
no row or `!bcrypt.compare` → 401 INVALID_CREDENTIALS (same message for both). Else `jwt.sign({sub:id,name,email}, secret, {expiresIn:'8h'})` → `{token, user}`.

**roomService.listRoomsWithBookings(date)**
`{start,end} = officeDayRange(date)` (fromZonedTime(`${date}T00:00`, TZ), +1 day)
Two simple queries run in parallel and are joined in code (easier to read than one json_agg query):
```sql
SELECT id, name, capacity, equipment FROM rooms ORDER BY id;

-- BOOKING_SELECT = bookings JOIN rooms JOIN users
SELECT ... FROM bookings b JOIN rooms r ON r.id = b.room_id JOIN users u ON u.id = b.organiser_id
WHERE b.status = 'active' AND b.start_time < $2 AND b.end_time > $1   -- overlaps the day
ORDER BY b.start_time;
```

**bookingService.createBooking(userId, {roomId,title,startTime,endTime})**
1. `new Date(startTime) < now` → 422 (field startTime, "cannot start in the past").
2. `SELECT 1 FROM rooms WHERE id=$1` none → 404.
3. ```sql
   INSERT INTO bookings (room_id, organiser_id, title, start_time, end_time)
   VALUES ($1,$2,$3,$4,$5) RETURNING *
   ```
   No overlap SELECT beforehand (race window). If the `no_overlap` constraint rejects the row, Postgres raises `23P01` and errorHandler returns 409 BOOKING_CONFLICT.
4. return DTO (re-select with room name + organiser name).

**bookingService.listMyBookings(userId)**
```sql
SELECT b.*, r.name AS room_name, u.name AS organiser_name
FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.organiser_id
WHERE b.organiser_id=$1 AND b.status='active' AND b.end_time > now()
ORDER BY b.start_time
```

**bookingService.cancelBooking(userId, id)**
```sql
SELECT organiser_id, status, end_time FROM bookings WHERE id=$1
```
none or status='cancelled' → 404; organiser_id ≠ userId → 403 FORBIDDEN; end_time ≤ now → 422 "already ended";
```sql
UPDATE bookings SET status='cancelled' WHERE id=$1 AND status='active'
```

## 8. Migration (`001_init.sql`)
As in Data model section + `CREATE INDEX bookings_organiser_start_idx ON bookings(organiser_id, start_time);` + `schema_migrations(name text PK, run_at timestamptz)` handled by migrate.ts.

## 9. Seed
3 users (alice/bob/carol @example.com, `password123`, bcryptjs cost 10); 6 rooms:
| Name | Cap | Equipment |
|---|---|---|
| Everest | 12 | projector, whiteboard, video-conf |
| Kailash | 8 | projector, whiteboard |
| Nanda | 6 | whiteboard |
| Annapurna | 4 | tv |
| Kanchenjunga | 10 | projector, video-conf |
| Dhaulagiri | 2 | — |
Sample bookings: 4, tomorrow and the day after (office TZ), so always in the future.

## 10. Client files
```
client/src/
  main.tsx           QueryClientProvider + BrowserRouter + AuthProvider
  App.tsx            routes: /login, / (DayView), /my-bookings; <RequireAuth>
  api/client.ts      apiFetch<T>(path, {method, body}) → T | throws ApiClientError; tokenStore
  api/hooks.ts       useRooms(date), useMyBookings(), useCreateBooking(), useCancelBooking()
  auth/AuthContext.tsx  {user, login(), logout()} persisted in localStorage
  pages/LoginPage.tsx  DayViewPage.tsx  MyBookingsPage.tsx
  components/Layout.tsx (nav + logout)  RoomDayGrid.tsx  BookingForm.tsx
             Modal.tsx  StateViews.tsx (Loading/Empty/ErrorState)
  utils/time.ts      toOfficeISO(date,'HH:mm'), formatOfficeTime(iso), todayInOffice(), gridSlots()
  styles.css
```
- `ApiClientError {status, code, message, details}`; 401 from any call → `logout()` + redirect /login.
- Query keys: `['rooms', date]`, `['myBookings']`. Create/cancel `onSuccess` → invalidate both.

## 11. Key components
- **DayViewPage:** `date` kept in the URL `?date=` (default todayInOffice); prev/next/today buttons; client-side filter by min capacity + equipment (stretch goal); `useRooms(date)` → loading → `<Loading/>`, error → `<ErrorState onRetry=refetch/>`, no rooms → `<Empty/>`, else `<RoomDayGrid/>`; "New booking" button + modal with BookingForm.
- **RoomDayGrid** props `{rooms, date, onSlotClick(roomId, startISO)}`: CSS grid, rows = rooms, each column = 15 min from 08:00–20:00 (48 cols) so 15-minute bookings line up. Free 30-min slots are buttons spanning 2 cols. Booking block from column `(startMin − 480)/15 + 2` to `(endMin − 480)/15 + 2`, clipped to visible hours; own bookings highlighted. Free cells are buttons (past slots disabled). Mobile: `overflow-x:auto`, sticky first column.
- **BookingForm** props `{rooms, defaults: {roomId?, date, start?, end?}, onDone}`: fields room/title/date/start/end (`type=time step=900`). On submit: build ISO via toOfficeISO → `createBookingSchema.safeParse` + past-check → field errors; else mutate. Server error: `details` → field errors, else banner (409 "Room already booked for that time"). Submit disabled while pending.
- **MyBookingsPage:** `useMyBookings()`; empty → "No upcoming bookings"; each row shows room, title, date/time + Cancel → inline "Confirm?" → `useCancelBooking` (button disabled while pending; error shown on row).
- **LoginPage:** email/password form, shows 401 message, redirect to / on success; seeded logins hint shown.

## 12. Test cases (`server/test`)
Setup: `TEST_DATABASE_URL`, run migrations once, `TRUNCATE ... RESTART IDENTITY` + seed minimal fixture before each test; helper `loginAs(email)` returns token.
- **overlap.test.ts:** exact same slot → 409; partial overlap start/end → 409; booking inside another → 409; back-to-back → 201; different room same time → 201; overlap with cancelled → 201.
- **concurrency.test.ts:** 10 parallel POSTs same slot → statuses sorted = [201, 409×9]; DB count = 1. 3 parallel partially-overlapping POSTs → exactly one 201.
- **bookings.api.test.ts:** no token → 401; 10-min → 422; 5-h → 422; end<start → 422; past start → 422; unknown room → 404; happy path 201 body shape; `/mine` only own upcoming; cancel by other user → 403; cancel own → 204 then slot rebookable; cancel unknown/already-cancelled → 404; exactly 15 min and exactly 4 h → 201; blank title → 422; bad date query → 422.
- **auth.test.ts:** valid login → 200 token; wrong password → 401; invalid email → 422.
- **time.test.ts (unit):** officeDayRange('2026-11-27') → 2026-11-26T18:30Z .. 2026-11-27T18:30Z.

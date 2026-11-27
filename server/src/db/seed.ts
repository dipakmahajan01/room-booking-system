import bcrypt from 'bcryptjs';
import { pool } from './pool';
import { runMigrations } from './migrate';
import { officeDate, officeTime } from '../utils/time';

export const SEED_PASSWORD = 'password123';

const users = [
  { name: 'Alice Sharma', email: 'alice@example.com' },
  { name: 'Bob Verma', email: 'bob@example.com' },
  { name: 'Carol Mehta', email: 'carol@example.com' },
];

const rooms = [
  { name: 'Everest', capacity: 12, equipment: ['projector', 'whiteboard', 'video-conf'] },
  { name: 'Kailash', capacity: 8, equipment: ['projector', 'whiteboard'] },
  { name: 'Nanda', capacity: 6, equipment: ['whiteboard'] },
  { name: 'Annapurna', capacity: 4, equipment: ['tv'] },
  { name: 'Kanchenjunga', capacity: 10, equipment: ['projector', 'video-conf'] },
  { name: 'Dhaulagiri', capacity: 2, equipment: [] },
];

async function seed() {
  await runMigrations(pool);

  // Start from a clean slate so the seed can be re-run safely.
  await pool.query('TRUNCATE bookings, rooms, users RESTART IDENTITY CASCADE');

  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of users) {
    await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [u.name, u.email, hash]);
  }
  for (const r of rooms) {
    await pool.query('INSERT INTO rooms (name, capacity, equipment) VALUES ($1, $2, $3)', [r.name, r.capacity, r.equipment]);
  }

  // A few sample bookings, always in the future (tomorrow and the day after).
  const d1 = officeDate(1);
  const d2 = officeDate(2);
  const samples = [
    { room: 1, user: 1, title: 'Sprint planning', date: d1, start: '10:00', end: '11:00' },
    { room: 1, user: 2, title: 'Client demo', date: d1, start: '11:00', end: '12:30' },
    { room: 2, user: 3, title: 'Design review', date: d1, start: '14:00', end: '15:00' },
    { room: 5, user: 2, title: 'All-hands prep', date: d2, start: '09:30', end: '10:30' },
  ];
  for (const s of samples) {
    await pool.query(
      'INSERT INTO bookings (room_id, organiser_id, title, start_time, end_time) VALUES ($1, $2, $3, $4, $5)',
      [s.room, s.user, s.title, officeTime(s.date, s.start), officeTime(s.date, s.end)],
    );
  }

  console.log(`Seeded ${users.length} users, ${rooms.length} rooms, ${samples.length} bookings.`);
  console.log(`Login with any of: ${users.map((u) => u.email).join(', ')} / password: ${SEED_PASSWORD}`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

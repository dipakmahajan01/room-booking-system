import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, PASSWORD, pool, request, resetDb } from './helpers';

describe('POST /api/auth/login', () => {
  beforeAll(resetDb);
  afterAll(() => pool.end());

  it('returns a token for valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ALICE@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an invalid email with 422', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('email');
  });

  it('GET /api/auth/me rejects a bad token with 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });
});

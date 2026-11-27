import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginResponse } from '@rbs/shared';
import { config } from '../config';
import { pool } from '../db/pool';
import { AppError } from '../errors';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { rows } = await pool.query(
    'SELECT id, name, email, password_hash FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  const user = rows[0];

  // Same message whether the email or the password is wrong, so emails can't be probed.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const token = jwt.sign({ sub: String(user.id), name: user.name, email: user.email }, config.jwtSecret, {
    expiresIn: '8h',
  });
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}
